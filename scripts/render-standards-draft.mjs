import 'dotenv/config';
import postgres from 'postgres';
import { readFile, writeFile } from 'node:fs/promises';

const draftPath = new URL('../server/database/seed/standards-draft.json', import.meta.url);
const outPath = new URL('../docs/m1-standards-draft.md', import.meta.url);
const draft = JSON.parse(await readFile(draftPath, 'utf8'));

const errors = [];
const newSkills = new Set(draft.skillsNew.map(s => s.slug));

let dbSkills = new Set();
let dbSkillCategories = new Map();
let dbSequences = new Map();
let dbNodes = [];
try {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const rows = await sql`SELECT slug, name, category_slug FROM skill`;
  dbSkills = new Set(rows.map(r => r.slug));
  dbSkillCategories = new Map(rows.map(r => [r.slug, r.category_slug]));
  const seqs = await sql`SELECT slug, label FROM career_sequence`;
  dbSequences = new Map(seqs.map(r => [r.slug, r.label]));
  dbNodes = await sql`SELECT sequence_slug, sort, code, title FROM career_node ORDER BY sequence_slug, sort`;
  await sql.end();
} catch (error) {
  errors.push(`无法连接数据库校验技能 slug：${error.message}`);
}

const knownSkills = new Set([...dbSkills, ...newSkills]);
const allCompetencies = new Set(draft.competencies.generic.map(c => c.slug));
for (const list of Object.values(draft.competencies.byTrack)) for (const c of list) allCompetencies.add(c.slug);

let levelCount = 0;
let requirementCount = 0;
let addedCount = 0;
const usedSkills = new Set();
const competencyRefMissing = new Set();
const skillMissing = new Set();

for (const track of draft.tracks) {
  if (dbSequences.size && !dbSequences.has(track.slug)) errors.push(`序列 slug 库内不存在：${track.slug}`);

  const dbLevels = dbNodes.filter(n => n.sequence_slug === track.slug);
  if (dbLevels.length) {
    const draftNames = track.levels.map(l => `${l.code} ${l.name}`).join(' / ');
    const dbNames = dbLevels.map(n => `${n.code} ${n.title}`).join(' / ');
    if (draftNames !== dbNames) errors.push(`${track.slug} 层级与库内不一致：\n    草稿 ${draftNames}\n    库内 ${dbNames}`);
  }

  const seenLevel = new Map(); // skill -> 上一次出现的等级，用于校验「提高要求」是否真的提高
  for (const level of track.levels) {
    const skillsHere = new Set();
    for (const req of level.requirements) {
      usedSkills.add(req.skill);
      if (!knownSkills.has(req.skill)) skillMissing.add(req.skill);
      if (skillsHere.has(req.skill)) errors.push(`${track.slug} ${level.code} 同一技能重复列出：${req.skill}`);
      skillsHere.add(req.skill);
      if (!Number.isInteger(req.level) || req.level < 1 || req.level > 5) errors.push(`${track.slug} ${level.code} ${req.skill} 等级越界：${req.level}`);
      const prev = seenLevel.get(req.skill);
      if (prev != null && req.level <= prev) errors.push(`${track.slug} ${level.code} ${req.skill} 重复要求：上一层已要求 L${prev}，本层写 L${req.level} 应删除`);
      seenLevel.set(req.skill, req.level);
      requirementCount += 1;
      if (req.source === 'added') addedCount += 1;
    }
    if (level.requirements.length < 3) errors.push(`${track.slug} ${level.code} 要求少于 3 项（${level.requirements.length}）`);
    levelCount += 1;
  }
}

for (const [category, comps] of Object.entries(draft.categoryCompetencies)) {
  for (const c of comps) if (!allCompetencies.has(c)) competencyRefMissing.add(`${category} → ${c}`);
}

const trackSlugs = new Set(draft.tracks.map(t => t.slug));
for (const [from, to] of Object.entries(draft.domainMapping ?? {})) {
  if (!trackSlugs.has(to)) errors.push(`domain 映射目标不存在：${from} → ${to}`);
  if (draft.domainUnmapped?.includes(from)) errors.push(`domain 既映射又列为无对应：${from}`);
}

for (const s of skillMissing) errors.push(`技能不存在：${s}`);
for (const c of competencyRefMissing) errors.push(`子能力未定义：${c}`);

const lines = [];
const p = (...args) => lines.push(...args);

p(`# ${draft.meta.name} · ${draft.tracks.length} 条序列 × 4 层职称`, '');
p('> **用途**：M1 数据底座的种子输入，供业务复核后固化进 `mvp_title_track` / `mvp_title_level` / `mvp_title_requirement` / `mvp_competency`。');
p('> **来源文件**：`server/database/seed/standards-draft.json`（本文件由 `scripts/render-standards-draft.mjs` 生成，改内容请改 JSON）');
p(`> **生成时间**：${draft.meta.date}　**标准版本**：${draft.meta.standardVersion}　**标记**：MVP 假定标准（assumed）`, '');
p(`> **范围**：${draft.meta.scope}`, '');
p(`> **口径**：${draft.meta.note}`, '');

p('---', '');
p('## 1. 序列总览', '');
p('| # | 序列 | 名称 | 层级 | 层级数 | 技能要求 | 来源 |');
p('|---|---|---|---|---|---|---|');
draft.tracks.forEach((t, i) => {
  const count = t.levels.reduce((n, l) => n + l.requirements.length, 0);
  p(`| ${i + 1} | \`${t.slug}\` | ${t.name} | ${t.levels.map(l => `${l.code} ${l.name}`).join('<br>')} | ${t.levels.length} | ${count} 条 | ${t.source === 'refined' ? '精编' : 'AI 草稿'} |`);
});
p('');
p(addedCount
  ? `合计 **${draft.tracks.length} 条序列、${levelCount} 个职称层级、${requirementCount} 条技能要求**，其中沿用库内既有 ${requirementCount - addedCount} 条、本次补齐 ${addedCount} 条（标 \`+\`）。`
  : `合计 **${draft.tracks.length} 条序列、${levelCount} 个职称层级、${requirementCount} 条技能要求**，全部沿用库内既有 \`career_node_skill\`，本次不新增、不调等级。`, '');

p('---', '');
p('## 2. 职称层级与技能要求', '');
p('> 每层只列**该层新增或提高的要求**，未列出的技能沿用较低层要求。因此「本次升级 Gap」= 本层要求 − 已满足项，不重复计入下层已满足的技能。', '');
p(addedCount
  ? '> 带 `+` 的是本次补齐项，其余逐条对应库内既有 `career_node_skill`。'
  : '> 每条要求逐条对应库内既有 `career_node_skill`，本次未新增条目。', '');

for (const track of draft.tracks) {
  p(`### ${track.name}（\`${track.slug}\`）`, '');
  p('| 层级 | 本层新增/提高要求 | 条数 | 累计要求 |');
  p('|---|---|---|---|');
  const cumulative = new Map();
  for (const level of track.levels) {
    for (const req of level.requirements) cumulative.set(req.skill, req.level);
    const cell = level.requirements
      .map(r => `${r.skill} \`L${r.level}\`${r.source === 'added' ? ' +' : ''}`)
      .join('、');
    p(`| ${level.code} ${level.name} | ${cell} | ${level.requirements.length} | ${cumulative.size} 项技能 |`);
  }
  p('');
  p(`**累计最低要求**（把本层与以下各层合并后的结果）：`, '');
  const matrix = new Map();
  for (const level of track.levels) for (const req of level.requirements) matrix.set(req.skill, { ...(matrix.get(req.skill) ?? {}), [level.order]: req.level });
  p(`| 技能 | 分类 | ${track.levels.map(l => l.code).join(' | ')} |`);
  p(`|---|---|${track.levels.map(() => '---').join('|')}|`);
  const rows = [...matrix.entries()].sort((a, b) => {
    const lastA = Math.max(...Object.keys(a[1]).map(Number));
    const lastB = Math.max(...Object.keys(b[1]).map(Number));
    return lastB - lastA || a[0].localeCompare(b[0]);
  });
  const running = new Map();
  for (const [skill, byLevel] of rows) {
    const cells = track.levels.map(l => {
      if (byLevel[l.order] != null) { running.set(skill, byLevel[l.order]); return `**L${byLevel[l.order]}**`; }
      return running.has(skill) ? `L${running.get(skill)}` : '—';
    });
    p(`| ${skill} | ${dbSkillCategories.get(skill) ?? '—'} | ${cells.join(' | ')} |`);
  }
  p('');
  p('> 加粗为该层要求有变化，浅色为该层沿用下层要求。', '');
}

p('---', '');
p('## 3. 技能覆盖', '');
if (draft.skillsNew.length === 0 && draft.skillCategoriesNew.length === 0) {
  p('**本次不新增技能、不新增分类。** 三条序列全部落在库内既有 81 项技能上，避免出现「标准里有、系统里没有」的悬空条目。', '');
} else {
  p('| 技能 | 名称 | 归入分类 |');
  p('|---|---|---|');
  for (const s of draft.skillsNew) p(`| \`${s.slug}\` | ${s.name} | \`${s.category}\` |`);
  p('');
  if (draft.skillCategoriesNew.length) {
    p('新增分类：' + draft.skillCategoriesNew.map(c => `\`${c.slug}\`（${c.name}）`).join('、'), '');
  }
}
p(`本草稿引用技能 **${usedSkills.size} 项**（库内共 ${dbSkills.size} 项）。未引用的技能保留在技能池中，员工可自主认证，但不进入职称硬性要求。`, '');

p('---', '');
p('## 4. 子能力库', '');
p('### 4.1 通用子能力', '');
p('| slug | 编码 | 名称 | 定义 |');
p('|---|---|---|---|');
for (const c of draft.competencies.generic) p(`| \`${c.slug}\` | ${c.code} | ${c.name} | ${c.description} |`);
p('');
p('### 4.2 序列专业子能力', '');
p('| 序列 | slug | 编码 | 名称 | 定义 |');
p('|---|---|---|---|---|');
for (const [track, list] of Object.entries(draft.competencies.byTrack)) {
  for (const c of list) p(`| ${track} | \`${c.slug}\` | ${c.code} | ${c.name} | ${c.description} |`);
}
p('');
p('### 4.3 技能 → 子能力映射规则', '');
p('为避免「技能 × 5 级 × N 个子能力」的手工爆炸，映射按**技能分类**统一挂载，生成时对等级 1~5 展开：', '');
p('| 技能分类 | 挂载子能力 |');
p('|---|---|');
for (const [category, comps] of Object.entries(draft.categoryCompetencies)) {
  p(`| ${category} | ${comps.join('、')} |`);
}
p('');
p('规则：某技能的应考子能力 = 该分类子能力 ∪ 所属序列专业子能力；子能力要求等级 = 该职称层对该技能的要求等级。', '');

p('---', '');
p('## 5. 证据要求（按等级统一）', '');
p('| 等级 | 证据组合 |');
p('|---|---|');
for (const [level, items] of Object.entries(draft.evidencePatterns)) {
  p(`| ${level} | ${items.map(i => `${i.description}（${i.type} × ${i.minCount}）`).join('；')} |`);
}
p('');
p('同一证据可支持多个子能力，但不重复累计进度；L1、L2 的自证材料需事实中心评估后才计入。', '');

p('---', '');
p('## 6. 旧 domain 到三序列的映射', '');
p('现有演示数据（`mvp_org_relation.domain` 等）仍带 13 序列时期的取值，按下表归一；这是一次性迁移，M1 种子脚本按目标序列直接写入。', '');
p('| 旧 domain | 归入序列 |');
p('|---|---|');
for (const [from, to] of Object.entries(draft.domainMapping ?? {})) p(`| \`${from}\` | \`${to}\` |`);
p('');
const unmapped = draft.domainUnmapped ?? [];
if (unmapped.length) {
  p(`无对应序列：${unmapped.map(d => `\`${d}\``).join('、')}。当前持有这些 domain 的演示员工共 7 人（销售：唐丽、曹静、冯刚、孔明；产品：谢敏、邓超；项目管理：韩雪），在三序列下没有可归属的专家身份。M1 重写种子时二选一：改岗到三序列内，或保留员工但清空 domain 并标注「超出 MVP 序列范围」。`, '');
}

p('---', '');
p('## 7. 本轮已确认的 4 项', '');
p('| # | 问题 | 结论 |');
p('|---|---|---|');
p('| 1 | 三条序列 T1 同名 | **已改**：`platform` → 初级平台工程师，`ai` → 初级 AI 工程师，`software` 保持初级软件开发工程师；库内 `career_node.title` 由 008 迁移同步 |');
p('| 2 | 每层要求项数 | **每层 4 项**，只保留库内既有 48 条，不做补齐 |');
p('| 3 | 技能等级与职称层的匹配 | **MVP 不追求严格合理性**，沿用既有取值（T3 出现 L3、T4 出现 L5 都可以）。项目版本正式确定后再逐条校准，MVP 只保证流程闭环可验证 |');
p('| 4 | `is_auto` 口径 | **确认**：T1 走技能组合自动核验，T2 及以上走人工审批 + 综合实践说明 |');
p('');
p('> 由此产生的一条实现约定：判断层不得对「等级是否随层级递进」做硬校验，只按本层要求计算，否则后续校准等级时会全部报错。', '');

if (errors.length) {
  p('', '---', '', '## ⚠️ 校验问题', '');
  for (const e of errors) p(`- ${e}`);
} else {
  p('', '---', '', `校验：序列 slug 与库内一致（${dbSequences.size} 条），层级代码与名称与 \`career_node\` 逐条一致，技能 slug 全部可解析（库内 ${dbSkills.size} 项 + 新增 ${newSkills.size} 项），子能力引用完整，等级取值 1~5，同一技能只在等级提高时重复出现。`);
}

const markdown = lines.join('\n') + '\n';
await writeFile(outPath, markdown, 'utf8');
console.log(`已生成 ${outPath.pathname}`);
console.log(`序列 ${draft.tracks.length} · 层级 ${levelCount} · 技能要求 ${requirementCount}（沿用 ${requirementCount - addedCount} / 补齐 ${addedCount}） · 引用技能 ${usedSkills.size} · 子能力 ${allCompetencies.size}`);
if (errors.length) {
  console.error('校验未通过：');
  for (const e of errors) console.error('  - ' + e);
  process.exitCode = 1;
}
