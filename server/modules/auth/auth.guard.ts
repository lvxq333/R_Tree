import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path.toLowerCase().replace(/\/+$/, '');
    if (!path.startsWith('/api/')) return true;
    const host = request.headers.host?.split(':')[0];
    if (process.env.LOCAL_DEMO !== 'true' || !host || !['localhost', '127.0.0.1'].includes(host)) throw new ForbiddenException('仅允许本机演示访问');
    const origin = request.headers.origin;
    const allowedPorts = ['5173', String(Number(process.env.SERVER_PORT || 3000))];
    if (origin && !allowedPorts.some(port => origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`)) throw new ForbiddenException('不允许的来源');
    if (path.startsWith('/api/auth/')) return true;
    const token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const user = await this.auth.userFromToken(token);
    if (!user) throw new UnauthorizedException('请先登录');
    const managerOnly = /^\/api\/(team|talent|succession)(\/|$)/.test(path)
      || (path.startsWith('/api/approvals/') && request.method !== 'GET');
    if (managerOnly && user.accessRole !== 'manager') throw new ForbiddenException('需要管理者权限');
    if (user.accessRole !== 'manager' && request.method === 'GET' && path.startsWith('/api/employees/')
      && path !== '/api/employees/current/workspace'
      && path !== `/api/employees/${user.employeeSlug.toLowerCase()}`) throw new ForbiddenException('只能访问自己的员工信息');
    (request as Request & { authUser?: typeof user }).authUser = user;
    return true;
  }
}
