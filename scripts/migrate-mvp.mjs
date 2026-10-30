import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

// 表结构迁移不再执行历史 009：它会删除非技术序列员工，与当前 HR 名录冲突。
// 其余文件均可重复执行，用 advisory lock 串行化。
const FILES = [
  '006-mvp-core-schema.sql',
  '007-mvp-decisions.sql',
  '008-title-level-names.sql',
  '010-legacy-migration-support.sql',
  '011-clean-orphan-employee-refs.sql',
  '012-idp-workspace.sql',
  '013-skill-pool-approval-sync.sql',
  '014-employee-fact-center.sql',
  '015-employee-directory.sql',
  '016-hr-career.sql',
  '017-hr-title-track.sql',
  '018-title-track-pipeline.sql',
  '020-position-management.sql',
  '021-skill-standards.sql',
  '022-position-requirements.sql',
  '023-talent-workspace.sql',
  '024-key-position.sql',
  '025-team-real-roster.sql',
  '026-team-multi-plan.sql',
  '027-team-role-members.sql',
  '028-team-response-source.sql',
  '029-team-history.sql',
  '019-approval-reminder.sql',
  '030-feishu-integration.sql',
];
const LOCK_KEY = 17019007;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`;
  // 025/026 包含一次性的演示数据清理，已有多方案结构时禁止重放。
  const [teamPlans] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='team_project' AND column_name='department') AS installed`;
  for (const name of FILES) {
    if (teamPlans.installed && ['025-team-real-roster.sql', '026-team-multi-plan.sql'].includes(name)) {
      console.log(`已保留现有组队方案，跳过历史初始化 ${name}`);
      continue;
    }
    const text = await readFile(new URL(`../server/database/migrations/${name}`, import.meta.url), 'utf8');
    await sql.unsafe(text);
    console.log(`已应用 ${name}`);
  }

  const [{ count: tableCount }] = await sql`
    SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'mvp\_%'`;
  const [level] = await sql`
    SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conname = 'mvp_title_level_level_order_check'`;
  const appealCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'mvp_appeal' AND column_name IN ('decided_kind', 'ai_rejudge')
    ORDER BY column_name`;
  const versionCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'mvp_standard_version'
      AND column_name IN ('source', 'published_by_employee_slug', 'published_at')
    ORDER BY column_name`;

  console.log(`mvp 表数量：${tableCount}`);
  console.log(`职称层级约束：${level?.def ?? '缺失'}`);
  console.log(`申诉新增列：${appealCols.map(r => r.column_name).join(', ') || '缺失'}`);
  console.log(`标准版本新增列：${versionCols.map(r => r.column_name).join(', ') || '缺失'}`);
} finally {
  await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`;
  await sql.end();
}
