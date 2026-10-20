import 'dotenv/config';
import postgres from 'postgres';
import { readFile, writeFile } from 'node:fs/promises';

const draftPath = new URL('../server/database/seed/standards-draft.json', import.meta.url);
const outPath = new URL('../docs/m1-standards-draft.md', import.meta.url);
const draft = JSON.parse(await readFile(draftPath, 'utf8'));

const errors = [];
const newSkills = new Set(draft.skillsNew.map(s => s.slug));

let dbSkills = new Set();
try {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const rows = await sql`SELECT slug FROM skill`;
  dbSkills = new Set(rows.map(r => r.slug));
  await sql.end();
} catch (error) {
  errors.push(`无法连接数据库校验技能 slug：${error.message}`);
}

const knownSkills = new Set([...dbSkills, ...newSkills]);
const allCompetencies = new Set(draft.competencies.generic.map(c => c.slug));
for (const list of Object.values(draft.competencies.byTrack)) for (const c of list) allCompetencies.add(c.slug);

let levelCount = 0;
let requirementCount = 0;
let competencyRefMissing = new Set();
let skillMissing = new Set();

for (const track of draft.tracks) {
  const paths = track.requirementsByPath
    ? Object.entries(track.requirementsByPath)
    : [[null, track.requirements]];

  for (const [label, requirements] of paths) {
    for (const req of requirements) {
      if (!knownSkills.has(req.skill)) skillMissing.add(req.skill);
      if (req.levels.length !== 4) errors.push(`${track.slug}/${label ?? '-'} ${req.skill} 层数不是 4`);
      if (req.levels.every(v => v == null)) errors.push(`${track.slug} ${req.skill} 全为空`);
      for (const v of req.levels) if (v != null && (v < 1 || v > 5)) errors.push(`${track.slug} ${req.skill} 等级越界：${v}`);
      requirementCount += req.levels.filter(v => v != null).length;
    }
  }
  levelCount += track.levels.length;
}

for (const [category, comps] of Object.entries(draft.categoryCompetencies)) {
  for (const c of comps) if (!allCompetencies.has(c)) competencyRefMissing.add(`${category} → ${c}`);
}

for (const s of skillMissing) errors.push(`技能不存在：${s}`);
for (const c of competencyRefMissing) errors.push(`子能力未定义：${c}`);

const lines = [];
const p = (...args) => lines.push(...args);

p('# M1 标准草稿 v0.1 · 13 条序列 × 4 层职称', '');
p('> **用途**：M1 数据底座的种子输入，供业务复核后固化进 `mvp_title_track` / `mvp_title_level` / `mvp_title_requirement` / `mvp_competency`。');
p('> **来源文件**：`server/database/seed/standards-draft.json`（本文件由 `scripts/render-standards-draft.mjs` 生成，改内容请改 JSON）');
p(`> **生成时间**：${draft.meta.date}　**标准版本**：${draft.meta.standardVersion}　**标记**：MVP 假定标准（assumed）`, '');
p('> 层级名称与技能矩阵为通用草稿，未经公司制度确认。`java` / `data-analysis` / `sales` 三条标为精编口径，其余 10 条为 AI 草稿口径。', '');

p('---', '');
p('## 1. 序列总览', '');
p('| # | 序列 | 名称 | 类别 | 路径 | 层级数 | 来源 |');
p('|---|---|---|---|---|---|---|');
draft.tracks.forEach((t, i) => {
  const pathLabel = t.pathKind === 'dual' ? '双路径（专业/管理）' : '单路径';
  p(`| ${i + 1} | \`${t.slug}\` | ${t.name} | ${t.category} | ${pathLabel} | ${t.levels.length} | ${t.source === 'refined' ? '精编' : 'AI 草稿'} |`);
});
p('');
p(`合计 **${draft.tracks.length} 条序列、${levelCount} 个职称层级、${requirementCount} 条技能要求**（null 不计）。`, '');

p('---', '');
p('## 2. 职称层级与技能要求', '');
p('> 单元格为该层要求的最低技能等级；`—` 表示该层不要求此技能。技能名后的 `*` 为本次新增技能。', '');

for (const track of draft.tracks) {
  p(`### ${track.name}（\`${track.slug}\`）`, '');
  const paths = track.requirementsByPath ? Object.keys(track.requirementsByPath) : [null];

  for (const label of paths) {
    if (label) p(`**${label}路径**`, '');
    const levels = label ? track.levels.filter(l => (l.pathLabel ?? null) === label) : track.levels;
    const requirements = label ? track.requirementsByPath[label] : track.requirements;

    p(`| 技能 | ${levels.map(l => `${l.code} ${l.name}`).join(' | ')} |`);
    p(`|---|${levels.map(() => '---').join('|')}|`);
    const rows = [...requirements].sort((a, b) => (b.levels[3] ?? 0) - (a.levels[3] ?? 0));
    for (const req of rows) {
      const name = `${req.skill}${newSkills.has(req.skill) ? ' *' : ''}`;
      p(`| ${name} | ${req.levels.map(v => (v == null ? '—' : `L${v}`)).join(' | ')} |`);
    }
    p('');
  }
}

p('---', '');
p('## 3. 新增技能与分类', '');
p('现有 81 项技能集中在机器人、自动驾驶、平台与 AI 方向，销售、客户成功、前端、产品缺少对应技能，因此新增以下条目。', '');
p('| 技能 | 名称 | 归入分类 |');
p('|---|---|---|');
for (const s of draft.skillsNew) p(`| \`${s.slug}\` | ${s.name} | ${s.category} |`);
p('');
p('新增分类：' + draft.skillCategoriesNew.map(c => `\`${c.slug}\`（${c.name}）`).join('、'), '');
p(`新增技能合计 **${draft.skillsNew.length} 项**，技能总量 81 → ${81 + draft.skillsNew.length}。`, '');

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
p('为避免「81 项技能 × 5 级 × N 个子能力」的手工爆炸，映射按**技能分类**统一挂载，生成时对等级 1~5 展开：', '');
p('| 技能分类 | 挂载子能力 |');
p('|---|---|');
for (const [category, comps] of Object.entries(draft.categoryCompetencies)) {
  p(`| ${category} | ${comps.join('、')} |`);
}
p('');
p('规则：某技能的应考子能力 = 该分类子能力 ∪ 所属序列专业子能力；子能力要求等级 = 该职称层对该技能的要求等级（同层对齐）。', '');

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
p('## 6. 需要你确认的 5 件事', '');
p('1. **层级名称**：`T1~T4` 的「初级/中级/高级/资深」是否可作为公司口径？销售用了 `P1~P4` + `M1~M4` 双路径，是否符合实际职级体系？');
p('2. **新增 12 项技能**：销售 4 项、客户成功 3 项、产品 2 项、前端 2 项、Python 1 项，是否都保留？有没有公司已有的叫法需要对齐？');
p('3. **技能矩阵的等级节奏**：核心技能 `L2→L3→L4→L5` 逐层递增、支撑技能 `L1→L2→L3→L4`，这个节奏是否偏严或偏松？');
p('4. **销售双路径**：专业线与管理线的层级名称、以及管理线从哪一层开始带团队（现在是 M1 销售主管起）是否合适？');
p('5. **`is_auto` 口径**：草稿把 T1 的处理为「技能组合自动核验」，T2 及以上走人工审批 + 综合实践说明。确认这个切分是否符合制度预期。');

if (errors.length) {
  p('', '---', '', '## ⚠️ 校验问题', '');
  for (const e of errors) p(`- ${e}`);
} else {
  p('', '---', '', `校验：技能 slug 全部可解析（库内 ${dbSkills.size} 项 + 新增 ${newSkills.size} 项），子能力引用完整，等级取值均在 1~5。`);
}

const markdown = lines.join('\n') + '\n';
await writeFile(outPath, markdown, 'utf8');
console.log(`已生成 ${outPath.pathname}`);
console.log(`序列 ${draft.tracks.length} · 层级 ${levelCount} · 技能要求 ${requirementCount} · 子能力 ${allCompetencies.size} · 新增技能 ${newSkills.size}`);
if (errors.length) {
  console.error('校验未通过：');
  for (const e of errors) console.error('  - ' + e);
  process.exitCode = 1;
}
