import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

/**
 * 把 server/database/seed/standards-draft.json 落成 MVP 标准数据。
 *
 * 写入内容：
 * - mvp_competency / mvp_competency_level：21 个子能力 × 5 级锚点与证据要求
 * - mvp_title_track / mvp_title_level / mvp_title_requirement：3 序列 × 4 层 × 48 条要求
 * - mvp_skill_competency：技能 × 等级 → 子能力要求矩阵
 * - mvp_standard_version：v2026-q4，按「专家编写 → 负责人审核 → 管理员发布」三级发布并写快照
 * - mvp_org_relation.domain：旧 domain 归一（java / frontend / … → software / platform / ai）
 *
 * 幂等：可重复执行。层级与要求每次重写，但若已有申请或职称引用该版本层级则拒绝执行，
 * 避免 ON DELETE CASCADE 把演示数据带走。
 *
 * 用法：npm run db:seed:standards
 */

const STANDARD_VERSION = process.env.STANDARD_VERSION ?? 'v2026-q4';
// MVP 没有独立 admin 角色（app_account.access_role 只有 employee / manager），
// 三级发布用三个 manager 账号演示，角色含义写在 change_summary 里。
const CREATED_BY = process.env.STANDARD_CREATED_BY ?? 'li-na';
const REVIEWED_BY = process.env.STANDARD_REVIEWED_BY ?? 'zhang-peng';
const PUBLISHED_BY = process.env.STANDARD_PUBLISHED_BY ?? 'gao-feng';

const LEVEL_POSITION = {
  1: '理解基础，在指导下完成简单任务',
  2: '独立完成常规任务',
  3: '独立分析和解决复杂问题',
  4: '设计系统性方案、制定实践规范并指导团队',
  5: '推动跨团队体系演进，形成可复用方法、工具或标准',
};

const draft = JSON.parse(
  await readFile(new URL('../server/database/seed/standards-draft.json', import.meta.url), 'utf8'),
);

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const log = (...a) => console.log(...a);

/** 校验：所有引用的技能必须在 skill 表存在 */
async function validateSkills() {
  const skillRows = await sql`SELECT slug, name, category_slug FROM skill`;
  const known = new Map(skillRows.map((r) => [r.slug, r]));

  const missing = new Set();
  for (const track of draft.tracks) {
    for (const level of track.levels) {
      for (const req of level.requirements) {
        if (!known.has(req.skill)) missing.add(`${track.slug}/${level.code} → ${req.skill}`);
      }
    }
  }
  if (missing.size) {
    throw new Error(`以下技能在 skill 表中不存在，先补技能再落标准：\n  ${[...missing].join('\n  ')}`);
  }

  const badCategory = [...new Set(skillRows.map((r) => r.category_slug))].filter(
    (c) => !draft.categoryCompetencies[c],
  );
  if (badCategory.length) {
    log(`注意：${badCategory.join('、')} 没有配置子能力，相关技能只挂序列专业子能力`);
  }
  return known;
}

/** 汇总每个技能在某个等级要考哪些子能力 */
function competenciesFor(skillSlug, trackSlug, skillTable) {
  const category = skillTable.get(skillSlug)?.category_slug;
  const fromCategory = (category && draft.categoryCompetencies[category]) || [];
  const fromTrack = draft.competencies.byTrack[trackSlug] ?? [];
  return [...new Set([...fromCategory, ...fromTrack.map((c) => c.slug)])];
}

const skillTable = await validateSkills();

await sql`SELECT pg_advisory_lock(17019009)`;

try {
  await sql.begin(async (tx) => {
    // ---------- 0. 保护：已有数据引用本版本层级时停止 ----------
    const [refs] = await tx`
      SELECT
        (SELECT count(*)::int FROM mvp_application a
           JOIN mvp_title_level l ON l.id = a.target_title_level_id
          WHERE l.standard_version_slug = ${STANDARD_VERSION}) AS applications,
        (SELECT count(*)::int FROM mvp_employee_title t
           JOIN mvp_title_level l ON l.id = t.title_level_id
          WHERE l.standard_version_slug = ${STANDARD_VERSION}) AS titles
    `;
    if (refs.applications > 0 || refs.titles > 0) {
      throw new Error(
        `标准版本 ${STANDARD_VERSION} 已被 ${refs.applications} 条申请、${refs.titles} 条职称引用，` +
          `重写层级会级联删除这些数据。请改用新版本号（STANDARD_VERSION=v2027-q1 npm run db:seed:standards）。`,
      );
    }

    // ---------- 1. 子能力 ----------
    const allCompetencies = [
      ...draft.competencies.generic.map((c) => ({ ...c, kind: 'generic' })),
      ...Object.entries(draft.competencies.byTrack).flatMap(([, list]) =>
        list.map((c) => ({ ...c, kind: 'professional' })),
      ),
    ];

    for (const c of allCompetencies) {
      await tx`
        INSERT INTO mvp_competency (slug, code, name, description, kind, status)
        VALUES (${c.slug}, ${c.code}, ${c.name}, ${c.description ?? null}, ${c.kind}, 'published')
        ON CONFLICT (slug) DO UPDATE SET
          code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description,
          kind = EXCLUDED.kind, status = 'published', updated_at = now()
      `;
    }

    // ---------- 2. 子能力五级锚点与证据要求 ----------
    for (const c of allCompetencies) {
      for (let level = 1; level <= 5; level += 1) {
        const evidence = draft.evidencePatterns[`L${level}`] ?? [];
        const anchor = `${LEVEL_POSITION[level]}。本项要求：${c.description ?? c.name}`;
        await tx`
          INSERT INTO mvp_competency_level
            (competency_slug, level, anchor, evidence_requirement, exam_required)
          VALUES (${c.slug}, ${level}, ${anchor}, ${tx.json(evidence)}, ${level === 2})
          ON CONFLICT (competency_slug, level) DO UPDATE SET
            anchor = EXCLUDED.anchor,
            evidence_requirement = EXCLUDED.evidence_requirement,
            exam_required = EXCLUDED.exam_required,
            updated_at = now()
        `;
      }
    }

    // ---------- 3. 标准版本：draft → reviewing → published ----------
    const effectiveAt = '2026-10-01T00:00:00+08:00';
    await tx`
      INSERT INTO mvp_standard_version
        (slug, version_no, status, effective_at, created_by_employee_slug, reviewed_by_employee_slug,
         published_by_employee_slug, source, change_summary, published_at)
      VALUES (${STANDARD_VERSION}, ${STANDARD_VERSION}, 'draft', ${effectiveAt}, ${CREATED_BY}, NULL, NULL,
              'assumed', ${'MVP 假定标准：3 条技术序列，48 条要求沿用库内既有 career_node_skill'}, NULL)
      ON CONFLICT (slug) DO UPDATE SET
        status = 'draft', published_at = NULL, reviewed_by_employee_slug = NULL,
        published_by_employee_slug = NULL, snapshot = NULL, updated_at = now()
    `;
    await tx`UPDATE mvp_standard_version SET status = 'reviewing', reviewed_by_employee_slug = ${REVIEWED_BY}, updated_at = now() WHERE slug = ${STANDARD_VERSION}`;

    // ---------- 4. 职称序列与层级 ----------
    for (const track of draft.tracks) {
      await tx`
        INSERT INTO mvp_title_track (slug, name, category, path_kind, status)
        VALUES (${track.slug}, ${track.name}, ${track.category}, 'single', 'published')
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, category = EXCLUDED.category, status = 'published', updated_at = now()
      `;
    }

    // 层级重写前先删旧层级（此时已确认无引用），要求随 ON DELETE CASCADE 一起清掉
    await tx`DELETE FROM mvp_title_level WHERE standard_version_slug = ${STANDARD_VERSION}`;

    let requirementCount = 0;
    const skillCompetencyRows = new Map();

    for (const track of draft.tracks) {
      for (const level of track.levels) {
        const [inserted] = await tx`
          INSERT INTO mvp_title_level
            (track_slug, level_order, level_code, name, path_label, standard_version_slug)
          VALUES (${track.slug}, ${level.order}, ${level.code}, ${level.name}, NULL, ${STANDARD_VERSION})
          RETURNING id
        `;

        for (const req of level.requirements) {
          await tx`
            INSERT INTO mvp_title_requirement (title_level_id, skill_slug, required_level, is_auto)
            VALUES (${inserted.id}, ${req.skill}, ${req.level}, ${level.order === 1})
          `;
          requirementCount += 1;

          for (const competencySlug of competenciesFor(req.skill, track.slug, skillTable)) {
            const key = `${req.skill}|${req.level}|${competencySlug}`;
            if (!skillCompetencyRows.has(key)) {
              skillCompetencyRows.set(key, {
                skill: req.skill,
                level: req.level,
                competency: competencySlug,
              });
            }
          }
        }
      }
    }

    // ---------- 5. 技能 × 等级 → 子能力矩阵 ----------
    await tx`DELETE FROM mvp_skill_competency WHERE standard_version_slug = ${STANDARD_VERSION}`;
    for (const row of skillCompetencyRows.values()) {
      await tx`
        INSERT INTO mvp_skill_competency
          (skill_slug, level, competency_slug, required_competency_level, standard_version_slug, weight)
        VALUES (${row.skill}, ${row.level}, ${row.competency}, ${row.level}, ${STANDARD_VERSION}, 1)
        ON CONFLICT (skill_slug, level, competency_slug, standard_version_slug) DO NOTHING
      `;
    }

    // ---------- 6. 发布：写快照 ----------
    const snapshot = {
      version: STANDARD_VERSION,
      generatedAt: new Date().toISOString(),
      source: draft.meta.source,
      note: draft.meta.note,
      tracks: draft.tracks.map((t) => ({
        slug: t.slug,
        name: t.name,
        levels: t.levels.map((l) => ({ code: l.code, name: l.name, order: l.order, requirements: l.requirements })),
      })),
      competencies: allCompetencies,
      evidencePatterns: draft.evidencePatterns,
      domainMapping: draft.domainMapping,
    };

    await tx`
      UPDATE mvp_standard_version
         SET status = 'published', published_by_employee_slug = ${PUBLISHED_BY},
             published_at = now(), snapshot = ${tx.json(snapshot)}, updated_at = now()
       WHERE slug = ${STANDARD_VERSION}
    `;

    // ---------- 7. domain 归一 ----------
    let domainUpdated = 0;
    for (const [from, to] of Object.entries(draft.domainMapping)) {
      const res = await tx`
        UPDATE mvp_org_relation SET domain = ${to}, updated_at = now()
         WHERE domain = ${from} AND domain <> ${to}
      `;
      domainUpdated += res.count;
    }
    for (const leftover of draft.domainUnmapped ?? []) {
      const [row] = await tx`SELECT count(*)::int AS n FROM mvp_org_relation WHERE domain = ${leftover}`;
      if (row.n > 0) {
        throw new Error(`仍有 ${row.n} 条组织关系使用无法归一的 domain ${leftover}，先处理这些员工`);
      }
    }

    // ---------- 8. 校验 ----------
    const [check] = await tx`
      SELECT
        (SELECT count(*)::int FROM mvp_title_track) AS tracks,
        (SELECT count(*)::int FROM mvp_title_level WHERE standard_version_slug = ${STANDARD_VERSION}) AS levels,
        (SELECT count(*)::int FROM mvp_title_requirement r
           JOIN mvp_title_level l ON l.id = r.title_level_id
          WHERE l.standard_version_slug = ${STANDARD_VERSION}) AS requirements,
        (SELECT count(*)::int FROM mvp_competency) AS competencies,
        (SELECT count(*)::int FROM mvp_competency_level) AS competency_levels,
        (SELECT count(*)::int FROM mvp_skill_competency WHERE standard_version_slug = ${STANDARD_VERSION}) AS skill_competencies
    `;

    if (check.tracks !== draft.tracks.length) throw new Error(`序列数量不符：${check.tracks}`);
    if (check.levels !== draft.tracks.length * 4) throw new Error(`层级数量不符：${check.levels}`);
    if (check.requirements !== requirementCount) throw new Error(`要求数量不符：${check.requirements}`);
    if (check.competency_levels !== allCompetencies.length * 5) {
      throw new Error(`子能力等级数量不符：${check.competency_levels}`);
    }

    log('');
    log(`标准版本 ${STANDARD_VERSION} 已发布`);
    log(`  序列 ${check.tracks} · 层级 ${check.levels} · 要求 ${check.requirements}`);
    log(`  子能力 ${check.competencies}（等级锚点 ${check.competency_levels} 条）`);
    log(`  技能子能力矩阵 ${check.skill_competencies} 行`);
    log(`  domain 归一共 ${domainUpdated} 条组织关系`);
    log(`  三级发布：编写 ${CREATED_BY} → 审核 ${REVIEWED_BY} → 发布 ${PUBLISHED_BY}`);
  });
} finally {
  await sql`SELECT pg_advisory_unlock(17019009)`;
  await sql.end();
}
