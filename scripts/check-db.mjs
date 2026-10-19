import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  let total = 0;
  for (const {tablename} of tables) {
    const [{count}] = await sql.unsafe(`SELECT count(*)::int AS count FROM "${tablename}"`);
    total += count; console.log(`${tablename}: ${count}`);
  }
  const json = await sql`SELECT jsonb_typeof(responsibilities) AS responsibilities_type, jsonb_typeof(management_profile) AS management_type FROM employee LIMIT 1`;
  console.log(JSON.stringify({ tables: tables.length, rows: total, jsonTypes: json }));
} finally { await sql.end(); }
