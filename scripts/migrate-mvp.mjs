import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

// MVP 表结构迁移：006 建表（幂等）+ 007 决策落地（幂等）
// 两个文件自带事务控制，因此不走外层事务，用 advisory lock 串行化。
const FILES = ['006-mvp-core-schema.sql', '007-mvp-decisions.sql'];
const LOCK_KEY = 17019007;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`;
  for (const name of FILES) {
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
