import { AsyncLocalStorage } from 'node:async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthUser } from '@shared/api.interface';

// 每个请求独立保存身份，禁止使用全局“当前员工”标记或客户端传入的员工 ID。
export const employeeScope = new AsyncLocalStorage<AuthUser>();
export function currentEmployee(): AuthUser {
  const user = employeeScope.getStore();
  if (!user) throw new UnauthorizedException('缺少当前登录员工身份');
  return user;
}

@Injectable()
export class EmployeeContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest().authUser as AuthUser | undefined;
    if (!user) return next.handle();
    return new Observable(subscriber => employeeScope.run(user, () => next.handle().subscribe(subscriber)));
  }
}
