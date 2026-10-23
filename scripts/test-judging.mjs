/**
 * M2 判断层验收脚本
 *
 * 退出标准：「改认证 → 资格 / Gap / 候选通知三处同步变化」。
 * 做法：动态选取当前员工未被职称覆盖的 preparing 层（初始职称落库后，
 *       低于岗位职称的层都是 certified，不再适合做样本），
 *       把该层全部未达标技能补到要求等级，对比前后三处结果，最后回滚。
 *
 * 前置：服务端已在跑（npm run dev 或 npm start），库已执行 db:seed:judging。
 * 用法：npm run test:judging
 */
import 'dotenv/config';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const BASE = process.env.JUDGING_BASE_URL || `http://127.0.0.1:${process.env.SERVER_PORT || 3000}`;
const USERNAME = 'zhang-wei';
const PASSWORD = process.env.JUDGING_PASSWORD || '123456';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`}`);
}

async function login() {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`登录失败：HTTP ${response.status}`);
  const cookies = response.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map(item => item.split(';')[0]).join('; ');
  if (!cookie) throw new Error('登录未返回会话 cookie');
  return cookie;
}

async function get(path, cookie) {
  const response = await fetch(`${BASE}${path}`, { headers: { cookie } });
  if (!response.ok) throw new Error(`GET ${path} 失败：HTTP ${response.status}`);
  return response.json();
}

/** 每次重新拉取三处数据，避免静态快照混淆前后状态。 */
async function snapshot(cookie, trackSlug, levelCode) {
  const [overview, gap, candidates] = await Promise.all([
    get('/api/judging/overview', cookie),
    get(`/api/judging/gap?track=${trackSlug}&level=${levelCode}`, cookie),
    get('/api/judging/candidates', cookie),
  ]);
  const level = overview.tracks
    .find(track => track.slug === trackSlug)?.levels
    .find(item => item.levelCode === levelCode);
  const candidate = candidates.items.find(item => item.trackSlug === trackSlug && item.levelCode === levelCode);
  return {
    state: level.state,
    met: `${level.met}/${level.total}`,
    gapItems: gap.gapItems.length,
    candidateKind: candidate?.kind ?? 'none',
  };
}

const db = postgres(process.env.DATABASE_URL, { max: 1 });
const updates = [];   // { id, level } 需要还原等级的认证
const inserts = [];   // slug 需要删除的临时认证

try {
  const cookie = await login();
  const overview = await get('/api/judging/overview', cookie);

  // 找样本层：偏好序列内 preparing 且达标进度最高（补齐后能直接看到「可申请」候选）
  const preferred = overview.preferredTrack;
  const preparing = overview.tracks
    .filter(track => track.slug === preferred)
    .flatMap(track => track.levels)
    .filter(level => level.state === 'preparing')
    .sort((a, b) => (b.met / Math.max(1, b.total)) - (a.met / Math.max(1, a.total)));
  const target = preparing[0];
  if (!target) throw new Error('偏好序列没有 preparing 层可做样本，请检查 db:seed:judging 数据');
  console.log(`样本：${preferred} ${target.levelCode}（${target.levelName}），当前 ${target.met}/${target.total}`);

  const before = await snapshot(cookie, preferred, target.levelCode);
  console.log('调整前：', before);
  check('调整前资格状态为准备中', before.state, 'preparing');
  check('调整前达标进度一致', before.met, `${target.met}/${target.total}`);
  const expectCandidateBefore = target.total - target.met === 1 ? 'candidate-evidence' : 'none';
  check(`调整前候选为${expectCandidateBefore === 'none' ? '空' : '证据类'}`, before.candidateKind, expectCandidateBefore);

  // 把该层所有未达标技能补到要求等级：已有认证 UPDATE，没有 INSERT
  for (const requirement of target.requirements.filter(item => !item.met)) {
    const [row] = await db`
      SELECT id, level FROM mvp_employee_skill
      WHERE employee_slug=${USERNAME} AND skill_slug=${requirement.skillSlug} AND status='active'
      ORDER BY level DESC LIMIT 1`;
    if (row) {
      updates.push(row);
      await db`UPDATE mvp_employee_skill SET level=${requirement.requiredLevel}, updated_at=now() WHERE id=${row.id}`;
    } else {
      const slug = `test-judging-${USERNAME}-${requirement.skillSlug}-${randomUUID().slice(0, 8)}`;
      inserts.push(slug);
      await db`
        INSERT INTO mvp_employee_skill(slug, employee_slug, skill_slug, level, certified_at, source, status)
        VALUES(${slug}, ${USERNAME}, ${requirement.skillSlug}, ${requirement.requiredLevel}, now(), 'initial-seed', 'active')`;
    }
  }

  const after = await snapshot(cookie, preferred, target.levelCode);
  console.log('调整后：', after);
  check('资格同步变为可申请', after.state, 'ready');
  check('进度同步变为全部达标', after.met, `${target.total}/${target.total}`);
  check('Gap 同步清零', after.gapItems, 0);
  check('候选同步变为可申请类', after.candidateKind, 'candidate-application');

  console.log(failures === 0
    ? '\nM2 退出标准通过：改认证后，资格 / Gap / 候选三处同步变化。'
    : `\nM2 验收未通过，${failures} 项断言失败。`);
} finally {
  for (const row of updates) {
    await db`UPDATE mvp_employee_skill SET level=${row.level}, updated_at=now() WHERE id=${row.id}`;
  }
  for (const slug of inserts) {
    await db`DELETE FROM mvp_employee_skill WHERE slug=${slug}`;
  }
  if (updates.length || inserts.length) console.log(`已回滚：还原 ${updates.length} 条认证等级，删除 ${inserts.length} 条临时认证`);
  await db.end();
}

if (failures > 0) process.exit(1);
