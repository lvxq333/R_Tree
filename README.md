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
npm run db:migrate:mvp
node scripts/seed-employee-directory.mjs
npm run build
npm start
```

运行 `npm run db:migrate:auth` 后，用 `npm run auth:create-user -- zhangsan` 为当前演示员工创建本地账号；命令会生成一次性密码。已有账号可用 `AUTH_ACCOUNT_PASSWORD` 环境变量指定新密码并运行同一命令。然后访问 http://127.0.0.1:3001 。`db:start` 会创建并启动独立数据库。`db:restore` 只接受空 public schema，不会覆盖已有数据。恢复原始 27 表、346 行；原 UUID 与 slug 保留，旧平台审计身份置空，修正 SQL 导出中二次编码的 JSONB。原始导出保存在 migration/，恢复脚本不修改原文件。平台 RLS 策略维持注释状态，不能用作正式权限实现。

## 登录接入

左下角的账户按钮可退出、切换账号，并在配置飞书后绑定飞书身份。飞书开放平台自建应用需在安全设置中登记 `FEISHU_REDIRECT_URI`，然后在 `.env` 填写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_REDIRECT_URI`；开发服务器使用 5173 端口时还需设置 `AUTH_APP_URL=http://127.0.0.1:5173/`。先用本地账号登录并绑定飞书，之后才可用飞书直接登录。飞书用户的 `open_id` 与租户标识映射到本地账号；不通过姓名或邮箱自动关联。公司 SSO 协议尚未确定，入口会显示待接入。员工身份由服务端会话确定。HR 可维护全员；T4 专家仅可查看本部门或指派复核员工；T1–T3 仅使用员工工作台。演示数据通过 `is_demo` 标记；能力材料评估默认使用明确标记的 mock 结果。

## 员工账号与注册

新员工可在登录页点击“新员工？注册账号”，填写姓名、账号、密码以及可选的部门、岗位、入职日期。注册在同一个事务中创建 `employee` 员工档案、`app_account` 账号、`mvp_fact_employee` 事实中心基本信息登记和会话；不会生成项目、绩效、技能、成长轨迹、IDP 或模拟工作事实。姓名允许重名，不通过姓名自动关联已有档案。重复账号会回滚整个事务。

已有员工使用已关联的账号登录，不会重复创建员工。尚未开通账号的已有员工，由本机维护者执行 `npm run auth:create-user -- <用户名> <已有员工slug>`。工作台权限由员工主数据的 HR 身份与 T4 职级决定，账号上的旧 `access_role` 标记不再授予管理权限。该命令只绑定已有档案；对已有账号执行会更新密码。`is_current_user` 仅保留旧数据兼容，不再决定请求的数据归属。

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

## 个人发展计划

首次进入“个人发展计划”，选择目标职称、开始月份和周期（默认 24 个月），生成四阶段草案后确认保存。内容来自当前员工的有效职称、目标要求、Gap 与已配置资源，采用规则生成，不发送模型请求。重新生成时先比较变更，保留已开始和已完成行动；确认前不覆盖正式计划。

行动可调整名称、时间、进度与成果说明，关联本人证据或登记成果链接。完成行动不会更改技能认证或职称。管理者对齐功能保存实际沟通记录。复制、下载文本及打印 / 导出 PDF 均使用当前显示的计划；历史版本可只读查看。

运行 `npm run db:migrate:mvp` 应用 `012-idp-workspace.sql`，在原 `idp_plan` 上增量增加计划文档与版本，新增草案和历史表，保留原有数据。`npm run test:idp` 在独立 schema 验证计划生成、保存、进度、证据权限、版本冲突和历史，结束后清理测试数据。

## 迁移范围

- `npm run db:migrate:mvp` 应用 MVP 表结构：`006` 建 27 张 `mvp_` 表（幂等），`007` 落地已确认的决策修正（职称层级 1~6、申诉判定主体 `decided_kind`、标准版本 `source` 与发布人），`008` 把三序列 T1 层级名改为按序列区分，`009` 移除不在三条技术序列内的 7 名演示员工（含账号与组织关系），`010` 支持历史等级迁移（`source_application_slug` 可空、新增 `source`、`certified_via` 增加 `migrated`、修正种子臆造的技能 slug）。五个文件自带事务，可重复执行；恢复数据库后需要重跑一次。
- `npm run db:seed:mvp` 一键重建 MVP 数据：依次跑迁移、企业员工种子、标准种子、历史等级映射。新机器或恢复库之后用这一条即可。
- `npm run db:schema:mvp` 从数据库反向生成 `server/database/mvp-schema.ts`（34 张表 / 370 列），改了迁移后重新生成，不要手改这个文件。
- `npm run db:seed:standards` 把 `server/database/seed/standards-draft.json` 落成标准数据：21 个子能力 × 5 级锚点、3 序列 × 4 层 × 48 条要求、246 行技能子能力矩阵，并按「专家编写 → 负责人审核 → 管理员发布」三级发布 `v2026-q4` 并写快照。已有申请或职称引用该版本层级时会拒绝执行，改用新版本号。
- `npm run db:migrate:legacy-skills` 把旧 `employee_skill` 的已认证等级映射进 `mvp_employee_skill` / `mvp_employee_competency`，来源标 `migrated`；员工或技能已不存在的旧记录只留在旧表，不写入新表。
- 替换妙搭 Vite/TypeScript preset、应用容器、日志、axios 包装和数据库注入。
- API 统一校验本机会话；原有 NeedLogin 仍负责本机访问限制，不作为角色或数据范围授权。
- 保留已有页面与业务接口、数据库类型和演示场景。
- 原导出包仍在上级项目清单目录。原 source_package 为参考快照，不修改。
