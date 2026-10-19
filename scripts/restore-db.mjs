import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

export const expectedRows = {
  skill:81, career_node_skill:64, employee_skill:22, employee_trait:15,
  idp_action:13, performance_record:12, skill_event:12, skill_gap:12,
  career_node:16, skill_category:17, talent_candidate:10, skill_level_anchor:10,
  succession_candidate:9, employee_project:9, employee_experience:7,
  idp_milestone:5, career_sequence:4, employee:4, approval:4,
  idp_adjust_rule:4, idp_phase:4, succession_position:4, team_role:4,
  team_assignment:2, idp_plan:1, team_project:1, talent_shortlist_item:0,
};

// Parse SQL literals rather than evaluating or executing exported scripts.
// Audit identities belong to Miaoda; keep the business UUID/slug untouched.
function normalizeExport(source) {
  source = source.replace(/(_(?:created|updated)_by user_profile NULL DEFAULT)\s*CASE[\s\S]*?END/g, '$1 NULL');
  let output = '', jsonFixed = 0, auditCleared = 0;
  for (let i = 0; i < source.length;) {
    if (source.startsWith('--', i)) {
      let end = source.indexOf('\n', i); if (end < 0) end = source.length;
      output += source.slice(i, end); i = end; continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed SQL comment');
      output += source.slice(i, end + 2); i = end + 2; continue;
    }
    const escaped = (source[i] === 'E' || source[i] === 'e') && source[i + 1] === "'" && !/[\w]/.test(source[i-1] || '');
    if (source[i] !== "'" && !escaped) { output += source[i++]; continue; }
    const start = i; i += escaped ? 2 : 1;
    let value = '', closed = false;
    while (i < source.length) {
      if (source[i] === "'") {
        if (source[i+1] === "'") { value += "'"; i += 2; continue; }
        i++; closed = true; break;
      }
      if (escaped && source[i] === '\\') {
        const next = source[++i];
        value += ({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'})[next] ?? next;
        i++; continue;
      }
      value += source[i++];
    }
    if (!closed) throw new Error('Unclosed SQL literal');
    if (/^\s*\(\d+\)$/.test(value)) { output += 'NULL'; auditCleared++; continue; }
    if (escaped) {
      try {
        const outer = JSON.parse(value);
        const inner = typeof outer === 'string' ? JSON.parse(outer) : null;
        if (inner && typeof inner === 'object') {
          output += "'" + JSON.stringify(inner).replaceAll("'", "''") + "'";
          jsonFixed++; continue;
        }
      } catch { /* Non-JSON text is retained byte-for-byte. */ }
    }
    output += source.slice(start, i);
  }
  return { output, jsonFixed, auditCleared };
}

if (!process.env.DATABASE_URL) throw new Error('缺少 DATABASE_URL');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const existing = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (existing.length) throw new Error('目标 public schema 非空，已停止；恢复脚本不会覆盖或删除已有表。');
  const source = await readFile(new URL('../migration/skilltree-full-export.sql', import.meta.url), 'utf8');
  const result = normalizeExport(source);
  // Keep all validation in the export transaction. A failure rolls back the restore.
  const pending = result.output.replace(/COMMIT;\s*$/, '');
  await sql.unsafe(pending);
  let total = 0;
  for (const [table, expected] of Object.entries(expectedRows)) {
    const [{count}] = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
    if (count !== expected) throw new Error(`${table}: expected ${expected}, got ${count}`);
    total += count;
  }
  const columns = await sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND data_type='jsonb'`;
  for (const {table_name, column_name} of columns) {
    const [{count}] = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table_name}" WHERE "${column_name}" IS NOT NULL AND jsonb_typeof("${column_name}") NOT IN ('object','array','null')`);
    if (count) throw new Error(`${table_name}.${column_name}: unexpected JSONB primitive values`);
  }
  await sql.unsafe('COMMIT');
  console.log(`已恢复 27 张表、${total} 条记录；修复 ${result.jsonFixed} 个二次编码 JSON 值；清理 ${result.auditCleared} 个平台审计身份值。`);
} catch (error) {
  await sql.unsafe('ROLLBACK').catch(() => {});
  console.error(error.message); process.exitCode = 1;
} finally { await sql.end(); }
