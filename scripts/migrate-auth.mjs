import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const db = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const migrations = await Promise.all(['003-auth.sql','004-employee-accounts.sql'].map(name => readFile(new URL(`../server/database/migrations/${name}`, import.meta.url), 'utf8')));
  await db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(17019003)`;
    for (const migration of migrations) await tx.unsafe(migration);
  });
  console.log('登录账户、外部身份与会话表已就绪。');
} finally { await db.end(); }
