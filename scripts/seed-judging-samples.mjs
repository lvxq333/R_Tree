/**
 * 补齐判断层演示数据（幂等）
 *
 * 只补 mvp_employee_skill 与 mvp_learning_resource，不重建库、不动员工与标准。
 * 用于 M1 之后给存量库补出「可申请 / 只差一项」的达标样本，以及 Gap 对应的学习资源，
 * 让 M2 的判定、资源推荐有数据可看。
 *
 * 用法：npm run db:seed:judging
 */
import 'dotenv/config';
import postgres from 'postgres';
import { JUDGING_SAMPLE_EXPECTATION, JUDGING_SAMPLE_RESOURCES, JUDGING_SAMPLE_SKILLS } from './judging-samples.mjs';

const db = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const skillSlugs = new Set((await db`SELECT slug FROM skill`).map(row => row.slug));
  const employeeSlugs = new Set((await db`SELECT slug FROM employee`).map(row => row.slug));
  const competencySlugs = new Set((await db`SELECT slug FROM mvp_competency`).map(row => row.slug));

  const unknownSkills = [...new Set(JUDGING_SAMPLE_SKILLS.map(item => item.skill).filter(slug => !skillSlugs.has(slug)))];
  const unknownEmployees = [...new Set(JUDGING_SAMPLE_SKILLS.map(item => item.employee).filter(slug => !employeeSlugs.has(slug)))];
  const unknownCompetencies = [...new Set(JUDGING_SAMPLE_RESOURCES.flatMap(item => item.targets).filter(slug => !competencySlugs.has(slug)))];
  if (unknownSkills.length > 0) throw new Error(`skill 表缺少技能：${unknownSkills.join(', ')}`);
  if (unknownEmployees.length > 0) throw new Error(`employee 表缺少员工：${unknownEmployees.join(', ')}`);
  if (unknownCompetencies.length > 0) throw new Error(`mvp_competency 缺少子能力：${unknownCompetencies.join(', ')}`);

  let insertedSkills = 0;
  let insertedResources = 0;
  await db.begin(async tx => {
    for (const item of JUDGING_SAMPLE_SKILLS) {
      const slug = `${item.employee}-${item.skill}-l${item.level}`;
      const rows = await tx`
        INSERT INTO mvp_employee_skill(slug, employee_slug, skill_slug, level, certified_at, source, status)
        VALUES(${slug}, ${item.employee}, ${item.skill}, ${item.level}, ${item.certifiedAt}::timestamptz, 'initial-seed', 'active')
        ON CONFLICT (employee_slug, skill_slug, level) DO NOTHING
        RETURNING id`;
      insertedSkills += rows.length;
    }

    for (const item of JUDGING_SAMPLE_RESOURCES) {
      // 注意：postgres.js 直连时传 JSON 字符串会被再包一层（存成 string 而非 array），
      // 必须用 sql.json() 编码；DO UPDATE 让重跑时能覆盖历史上写坏的数据。
      const rows = await tx`
        INSERT INTO mvp_learning_resource(slug, kind, title, description, url, targets_competency_slugs, estimated_effort, evidence_template, is_demo, status)
        VALUES(${item.slug}, ${item.kind}, ${item.title}, ${item.description}, ${item.url ?? null},
               ${db.json(item.targets)}::jsonb, ${item.estimatedEffort ?? null}, ${item.evidenceTemplate ?? null}, true, 'active')
        ON CONFLICT (slug) DO UPDATE SET
          kind=EXCLUDED.kind, title=EXCLUDED.title, description=EXCLUDED.description, url=EXCLUDED.url,
          targets_competency_slugs=EXCLUDED.targets_competency_slugs, estimated_effort=EXCLUDED.estimated_effort,
          evidence_template=EXCLUDED.evidence_template, is_demo=true, status='active', updated_at=now()
        RETURNING id`;
      insertedResources += rows.length;
    }
  });

  console.log(`判断层样本：新增 ${insertedSkills} 条认证（共 ${JUDGING_SAMPLE_SKILLS.length} 条）、${insertedResources} 条学习资源（共 ${JUDGING_SAMPLE_RESOURCES.length} 条），已存在的跳过`);
  console.log('预期判定：');
  for (const row of JUDGING_SAMPLE_EXPECTATION) {
    console.log(`  ${row.employee.padEnd(11)} ${row.track}/${row.level}  ${row.state.padEnd(9)} ${row.detail}`);
  }
} finally {
  await db.end();
}

