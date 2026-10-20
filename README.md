# 技能树 · 本地复现

保留原 React 19 / NestJS 10 / PostgreSQL 技术栈和九个页面；原有占位按钮、固定统计和演示推荐不作为新增功能实现。本项目仅供本机演示，已支持本地员工账号、注册和个人数据隔离，仍仅在本机运行。

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

运行 `npm run db:migrate:auth` 后，用 `npm run auth:create-user -- zhangsan` 为当前演示员工创建本地账号；命令会生成一次性密码。已有账号可用 `AUTH_ACCOUNT_PASSWORD` 环境变量指定新密码并运行同一命令。然后访问 http://127.0.0.1:3000 。`db:start` 会创建并启动独立数据库。`db:restore` 只接受空 public schema，不会覆盖已有数据。恢复原始 27 表、346 行；原 UUID 与 slug 保留，旧平台审计身份置空，修正 SQL 导出中二次编码的 JSONB。原始导出保存在 migration/，恢复脚本不修改原文件。平台 RLS 策略维持注释状态，不能用作正式权限实现。

## 登录接入

左下角的账户按钮可退出、切换账号，并在配置飞书后绑定飞书身份。飞书开放平台自建应用需在安全设置中登记 `FEISHU_REDIRECT_URI`，然后在 `.env` 填写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_REDIRECT_URI`；开发服务器使用 5173 端口时还需设置 `AUTH_APP_URL=http://127.0.0.1:5173/`。先用本地账号登录并绑定飞书，之后才可用飞书直接登录。飞书用户的 `open_id` 与租户标识映射到本地账号；不通过姓名或邮箱自动关联。公司 SSO 协议尚未确定，入口会显示待接入。员工身份由服务端会话确定，工作台、技能、成长、发展计划、事实及评估材料按员工归属读取。新账号默认是员工角色，只能读取自己的个人数据；管理者账号可访问组织工作台。飞书消息、审批及权限同步尚未接入。

## 员工账号与注册

新员工可在登录页点击“新员工？注册账号”，填写姓名、账号、密码以及可选的部门、岗位、入职日期。注册在同一个事务中创建 `employee` 员工档案、`app_account` 账号、`mvp_fact_employee` 事实中心基本信息登记和会话；不会生成项目、绩效、技能、成长轨迹、IDP 或模拟工作事实。姓名允许重名，不通过姓名自动关联已有档案。重复账号会回滚整个事务。

已有员工使用已关联的账号登录，不会重复创建员工。尚未开通账号的已有员工，由本机维护者执行 `npm run auth:create-user -- <用户名> <已有员工slug>`；如需管理者权限，可显式追加 `--manager`。该命令只绑定已有档案；对已有账号执行会更新密码。已有张三账号继续使用原密码。`is_current_user` 仅保留旧数据兼容，不再决定请求的数据归属。

执行 `npm run db:migrate:auth` 可重放账号及员工登记迁移。`npm run test:auth` 会在独立 schema 验证注册事务、初始空数据、多账号并发与越权拦截，结束后清理测试数据。

## 隔离候选技能验证

`npm run validation:prepare` 为唯一的“吕海波”档案建立独立验证 schema，仅复制基本身份与共享技能标准，不复制正式工作事实、技能、账号密码或审批。它运行实际测试，生成 `.local/validation-demo/materials/` 下的运行报告、代码用例快照和明确标注为虚构场景的设计复盘。材料保留完整内容与 SHA-256，不作为员工真实贡献证明。首次准备时控制台仅显示一次验证账号密码；不会修改正式账号。

`npm run validation:serve` 在 3100 端口运行隔离环境。验证 Cookie 与正式环境分开，数据库 search_path 禁止 public 回退，验证迁移也拒绝在正式 schema 执行。所有页面、材料和候选均显示验证标记。仅将这些经授权的样本及技能标准发送到服务端配置的 DeepSeek 官方 API；不自动发送飞书或其他外部通知。

事实同步后自动发现候选；只有技能标识和逐字引用通过核对的建议才会生成待本人确认记录与站内通知。否定描述或材料内指令不能单独支持候选。原始模型结果及最终发布结果分别保存，失去依据的未提交建议会撤回。相同输入不重复请求模型或产生通知。AI 不创建审批，员工点击“发起点亮申请”后才进入人工审批。

`npm run test:candidates` 验证引用完整性、否定证据及材料指令拦截；`node scripts/test-candidates.mjs --inspect` 只检查隔离库已有真实模型结果、材料哈希、通知唯一性和员工隔离，并在回滚事务中验证手动申请，不发送新的模型请求。正式吕海波的工作事实与技能数量会与准备时的基线核对。验证材料和 schema 属于可继续使用的演示成果，不由测试清理流程删除。

## 日常开发

```sh
npm run db:start
npm run dev
```

打开 http://127.0.0.1:5173 。前端热更新；修改后端后重启 `npm run dev`。已有数据库不要重复执行恢复命令。

`npm run typecheck` 检查类型；`npm run build` 检查并构建；`npm run db:check` 核对数据库。`Ctrl+C` 停止应用，`npm run db:stop` 停止本项目数据库并保留数据。也保留了 Docker 方案：引擎可用时可用 `npm run db:start:docker` 启动相同端口的数据库；两种方案不能同时使用该端口。

## 迁移范围

- 替换妙搭 Vite/TypeScript preset、应用容器、日志、axios 包装和数据库注入。
- API 统一校验本机会话；原有 NeedLogin 仍负责本机访问限制，不作为角色或数据范围授权。
- 保留已有页面与业务接口、数据库类型和演示场景。
- 原导出包仍在上级项目清单目录。原 source_package 为参考快照，不修改。
