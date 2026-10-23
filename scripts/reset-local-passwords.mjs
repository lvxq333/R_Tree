/**
 * 重置本地演示账号密码
 *
 * 背景：早期 seed-enterprise-data.mjs 使用固定且非 32 位 hex 的 salt
 * （'skilltree-salt-2026'），而 auth.service.login 会校验 salt 是否匹配
 * /^[a-f0-9]{32}$/，不匹配即判定失败，表现为「账号或密码错误」。
 *
 * 本脚本用与 auth.service.register 完全一致的算法（16 字节随机 salt）
 * 重算所有本地演示账号的密码哈希，不影响员工、技能、申请等业务数据。
 *
 * 用法：npm run auth:reset-passwords
 *       AUTH_ACCOUNT_PASSWORD=xxx npm run auth:reset-passwords
 */
import 'dotenv/config';
import postgres from 'postgres';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
// 本地演示环境统一口令（与 seed-employee-directory.mjs 的 DEMO_ACCOUNT_PASSWORD 默认值保持一致）
const password = process.env.AUTH_ACCOUNT_PASSWORD || '123456';

if (password.length < 6) {
  console.error('密码需至少 6 位');
  process.exit(1);
}

const db = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const accounts = await db`SELECT id, username FROM app_account ORDER BY username`;
  if (accounts.length === 0) {
    console.log('没有找到账号，请先执行 npm run db:seed:mvp');
    process.exit(0);
  }

  await db.begin(async tx => {
    for (const account of accounts) {
      const salt = randomBytes(16).toString('hex');
      const derived = await scrypt(password, salt, 64);
      await tx`UPDATE app_account SET password_hash=${`scrypt:${salt}:${derived.toString('hex')}`}
        WHERE id=${account.id}`;
    }
    // 密码变更后清理旧会话，避免旧 token 继续有效
    await tx`DELETE FROM app_session`;
  });

  console.log(`已重置 ${accounts.length} 个账号密码，统一密码：${password}`);
  console.log('示例账号：' + accounts.slice(0, 5).map(a => a.username).join('、'));
} finally {
  await db.end();
}
