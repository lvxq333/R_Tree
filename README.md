# 技能树 · 本地复现

保留原 React 19 / NestJS 10 / PostgreSQL 技术栈和九个页面；原有占位按钮、固定统计和演示推荐不作为新增功能实现。本项目仅供本机演示，不具备生产登录或员工数据权限体系。

## 环境

Node.js 22+、npm 10+，以及 PostgreSQL 16（Homebrew 安装：`brew install postgresql@16`）。后端固定监听 127.0.0.1，数据库只监听本机 55432 端口，数据保存在本项目 `.local/pgdata`。示例数据库口令仅用于独立本机演示。

## 首次运行

```sh
cp .env.example .env
npm install
npm run db:start
npm run db:restore
npm run build
npm start
```

访问 http://127.0.0.1:3000 。`db:start` 会创建并启动独立数据库。`db:restore` 只接受空 public schema，不会覆盖已有数据。恢复原始 27 表、346 行；原 UUID 与 slug 保留，旧平台审计身份置空，修正 SQL 导出中二次编码的 JSONB。原始导出保存在 migration/，恢复脚本不修改原文件。平台 RLS 策略维持注释状态，不能用作正式权限实现。

## 日常开发

```sh
npm run db:start
npm run dev
```

打开 http://127.0.0.1:5173 。前端热更新；修改后端后重启 `npm run dev`。已有数据库不要重复执行恢复命令。

`npm run typecheck` 检查类型；`npm run build` 检查并构建；`npm run db:check` 核对数据库。`Ctrl+C` 停止应用，`npm run db:stop` 停止本项目数据库并保留数据。也保留了 Docker 方案：引擎可用时可用 `npm run db:start:docker` 启动相同端口的数据库；两种方案不能同时使用该端口。

## 迁移范围

- 替换妙搭 Vite/TypeScript preset、应用容器、日志、axios 包装和数据库注入。
- 写接口的 NeedLogin 改为明确的本机演示限制，未伪装成真实登录；不开放网络部署。
- 保留已有页面与业务接口、数据库类型和演示场景。
- 原导出包仍在上级项目清单目录。原 source_package 为参考快照，不修改。
