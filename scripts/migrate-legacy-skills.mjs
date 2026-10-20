import 'dotenv/config';
import postgres from 'postgres';
import { createHash } from 'node:crypto';

/**
 * 旧等级迁移：employee_skill → mvp_employee_skill / mvp_employee_competency
 *
 * 规则（D12）：
 * - 只迁移 status='approved' 且员工、技能都还在库里的记录；
 * - 等级直接沿用旧值，不重新评估，来源标 migrated；
 * - 子能力只在技能有标准矩阵时推导：取该技能 ≤ 员工等级 的所有子能力要求，
 *   按子能力取最高要求等级；没有矩阵的技能只迁技能等级（留在技能池）；
 * - 员工或技能已不存在的旧记录原样留在旧表，不写入新表。
 *
 * 幂等：ON CONFLICT DO NOTHING，不覆盖已有申请产生的认证。
 * 用法：npm run db:migrate:legacy-skills
 */

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const STANDARD_VERSION = process.env.STANDARD_VERSION ?? 'v2026-q4';

/** slug 上限 64 字符，超长时退化为 md5 前缀 */
function safeSlug(prefix, parts) {
  const raw = [prefix, ...parts].join('-');
  if (raw.length <= 64) return raw;
  return `${prefix}-${createHash('md5').update(raw).digest('hex').slice(0, 24)}`;
}

const employees = new Set((await sql`SELECT slug FROM employee`).map((r) => r.slug));
const skills = new Set((await sql`SELECT slug FROM skill`).map((r) => r.slug));

const matrix = await sql`
  SELECT skill_slug, level, competency_slug, required_competency_level
    FROM mvp_skill_competency
   WHERE standard_version_slug = ${STANDARD_VERSION}
`;
const matrixBySkill = new Map();
for (const row of matrix) {
  if (!matrixBySkill.has(row.skill_slug)) matrixBySkill.set(row.skill_slug, []);
  matrixBySkill.get(row.skill_slug).push(row);
}

const legacy = await sql`
  SELECT employee_slug, skill_slug, current_level, status, _updated_at
    FROM employee_skill
   WHERE status = 'approved' AND skill_slug IS NOT NULL AND current_level IS NOT NULL
   ORDER BY employee_slug, skill_slug
`;

const skipped = { employee: [], skill: [], level: [] };
let skillInserted = 0;
let competencyInserted = 0;
const mapped = [];

for (const row of legacy) {
  const level = Number(row.current_level);
  if (!employees.has(row.employee_slug)) {
    skipped.employee.push(`${row.employee_slug}/${row.skill_slug}`);
    continue;
  }
  if (!skills.has(row.skill_slug)) {
    skipped.skill.push(`${row.employee_slug}/${row.skill_slug}`);
    continue;
  }
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    skipped.level.push(`${row.employee_slug}/${row.skill_slug}=${row.current_level}`);
    continue;
  }

  const certifiedAt = row._updated_at ?? new Date();

  const res = await sql`
    INSERT INTO mvp_employee_skill
      (slug, employee_slug, skill_slug, level, certified_at, source, source_application_slug, status)
    VALUES (${safeSlug('mig', [row.employee_slug, row.skill_slug, `l${level}`])},
            ${row.employee_slug}, ${row.skill_slug}, ${level}, ${certifiedAt}, 'migrated', NULL, 'active')
    ON CONFLICT (employee_slug, skill_slug, level) DO NOTHING
  `;
  skillInserted += res.count;

  // 子能力：取该技能 1..level 的全部要求，按子能力合并到最高要求等级
  const rows = (matrixBySkill.get(row.skill_slug) ?? []).filter((r) => r.level <= level);
  const required = new Map();
  for (const r of rows) {
    const prev = required.get(r.competency_slug) ?? 0;
    required.set(r.competency_slug, Math.max(prev, r.required_competency_level));
  }

  for (const [competencySlug, requiredLevel] of required) {
    const inserted = await sql`
      INSERT INTO mvp_employee_competency
        (slug, employee_slug, competency_slug, level, certified_at, certified_via,
         source, source_application_slug, status)
      VALUES (${safeSlug('mig', [row.employee_slug, competencySlug, `l${requiredLevel}`])},
              ${row.employee_slug}, ${competencySlug}, ${requiredLevel}, ${certifiedAt},
              'migrated', 'migrated', NULL, 'active')
      ON CONFLICT (employee_slug, competency_slug, level) DO NOTHING
    `;
    competencyInserted += inserted.count;
  }

  mapped.push(`${row.employee_slug} ${row.skill_slug} L${level} → 子能力 ${required.size} 项`);
}

await sql.end();

console.log('');
console.log(`旧认证记录 ${legacy.length} 条，映射完成 ${mapped.length} 条`);
console.log(`  mvp_employee_skill 新增 ${skillInserted} · mvp_employee_competency 新增 ${competencyInserted}`);
if (mapped.length) {
  console.log('');
  for (const line of mapped) console.log(`  ${line}`);
}
const skipTotal = skipped.employee.length + skipped.skill.length + skipped.level.length;
if (skipTotal) {
  console.log('');
  console.log(`跳过 ${skipTotal} 条（旧表记录保留不动）：`);
  if (skipped.employee.length) console.log(`  员工已不存在：${skipped.employee.join('、')}`);
  if (skipped.skill.length) console.log(`  技能已不存在：${skipped.skill.join('、')}`);
  if (skipped.level.length) console.log(`  等级无��：${skipped.level.join('、')}`);
}
