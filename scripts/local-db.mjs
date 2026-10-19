import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const runtime = path.join(root, '.local');
const data = path.join(runtime, 'pgdata');
const bin = [process.env.PG_BIN_DIR, '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin'].filter(Boolean).find(p => existsSync(path.join(p, 'pg_ctl')));
if (!bin) throw new Error('未找到 PostgreSQL 16；安装后重试，或运行 npm run db:start:docker。');
const run = (name, args, options = {}) => {
  const result = spawnSync(path.join(bin, name), args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} 执行失败（${result.status}）`);
};
process.env.PGPASSWORD = 'skilltree_local_demo';
const action = process.argv[2] || 'start';
if (action === 'stop') {
  if (existsSync(path.join(data, 'postmaster.pid'))) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  process.exit(0);
}
if (action !== 'start') throw new Error('仅支持 start / stop');
mkdirSync(runtime, { recursive: true });
if (!existsSync(path.join(data, 'PG_VERSION'))) {
  const passwordFile = path.join(runtime, 'init-password');
  writeFileSync(passwordFile, 'skilltree_local_demo\n', { mode: 0o600 });
  try { run('initdb', ['-D', data, '-U', 'skilltree', '--encoding=UTF8', '--locale=C', '--auth-local=trust', '--auth-host=scram-sha-256', `--pwfile=${passwordFile}`]); }
  finally { unlinkSync(passwordFile); }
}
const status = spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, 'status'], { stdio: 'ignore' });
if (status.status !== 0) run('pg_ctl', ['-D', data, '-l', path.join(runtime, 'postgres.log'), '-o', `-h 127.0.0.1 -p 55432 -k ''`, '-w', 'start']);
const check = spawnSync(path.join(bin, 'psql'), ['-h', '127.0.0.1', '-p', '55432', '-U', 'skilltree', '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname='skilltree'"], { encoding: 'utf8' });
if (check.status !== 0) throw new Error(check.stderr || '数据库连接检查失败');
if (check.stdout.trim() !== '1') run('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'skilltree', 'skilltree']);
console.log('PostgreSQL 已运行：127.0.0.1:55432；数据保存在 .local/pgdata');
