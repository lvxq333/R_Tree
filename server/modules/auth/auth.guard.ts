import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { assertTrustedOrigin } from '@server/platform/trusted-origin';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path.toLowerCase().replace(/\/+$/, '');
    if (!path.startsWith('/api/')) return true;
    assertTrustedOrigin(request);
    if (path.startsWith('/api/auth/')) return true;
    const token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const user = await this.auth.userFromToken(token);
    if (!user) throw new UnauthorizedException('请先登录');
    // 组队邀请的响应（接受/拒绝）对所有登录用户开放；项目组队方案为管理者工作台能力（员工不可见，HR 与管理者按部门隔离可见）；
    // 梯队与继任仍为 HR 专属数据；人才搜索对所有管理者工作台角色开放（功能统一，员工不可见）
    if (!/^\/api\/team\/invites(\/|$)/.test(path) && /^\/api\/team(\/|$)/.test(path) && user.personnelRole === 'employee')
      throw new ForbiddenException('需要管理者工作台权限');
    if (/^\/api\/succession(\/|$)/.test(path) && user.personnelRole !== 'hr')
      throw new ForbiddenException('需要 HR 权限');
    if (/^\/api\/positions(\/|$)/.test(path) && user.personnelRole === 'employee')
      throw new ForbiddenException('需要管理者工作台权限');
    if (/^\/api\/talent(\/|$)/.test(path) && user.personnelRole === 'employee')
      throw new ForbiddenException('需要管理者工作台权限');
    if (path.startsWith('/api/fact-center/') && user.personnelRole === 'employee')
      throw new ForbiddenException('需要 HR 或 T4 专家权限');
    if (path.startsWith('/api/fact-center/') && request.method !== 'GET' && user.personnelRole !== 'hr')
      throw new ForbiddenException('只有 HR 可以维护员工和事实');
    const factEmployeeMatch=path.match(/^\/api\/fact-center\/employees\/([^/]+)\/facts$/);
    if (factEmployeeMatch && !await this.auth.canViewEmployee(user,factEmployeeMatch[1]))
      throw new ForbiddenException('无权访问该员工事实');
    // 审批动作（决定/发起评审）需要 HR 或 T4 专家权限；催办由申请人本人发起，员工同样可用（服务端按归属校验）
    const isRemind = /^\/api\/approvals\/[^/]+\/remind$/.test(path);
    if (path.startsWith('/api/approvals/') && request.method !== 'GET' && !isRemind && user.personnelRole === 'employee')
      throw new ForbiddenException('需要 HR 或 T4 专家权限');
    const employeeMatch=path.match(/^\/api\/employees\/([^/]+)$/);
    if (employeeMatch && employeeMatch[1] !== 'colleagues' && request.method === 'GET' && !await this.auth.canViewEmployee(user,employeeMatch[1]))
      throw new ForbiddenException('无权访问该员工');
    (request as Request & { authUser?: typeof user }).authUser = user;
    return true;
  }
}
