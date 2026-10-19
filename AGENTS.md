# 本地复现维护约定

- 沿用 React、TypeScript、NestJS、Drizzle 与 PostgreSQL；仅本地运行。
- 保留九个页面的原有布局、class 名与 legacy.css；未经要求不扩展原 Demo 的占位功能。
- 业务接口类型集中在 shared/api.interface.ts。
- 前端 API 与日志使用 client/src/lib/runtime.ts；数据库与本机演示限制使用 server/platform/local-platform.ts。
- source_package 为只读原型参考，不修改。
- 不将 .env、数据库内容或运行日志纳入版本控制。
- 验证使用 npm run typecheck、npm run build、数据库恢复校验与必要的页面/接口检查。
