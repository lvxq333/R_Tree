import 'dotenv/config';
import postgres from 'postgres';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const [username, employeeSlug] = process.argv.slice(2).filter(arg => arg !== '--manager');
const accessRole = process.argv.includes('--manager') ? 'manager' : 'employee';
const generated = !process.env.AUTH_ACCOUNT_PASSWORD;
const password = process.env.AUTH_ACCOUNT_PASSWORD || randomBytes(18).toString('base64url');
if (!username || password.length < 12) {
  console.error('用法：npm run auth:create-user -- <用户名> [员工slug] [--manager]；可用 AUTH_ACCOUNT_PASSWORD 指定至少12位密码');
  process.exit(1);
}
const scrypt = promisify(scryptCallback);
const salt = randomBytes(16).toString('hex');
const derived = await scrypt(password, salt, 64);
const hash = `scrypt:${salt}:${derived.toString('hex')}`;
const db = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const rows = await db`INSERT INTO app_account(employee_id, username, password_hash, access_role)
    SELECT id, ${username}, ${hash}, ${accessRole} FROM employee WHERE (${employeeSlug ?? null}::text IS NULL AND is_current_user=true) OR slug=${employeeSlug ?? null}
    ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash,access_role=EXCLUDED.access_role
    WHERE app_account.employee_id=EXCLUDED.employee_id RETURNING username`;
  if (rows.length !== 1) throw new Error('员工不存在，或用户名已绑定其他员工');
  console.log(`本地账号 ${username} 已绑定指定员工，角色：${accessRole}。`);
  if (generated) console.log(`一次性生成密码：${password}`);
} finally { await db.end(); }
