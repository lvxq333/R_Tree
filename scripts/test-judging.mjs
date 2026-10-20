/**
 * M2 判断层验收脚本
 *
 * 退出标准：「改一条认证 → 资格 / Gap / 候选通知三处同步变化」。
 * 做法：以张伟（software T2 差一项）为样本，把缺的那一项从 L2 抬到 L3，
 *       分别读取 overview（资格）、gap（Gap 明细）、candidates（候选），
 *       对比前后三处结果，最后回滚，保证可重复执行。
 *
 * 前置：服务端已在跑（npm run dev 或 npm start），库已执行 db:seed:judging。
 * 用法：npm run test:judging
 */
import 'dotenv/config';
import postgres from 'postgres';

const BASE = process.env.JUDGING_BASE_URL || `http://127.0.0.1:${process.env.SERVER_PORT || 3000}`;
const USERNAME = 'zhang-wei';
const PASSWORD = process.env.JUDGING_PASSWORD || 'SkillTree@2026';
const EMPLOYEE = 'zhang-wei';
const SKILL = 'sys-design-split';
const TARGET = { track: 'software', level: 'T2' };

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

const levelOf = overview => overview.tracks
  .find(track => track.slug === TARGET.track)?.levels
  .find(level => level.levelCode === TARGET.level);

async function snapshot(cookie) {
  const [overview, gap, candidates] = await Promise.all([
    get('/api/judging/overview', cookie),
    get(`/api/judging/gap?track=${TARGET.track}&level=${TARGET.level}`, cookie),
    get('/api/judging/candidates', cookie),
  ]);
  const level = levelOf(overview);
  const candidate = candidates.items.find(item => item.trackSlug === TARGET.track && item.levelCode === TARGET.level);
  return {
    state: level.state,
    met: `${level.met}/${level.total}`,
    gapItems: gap.gapItems.length,
    candidateKind: candidate?.kind ?? 'none',
  };
}

const db = postgres(process.env.DATABASE_URL, { max: 1 });
let original = null;

try {
  const cookie = await login();

  const [row] = await db`
    SELECT id, level FROM mvp_employee_skill
    WHERE employee_slug=${EMPLOYEE} AND skill_slug=${SKILL} AND status='active'
    ORDER BY level DESC LIMIT 1`;
  if (!row) throw new Error(`未找到 ${EMPLOYEE} 的 ${SKILL} 认证，请先执行 npm run db:seed:judging`);
  original = row;

  const before = await snapshot(cookie);
  console.log('调整前：', before);
  check('调整前资格状态为准备中', before.state, 'preparing');
  check('调整前达标 3/4', before.met, '3/4');
  check('调整前 Gap 有 1 项', before.gapItems, 1);
  check('调整前候选为证据类', before.candidateKind, 'candidate-evidence');

  // 把缺的那一项抬到要求等级，模拟「补完最后一项认证」
  await db`UPDATE mvp_employee_skill SET level=3, updated_at=now() WHERE id=${row.id}`;

  const after = await snapshot(cookie);
  console.log('调整后：', after);
  check('资格同步变为可申请', after.state, 'ready');
  check('进度同步变为 4/4', after.met, '4/4');
  check('Gap 同步清零', after.gapItems, 0);
  check('候选同步变为可申请类', after.candidateKind, 'candidate-application');

  console.log(failures === 0
    ? '\nM2 退出标准通过：改一条认证，资格 / Gap / 候选三处同步变化。'
    : `\nM2 验收未通过，${failures} 项断言失败。`);
} finally {
  if (original) {
    await db`UPDATE mvp_employee_skill SET level=${original.level}, updated_at=now() WHERE id=${original.id}`;
    console.log(`已回滚 ${EMPLOYEE} 的 ${SKILL} 等级到 L${original.level}`);
  }
  await db.end();
}

if (failures > 0) process.exit(1);
