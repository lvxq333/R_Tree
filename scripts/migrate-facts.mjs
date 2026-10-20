import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const migrations = await Promise.all(['001-facts-center.sql','002-mock-fact-sources.sql','003-skill-assessment.sql'].map(name =>
    readFile(new URL(`../server/database/migrations/${name}`, import.meta.url), 'utf8')));
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(17019001)`;
    for (const migration of migrations) await tx.unsafe(migration);
  });
  console.log('事实中心新增表及索引已就绪，原表未修改。');
} finally { await sql.end(); }
