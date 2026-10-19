import { Global, Module, Injectable, Inject, OnApplicationShutdown, CanActivate, ExecutionContext, ForbiddenException, UseGuards } from '@nestjs/common';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export const DRIZZLE_DATABASE = Symbol('DRIZZLE_DATABASE');
const SQL_CLIENT = Symbol('SQL_CLIENT');
@Injectable()
class LocalDemoGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const host = request.headers.host?.split(':')[0];
    const origin = request.headers.origin;
    if (process.env.LOCAL_DEMO !== 'true' || !['localhost', '127.0.0.1'].includes(host)) throw new ForbiddenException('仅允许本机演示访问');
    if (origin && !['http://localhost:5173','http://127.0.0.1:5173','http://localhost:3000','http://127.0.0.1:3000'].includes(origin)) throw new ForbiddenException('不允许的来源');
    return true;
  }
}
// 本地演示访问限制，不代表真实用户登录或业务权限。
export const NeedLogin = () => UseGuards(LocalDemoGuard);
@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly sql: ReturnType<typeof postgres>) {}
  async onApplicationShutdown() { await this.sql.end(); }
}
@Global()
@Module({
  providers: [
    { provide: SQL_CLIENT, useFactory: () => {
      if (!process.env.DATABASE_URL) throw new Error('缺少 DATABASE_URL，请复制 .env.example 为 .env');
      return postgres(process.env.DATABASE_URL, { max: 10 });
    } },
    { provide: DRIZZLE_DATABASE, inject: [SQL_CLIENT], useFactory: (sql: ReturnType<typeof postgres>) => drizzle(sql) },
    DatabaseLifecycle, LocalDemoGuard
  ],
  exports: [DRIZZLE_DATABASE, LocalDemoGuard]
})
export class LocalPlatformModule {}
