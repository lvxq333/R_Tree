import 'dotenv/config';
import postgres from 'postgres';
import { writeFile } from 'node:fs/promises';

/**
 * 从数据库反向生成 server/database/mvp-schema.ts
 *
 * 为什么要生成而不是手写：mvp_ 前缀一共 34 张表、300 多列，手写容易和 006~009
 * 迁移脱节。以数据库为准生成，改完迁移重跑一次即可保持一致。
 *
 * 用法：npm run db:schema:mvp
 *
 * 说明：
 * - CHECK 约束、部分索引条件不在 Drizzle 里表达，以 SQL 迁移为唯一来源；
 * - 表的列顺序、索引名、外键全部按库内现状输出；
 * - 生成结果带 `auto generated` 标记，不要手改。
 */

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const camel = (s) =>
  s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const pascalHead = (s) => s.charAt(0).toLowerCase() + s.slice(1);

const TABLE_PREFIX = 'mvp_';

const rows = await sql`
  SELECT table_name, column_name, ordinal_position, data_type, udt_name,
         character_maximum_length, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name LIKE 'mvp\\_%'
  ORDER BY table_name, ordinal_position
`;

const indexRows = await sql`
  SELECT c.relname AS table_name,
         i.relname AS index_name,
         ix.indisprimary AS is_primary,
         ix.indisunique AS is_unique,
         array_agg(a.attname ORDER BY k.ord) AS columns
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class c ON c.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
  WHERE n.nspname = 'public' AND c.relname LIKE 'mvp\\_%'
  GROUP BY 1, 2, 3, 4
  ORDER BY c.relname, i.relname
`;

const fkRows = await sql`
  SELECT tc.table_name, kcu.column_name,
         ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
         rc.delete_rule AS on_delete
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public' AND tc.table_name LIKE 'mvp\\_%'
`;

await sql.end();

const tables = new Map();
for (const r of rows) {
  if (!tables.has(r.table_name)) {
    tables.set(r.table_name, { name: r.table_name, columns: [], indexes: [], fks: [] });
  }
  tables.get(r.table_name).columns.push(r);
}

const tableVar = (t) => pascalHead(camel(t));

const primaryOf = new Map();
const singleUnique = new Set();

for (const idx of indexRows) {
  const t = tables.get(idx.table_name);
  if (!t) continue;
  if (idx.is_primary) {
    primaryOf.set(idx.table_name, idx.columns);
    continue;
  }
  if (idx.is_unique && idx.columns.length === 1 && !idx.index_name.startsWith('idx_')) {
    singleUnique.add(`${idx.table_name}.${idx.columns[0]}`);
    continue;
  }
  t.indexes.push(idx);
}

for (const fk of fkRows) {
  const t = tables.get(fk.table_name);
  if (t) t.fks.push(fk);
}

/** 把库里的默认值表达式翻译成 Drizzle 写法；无法识别的返回 null（不写默认值） */
function drizzleDefault(col) {
  const d = col.column_default;
  if (!d) return null;
  if (d === 'gen_random_uuid()') return { chain: '.defaultRandom()', needsSql: false };
  // customType 没有 defaultNow()，只能用 sql 表达式
  if (d === 'now()') return { chain: '.default(sql`now()`)', needsSql: true };
  const str = d.match(/^'([^']*)'::/);
  if (str) return { chain: `.default(${JSON.stringify(str[1])})`, needsSql: false };
  if (d === 'true' || d === 'false') return { chain: `.default(${d})`, needsSql: false };
  if (/^-?\d+$/.test(d)) return { chain: `.default(${d})`, needsSql: false };
  return null;
}

function drizzleType(col) {
  const name = JSON.stringify(col.column_name);
  switch (col.udt_name) {
    case 'varchar':
      return `varchar(${name}${col.character_maximum_length ? `, { length: ${col.character_maximum_length} }` : ''})`;
    case 'text':
      return `text(${name})`;
    case 'uuid':
      return `uuid(${name})`;
    case 'int4':
      return `integer(${name})`;
    case 'int8':
      return `bigint(${name}, { mode: 'number' })`;
    case 'bool':
      return `boolean(${name})`;
    case 'jsonb':
      return `jsonb(${name})`;
    case 'timestamptz':
      return `customTimestamptz(${name})`;
    case 'date':
      return `date(${name})`;
    case 'numeric':
      return `numeric(${name})`;
    default:
      throw new Error(`未支持的列类型 ${col.udt_name}（${col.table_name}.${col.column_name}）`);
  }
}

const sortedTables = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name));
const fkMap = new Map();
const externalTables = new Set();
for (const t of sortedTables) {
  for (const fk of t.fks) {
    fkMap.set(`${t.name}.${fk.column_name}`, fk);
    if (!fk.foreign_table.startsWith(TABLE_PREFIX)) externalTables.add(fk.foreign_table);
  }
}

const out = [];
out.push('/* eslint-disable */');
out.push('/**');
out.push(' * MVP 表结构（mvp_ 前缀，34 张）');
out.push(' *');
out.push(' * auto generated by scripts/gen-mvp-schema.mjs，不要手改。');
out.push(' * 来源：数据库当前结构（006-mvp-core-schema / 007 / 008 / 009 等迁移的结果）。');
out.push(' * 重新生成：npm run db:schema:mvp');
out.push(' *');
out.push(' * 注意：CHECK 约束、部分索引条件只在 SQL 迁移里表达，这里不重复声明；');
out.push(' * 所有 mvp 表均无 _created_by / _updated_by 系统字段，时间列统一用 timestamptz。');
out.push(' */');
out.push("import { bigint, boolean, customType, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';");
out.push("import { sql } from 'drizzle-orm';");
if (externalTables.size) {
  const names = [...externalTables].map((t) => tableVar(t)).sort();
  out.push(`// 外键指向旧表（员工主档仍在 schema.ts 里）`);
  out.push(`import { ${names.join(', ')} } from './schema';`);
}
out.push('');
out.push('export const customTimestamptz = customType<{');
out.push('  data: Date;');
out.push('  driverData: string;');
out.push('}>({');
out.push('  dataType() {');
out.push("    return 'timestamptz';");
out.push('  },');
out.push('  toDriver(value: Date | string) {');
out.push("    return typeof value === 'string' ? value : value.toISOString();");
out.push('  },');
out.push('  fromDriver(value: string | Date): Date {');
out.push('    return value instanceof Date ? value : new Date(value);');
out.push('  },');
out.push('});');
out.push('');

for (const t of sortedTables) {
  const varName = tableVar(t.name);
  const pk = primaryOf.get(t.name);

  out.push(`/** ${t.name} */`);
  out.push(`export const ${varName} = pgTable(${JSON.stringify(t.name)}, {`);

  for (const col of t.columns) {
    const parts = [drizzleType(col)];
    const isPk = pk && pk.length === 1 && pk[0] === col.column_name;
    if (isPk) parts.push('.primaryKey()');
    const def = drizzleDefault(col);
    if (def) parts.push(def.chain);
    if (col.is_nullable === 'NO' && !isPk) parts.push('.notNull()');
    if (singleUnique.has(`${t.name}.${col.column_name}`)) parts.push('.unique()');

    const fk = fkMap.get(`${t.name}.${col.column_name}`);
    if (fk) {
      parts.push(
        `.references(() => ${tableVar(fk.foreign_table)}.${camel(fk.foreign_column)}${fk.on_delete === 'cascade' ? ', { onDelete: \'cascade\' }' : ''})`,
      );
    }

    out.push(`  ${camel(col.column_name)}: ${parts.join('')},`);
  }

  const indexLines = [];
  for (const idx of t.indexes) {
    const cols = idx.columns.map((c) => `table.${camel(c)}`).join(', ');
    const fn = idx.is_unique ? 'uniqueIndex' : 'index';
    indexLines.push(`  ${fn}(${JSON.stringify(idx.index_name)}).on(${cols}),`);
  }

  if (indexLines.length) {
    out.push('}, (table) => [');
    out.push(...indexLines);
    out.push(']);');
  } else {
    out.push('});');
  }
  out.push('');
}

out.push(`export const mvpTables = {`);
for (const t of sortedTables) out.push(`  ${tableVar(t.name)},`);
out.push('};');
out.push('');

await writeFile(new URL('../server/database/mvp-schema.ts', import.meta.url), out.join('\n'), 'utf8');

console.log(`已生成 server/database/mvp-schema.ts`);
console.log(`表 ${sortedTables.length} 张 · 列 ${rows.length} 个 · 索引 ${sortedTables.reduce((n, t) => n + t.indexes.length, 0)} 个 · 外键 ${fkRows.length} 个`);

const missingPk = sortedTables.filter((t) => !primaryOf.get(t.name)).map((t) => t.name);
if (missingPk.length) console.warn('无主键的表：', missingPk.join(', '));
