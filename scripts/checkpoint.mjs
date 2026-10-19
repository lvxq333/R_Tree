import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Checkpoints never include .env or a live PostgreSQL data directory.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.resolve('.local/recovery', stamp);
mkdirSync(destination, { recursive: true, mode: 0o700 });
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed: ${result.stderr || result.error || result.status}`);
  return result.stdout.trim();
}
const revision = run('git', ['rev-parse', 'HEAD']);
run('git', ['archive', '--format=tar.gz', `--output=${destination}/source.tar.gz`, revision]);
const pg = process.env.PG_BIN_DIR || '/opt/homebrew/opt/postgresql@16/bin';
const connection = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(connection.pathname.slice(1));
const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGDATABASE: database };
run(path.join(pg, 'pg_dump'), ['--format=custom', '--no-owner', '--no-acl', `--file=${destination}/database.dump`], { env });
run(path.join(pg, 'pg_restore'), ['--list', `${destination}/database.dump`]);
const files = Object.fromEntries(['source.tar.gz', 'database.dump'].map(file => [file, createHash('sha256').update(readFileSync(path.join(destination, file))).digest('hex')]));
writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), revision, database, files }, null, 2), { mode: 0o600 });
console.log(`检查点完成：${destination}\n代码版本：${revision}\n恢复请使用 npm run recovery:verify -- <检查点绝对路径>，先在独立数据库演练。`);
