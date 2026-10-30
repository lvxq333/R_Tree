import { ForbiddenException } from '@nestjs/common';

/** The deployed pilot remains on loopback, accessed through an encrypted SSH tunnel. */
export function assertTrustedOrigin(request: { headers: { host?: string; origin?: string } }) {
  const serverPort = String(Number(process.env.SERVER_PORT || 3000));
  const local = process.env.LOCAL_DEMO === 'true';
  const deployed = process.env.DEPLOYMENT_MODE === 'server';
  if (!local && !deployed) throw new ForbiddenException('服务尚未配置访问方式');
  const allowed = new Set([`http://127.0.0.1:${serverPort}`, `http://localhost:${serverPort}`]);
  if (local) { allowed.add('http://127.0.0.1:5173'); allowed.add('http://localhost:5173'); }
  if (deployed && process.env.AUTH_APP_URL) {
    const url = new URL(process.env.AUTH_APP_URL);
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) allowed.add(url.origin);
  }
  const host = request.headers.host;
  if (!host || ![...allowed].some(origin => new URL(origin).host === host)) throw new ForbiddenException('不允许的访问地址');
  if (request.headers.origin && !allowed.has(request.headers.origin)) throw new ForbiddenException('不允许的来源');
}
