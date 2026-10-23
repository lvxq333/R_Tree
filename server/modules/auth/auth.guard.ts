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
    if (/^\/api\/(team|talent|succession)(\/|$)/.test(path) && user.personnelRole !== 'hr')
      throw new ForbiddenException('需要 HR 权限');
    if (path.startsWith('/api/fact-center/') && user.personnelRole === 'employee')
      throw new ForbiddenException('需要 HR 或 T4 专家权限');
    if (path.startsWith('/api/fact-center/') && request.method !== 'GET' && user.personnelRole !== 'hr')
      throw new ForbiddenException('只有 HR 可以维护员工和事实');
    const factEmployeeMatch=path.match(/^\/api\/fact-center\/employees\/([^/]+)\/facts$/);
    if (factEmployeeMatch && !await this.auth.canViewEmployee(user,factEmployeeMatch[1]))
      throw new ForbiddenException('无权访问该员工事实');
    if (path.startsWith('/api/approvals/') && request.method !== 'GET' && user.personnelRole === 'employee')
      throw new ForbiddenException('需要 HR 或 T4 专家权限');
    const employeeMatch=path.match(/^\/api\/employees\/([^/]+)$/);
    if (employeeMatch && employeeMatch[1] !== 'colleagues' && request.method === 'GET' && !await this.auth.canViewEmployee(user,employeeMatch[1]))
      throw new ForbiddenException('无权访问该员工');
    (request as Request & { authUser?: typeof user }).authUser = user;
    return true;
  }
}
