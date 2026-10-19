# 技能树 · 人才管理系统 — 实施交接文档（implementation-handover）

> 用途：供接手开发者在脱离妙搭（Miaoda）环境、迁移到高代码实现时理解现有系统。
> 依据：2026-10-15 对当前代码库的全量只读调研（前端 9 页、后端 8 模块、shared 契约、schema.ts）。
> 页面与导航关系见 `docs/pages-and-navigation.md`，本文不重复。
> 文中人名均为演示种子数据中的虚构人物（源自 `source_package/prototype.js`），非真实员工。

**状态标记约定**：✅ 已实现（接口驱动，持久化）｜🟡 部分实现｜🟠 仅提示（toast，不落库）｜🔵 本地状态（刷新丢失）｜⛔ 无 handler｜🧱 硬编码展示数据。

---

## 一、技术与运行方式

### 1.1 技术栈与依赖

- 单体仓库，根目录唯一 `package.json`（无 client/server 子包）。
- 前端：React 19 + TypeScript + Vite 7（`@lark-apaas/fullstack-vite-preset`，构建代理/base 由 preset 内置）；路由 React Router（仅 `index → Home`、`* → NotFound`，`client/src/app.tsx:10-11`）；无 Tailwind 参与业务样式——全部样式在 `client/src/styles/legacy.css`，沿用原型 class 名。
- 后端：NestJS 10 + Drizzle ORM 0.44.6（postgres-js），视图引擎 hbs 渲染 `dist/client` 静态产物（`server/main.ts:21-24`）。
- 契约：`shared/api.interface.ts`（374 行）为前后端唯一类型权威；前端 API 层 `client/src/api/`（7 个 namespace，经 `client/src/api/index.ts` 聚合导出）。
- Node >= 22；无状态管理库、无表单库（无 zod/RHF）、无 UI 组件库参与业务页（弹窗均为自研 div + legacy.css）。

### 1.2 启动与构建（`package.json:11-34`）

| 命令 | 行为 |
|---|---|
| `npm run dev` | 走 `scripts/dev.sh`：沙箱内保活 loop；本地为 miaoda-cli sync + dev-local.js |
| `npm run build:prod` | `nest build` + `vite build` |
| `npm run start` | `node main.js`（部署态） |

### 1.3 环境变量（均不涉密钥）

| 变量 | 用途 | 位置 |
|---|---|---|
| `NODE_ENV` | 环境标识（production 判断） | `server/main.ts:12` |
| `SERVER_HOST` / `SERVER_PORT` | Nest 监听地址/端口 | `server/main.ts:18-19` |
| `CLIENT_BASE_PATH` | 构建期注入，React Router basename | `client/src/index.tsx:14` |
| `MIAODA_DEP_CACHE_DIR` / `SANDBOX_ID` | 仅 `scripts/dev.sh` 用于沙箱判断 | dev.sh |

根目录存在 `.env` 文件（本次未读取其内容，不导出任何值）。

### 1.4 对妙搭平台的依赖（离开该环境必须替换项）

**服务端**：
- `configureApp(app, ...)` 与 `PlatformModule.forRoot()`：Nest 装配与平台中间件（`server/main.ts:3,14`、`server/app.module.ts:3,18`）。
- `DRIZZLE_DATABASE` / `PostgresJsDatabase` 注入：全部 8 个业务 service 的数据库连接来源（如 `server/modules/employee/employee.service.ts:2`）。
- `NeedLogin` 装饰器（来自 `@lark-apaas/fullstack-nestjs-core`）：所有写接口鉴权（见第六节）。
- `GlobalExceptionFilter` 为自研（`server/common/filters/exception.filter.ts`），非平台件，可随迁。

**客户端**（`@lark-apaas/client-toolkit`）：
- `axiosForBackend`：**全部业务请求出口**（`client/src/api/` 7 个文件）。
- `logger`：api 层与 8 个页面的日志。
- `AppContainer` / `ErrorRender` / `NotFoundRender` + 平台 `index.css`（`client/src/index.tsx:6-7`）。

**构建**：`vite.config.ts:2` 依赖 `@lark-apaas/fullstack-vite-preset`（/api、/openapi 代理与 CLIENT_BASE_PATH 注入均由 preset 提供，项目自身无自定义代理配置）。

**未使用的平台能力**（迁移时无需处理）：`capabilityClient`/PluginInstance 插件、dataloom 文件存储、飞书消息/多维表格、business-ui 选人选部门组件（目录存在但业务页未引用）、`AuthNPaasService`、`useCurrentUserProfile`。`req.userContext` 在业务代码中**零使用**（仅 hello 模板注释）。

**替换建议**：数据源改为自建 Drizzle/其他 ORM 连接；`axiosForBackend` → 普通 axios 实例；`NeedLogin` → 自研 guard 或网关鉴权；vite preset → 手写 proxy/base 配置；AppContainer 包裹 → 普通 React root。

---

## 二、逐页功能说明

> 数据上下文：`CertificationProvider`（`certification-context.tsx`）挂载时并行拉取认证+审批两列表，任何写操作后 `Promise.all` 双 refetch（`certification-context.tsx:80-104,123,142,178`），跨页徽标计数由此驱动。

### 2.1 overview 成长概览（`OverviewPage.tsx` 437 行）

- **用途**：员工视角的成长首页：问候 hero、4 张指标卡、能力雷达 SVG、成熟度环、身份信息卡、职业路线、Gap 池 + 行动建议、点亮轨迹曲线。
- **数据来源**：mount 拉 `growthApi.getCareer()` + `listGaps()`（:79-102）；`getGrowthEvents(range)` 依赖 `growthRange` state（6m/12m/all）切换真实重拉（:104-117）。加载中分支（:126-131）、失败分支（:119-125）齐备——任一接口失败整页失败。
- **实际行为**：
  - ✅ range 切换重拉（时间过滤为后端 sort 列表切片，见 3.2）；序列/通道/节点选择、Gap tab、曲线点选择 🔵。
  - 🧱 指标卡数值（18/L2.8/L2/3）、成熟度环（3/7/8）、雷达坐标、身份卡文案（“示例科技集团”）全硬编码。
  - 🟠 无 handler：hero “＋新增成长记录”（:198）；行动建议 4 张卡的“加入学习计划/查看资源/创建行动/查看导师”（:333-336）；身份卡“分享名片/复制信息”。
  - 页内跳转（进入技能池/查看认证记录/查看完整 IDP）见导航文档。
- **状态**：🟡 读路径真实（接口驱动），展示层数值大量硬编码，无写操作。

### 2.2 idp 个人职业发展计划（`IDPPage.tsx` 180 行）

- **用途**：只读渲染 24 个月 IDP：就绪度 hero、现状盘点、Gap、阶段规划、里程碑、调整机制。
- **数据来源**：mount `idpApi.getIdp()`（:18-31），有加载中（:40-46）与失败（:33-39）分支。
- **实际行为**：整页**零写操作**。“复制 IDP”“与管理者对齐”“导出 IDP” 均 🟠 仅 toast（:104,171,172）；“查看 Gap 池/返回成长概览”为页内导航。“生成于 2026 Q3”等文案 🧱。
- **状态**：✅ 只读展示；IDP 的“生成/修改/进度更新”后端不存在任何接口（见 3.4）。

### 2.3 evidence 技能池（`EvidencePage.tsx` 130 行 + `EvidenceGalaxy.tsx`、`CertificationList.tsx`、`CertificationDetail.tsx`、`SelfApplicationDrawer.tsx`）

- **用途**：技能星图（自研 SVG 星座图，节点坐标/连线/粒子/未点亮文案 🧱 硬编码于 `EvidenceGalaxy.tsx:37-86`）、点亮流程 4 步（静态）、复核提示条、自申请抽屉、5 张统计卡（由认证列表实时计算）、认证列表（6 tab **本地过滤**，`CertificationList.tsx:4-11`）、认证详情、“最近等级变更”历史表（**HISTORY_ROWS 3 行完全硬编码**，`EvidencePage.tsx:9-13`）。
- **交互真实性**：
  - ✅ **自助点亮申请**（`SelfApplicationDrawer.tsx`）：字段为技能（写死 6 项 select）/等级/证明类型/证明名称/链接/说明（均有写死默认值 :27-29）；校验仅 HTML required + trim；提交 → `submitSelfApplication` → 真实 POST → refetch + toast + 关抽屉（`certification-context.tsx:120-133`）。失败 toast“操作失败”。
  - ✅ **按认证状态操作**（`CertificationDetail.tsx`）：ready→发起点亮申请 / review→补充成果或说明 / returned→补充重提，均走 `decideCertification` 真实写；pending 状态为 disabled。
  - 星图拖拽/缩放/巡航/track 过滤 🔵；节点点击选中后打开详情或申请抽屉。
- **失败态**：红字 error（:71）；**无整页 loading 骨架**（context 有 loading 字段但页面未消费）。
- **状态**：✅ 本系统最完整的读写闭环（申请→审批→复核状态机在此页与 approval 页打通）。

### 2.4 manager 团队概览（`ManagerPage.tsx` 24 行）

- **用途**：纯静态展示：团队成长状态成员行 + 风险条目 + 热力摘要。
- **实际行为**：**无 useEffect、无任何接口调用**。“62 名员工”“76% 热力表”全部 🧱（:8-19）；3 个 filter 按钮、“查看完整热力图” ⛔；仅“寻找项目人才”导航到 talent、成员行 `openProfile` 三个写死 id（zhou-chen/lin-xiao/chen-ran）。
- **状态**：🧠 整页为演示占位，数据与后端零关联。

### 2.5 approval 认证与复核（`ApprovalPage.tsx` 248 行）

- **用途**：管理者审批队列：条目选择 + 证据/锚点展示 + 意见输入 + 6 类决策。
- **数据来源**：复用 certification-context（挂载已拉 `listApprovals`）；pending 队列为本地 `status==='pending'` 过滤（:26-28）；空态“待审批已处理完”（:94-98）；无独立 loading。
- **实际行为**：
  - ✅ 六类决策（通过/退回/驳回/维持/延长观察/降级）→ `decideApproval` → 真实 POST → refetch + 分动作 toast。前端手写校验：return/reject、downgrade 必填意见（:58-65），与 context 内校验重复（`certification-context.tsx:168-175`）。
  - 🧱 头部“1 降级复核/12 本月已处理”（:80-81）；证据/锚点区块由 `fallbackEvidence`/`fallbackAnchor` 本地生成函数拼装（:9-18），**不来自接口**。“筛选⌄” ⛔（:91）。
- **状态**：✅ 决策链路真实且完整；展示侧证据与统计为拼装/硬编码。

### 2.6 talent 人才搜索（`TalentPage.tsx` 377 行 + `TalentConditions.tsx`、`TalentCandidateList.tsx`、`ShortlistPanel.tsx`）

- **用途**：自然语言找人文案 + 条件 chips + 候选人三桶（direct/adjacent/potential）+ 名单面板。
- **数据来源**：mount 并行 `getTalentCandidates()` + `getShortlist()`（:74-96）；loading（:309-315）/失败（:316-322）齐备。
- **实际行为**：
  - 🟠 **“搜索”是假的**：prompt 输入框仅受控；“解析需求并找人”为 850ms setTimeout 假加载后 toast（handleAnalyze :147-165）；scope 选择、“＋”加条件、删 chip 均本地 state + toast；条件 chips 为写死 `INITIAL_GROUPS`（`TalentConditions.tsx:11-25`）。“仅看可投入/组织筛选”为本地布尔过滤（:102-105），组织过滤写死“机器人创新中心”。
  - ✅ **shortlist 真实落库**：加入/移除/清空 → `addToShortlist`/`removeFromShortlist`/`clearShortlist` → 用响应直接更新（:116-132），刷新保留。
  - 🟠 角色需求弹窗提交仅关窗 + toast 不落库（:194-198）；“生成候选名单”仅 toast（`ShortlistPanel.tsx:74-83`）；覆盖度条 = `58+count*25` 上限 96 🧱（:12-14）。
  - 候选人卡“查看依据”“加入清单”、姓名 `openProfile`（`TalentCandidateList.tsx:48-71`）。
- **状态**：🟡 名单管理真实；搜索/匹配/条件本身未实现（后端也无对应接口，见 3.5）。

### 2.7 succession 梯队与继任（`SuccessionPage.tsx` 311 行）

- **数据来源**：mount `successionApi.getSuccession()`（:76-96）；loading/失败占位齐备（:11-39）。
- **用途**：4 张指标卡 + 岗位健康表 + 岗位详情侧栏（继任者 ready/pipeline 两桶）。
- **实际行为**：岗位行选中与“只看风险岗位” 🔵；“创建继任培养计划”弹窗（70/20/10 内容 🧱 硬编码，:257-300）保存仅关窗 + toast 🟠 不落库；继任者卡 `openProfile` 有条件守卫 `if (person.employeeId)`（`SuccessorCard.tsx:50-52`），employeeId 为空的候选人点击无动作。3 个 filter 按钮 ⛔（:131-133）；指标卡数值 12/8/2/71% 🧱（:136-157）。
- **状态**：✅ 读路径真实；健康度/风险全部为库存字段，无计算（见 3.6）；培养计划不落库。

### 2.8 team 项目组队（`TeamPage.tsx` 475 行）

- **数据来源**：mount 并行 `teamApi.getTeam()` + `talentApi.getTalentCandidates()` 建 candidateMap（:44-72）；loading/失败齐备（:82-105）。
- **用途**：固定项目（slug `embodied-intelligence`）的角色需求卡 + 候选人指派 + 覆盖度/冲突提示。
- **实际行为**：
  - ✅ 真实落库：指派（handleAssign :122-146，跨角色占用仅 toast 提示）、移除（:148-156）、清空（:158-170）→ teamApi 对应接口 → `setProject(res.project)`；新建角色 → `createTeamRole` 落库（:193-218），**但 skills 与 candidates 数组写死**（:198-202）。
  - 🟠 “重新计算”700ms 假加载（:184-191）；“进入协调确认”满足条件才可点，点击仅 toast（:424-432）。
  - 🧱 技能覆盖度公式 `48+entries*15` 上限 96（:117）；冲突文案“陈然…20%”（:411-413）。
- **状态**：🟡 指派/移除/清空/建角色真实；推荐、覆盖度计算、冲突检测为前端演出。

### 2.9 profile 员工画像（`ProfilePage.tsx` 220 行 + `EmployeeLookup.tsx` 101 行）

- **数据来源**：`employeeApi.getEmployeeProfile(profileId)` 依赖 profileId 重拉（:28-44）；加载中/失败分支（:46-59）。后端聚合 6 表（employee/experience/trait/project/skill/performance，`profile.service.ts:154-180`）；员工表 miss 时降级为 talentCandidate“授权摘要画像”（**整段文案写死**：status‘在职’、可信度 82%、expiry‘2027-02’，`profile.service.ts:268-352`）；同名员工与候选人 slug 重叠时员工画像优先。
- **用途**：面包屑（返回逻辑按 `profileReturnPage`，`ProfilePage.tsx:61-66`）→ 人物头卡（含 demographics 年龄/司龄，后端由 birth_year/hire_date 计算，`profile.service.ts:88-118`）→ 画像结论 → 责任/项目/技能/特征 → 侧栏履历/绩效/管理经验（均有空态 :180-197）。
- **实际行为**：“分享画像摘要”“加入用人清单”“查看技能标准”“反馈信息有误”全部 🟠 仅 toast；“查看数据来源”打开自研侧滑面板，内容 🧱 4 行写死（:203-215）。整页只读。
- **EmployeeLookup**（顶栏搜索，仅管理者页面显示）：mount 拉 `listEmployees()`（全量），**前端本地 includes 过滤**（:61-64，匹配 name+role+org），选中 → `openProfile`；有失败/空态，Escape 关闭（`Home.tsx:54-60`）。无后端搜索接口。
- **状态**：✅ 读路径真实完整；所有动作按钮均为占位。

### 2.10 外壳与全局（`Home.tsx`）

- 顶栏主操作按钮 `handlePrimaryAction`（:62-82）逐页分支：evidence→打开自申请抽屉（🔵）；**talent/succession/team/profile 四页均 🟠 仅 toast**；overview/idp/approval/manager 四页 ⛔ 点击无效果。
- 侧栏用户“张三/初级软件开发工程师” 🧱（:109）；“数据更新于 2 天前” 🧱（:120）。

---

## 三、核心业务流程和规则

### 3.1 认证与审批状态机（本系统唯一完整的业务闭环）✅

- **参与角色**：员工（evidence 页发起/响应）、管理者（approval 页决策）；注意身份仅为界面角色，后端不区分（见第六节）。
- **认证状态**（`certification.service.ts`）：`pending` 审批中 / `ready` 待我确认 / `returned` 待补充 / `review` 待复核 / `approved` 已点亮。
- **审批状态**（`approval.service.ts:180-197`）：`pending / approved / rejected / returned / maintained / extended`。
- **自助申请**（`POST api/certifications/self-application`，`certification.service.ts:329-337`）：currentLevel 取同名技能最高级（默认 1）；🧱 写死 confidence=72、source=manual、申请人“张三”、due='09-19'；同时建 pending 审批单（复用已存在的 pending 单）。
- **管理者决策**（`POST api/approvals/:slug/decide`，`approval.service.ts:199-273`）对 `employee_skill` 的副作用：
  | 动作 | 认证状态 | employee_skill 写操作 |
  |---|---|---|
  | approve | approved“已点亮” | currentLevel=target，approvedAt=今天 |
  | reject | ready“待我确认” | — |
  | return | returned“待补充” | —（comment 必填） |
  | maintain | approved“已维持” | targetLevel=current，confidence=min(100, +10) |
  | extend | review“观察期延长” | deadline=原值(无效则今天)+3 个月 |
  | downgrade | approved“已降级” | currentLevel=target |
- **员工侧响应**（`POST api/certifications/:slug/decision`，`certification.service.ts:214-288`）：dismiss 物理删除认证+pending 审批单；submit 仅 ready、resubmit 仅 returned、add-evidence 仅 returned、explain 仅 review；后两者置回 pending 并建/复用审批单。新记录 sort=现有最小 sort-1（排最前，:308-326）。
- **管理者主动发起降级评审**（`POST api/approvals/manager-review`）：新建 pending 认证（source=performance，confidence=75 🧱）+ downgrade 审批单，due '09-23' 🧱。**未发现前端入口调用**（ApprovalPage 未接此接口，待确认是否为预留）。
- **等级/证据/认证关系**：等级锚点存于 `skill_level_anchor`（L1–L5）；证据为 `employee_skill.evidence` JSONB；前端审批页展示的证据/锚点由本地 fallback 函数拼装，**不读锚点表**（见 2.5）。

### 3.2 成长事件与 Gap 🟡（库表驱动，无计算）

- `GET api/growth/events?range=`：**时间过滤不是按日期，而是按 sort 顺序切片**——6m 取末 6 条、12m 取末 9 条、all 全量（`growth.service.ts:112-117`）；非法 range 归一为 all（controller :14-16）。
- `GET api/gaps` / `api/career`：纯读 `skill_gap` / `career_*` 表；gap 仅取 source∈[career,okr,current]，非法 source/priority 兜底 career/p2（:27-39）。
- **全部 growth 数据归属写死 `zhang-san`**（`growth.service.ts:25-26`）——任何登录用户看到的都是同一份数据。**Gap 计算、成长信号生成逻辑不存在**，值全部来自种子。

### 3.3 IDP 🟡（纯读，无生成/修改/进度更新）

- `GET api/idp`：纯读 5 张 `idp_*` 表 + skill_gap 复用，员工写死 zhang-san（`idp.service.ts:24-27`）；kind/state 非法值兜底 learn/next；plan 不存在抛 NotFound。
- “基于 Gap 生成 24 个月规划”“修改 IDP”“更新进度”**均未实现**——页面所有相关按钮只 toast。

### 3.4 人才搜索 🟠（无匹配算法）

- `GET api/talent/candidates`：仅按 `talent_candidate.tier` 字段分 direct/adjacent/potential 三桶（`talent.service.ts:69-75`）。**无搜索参数、无匹配度计算、无推荐解释生成**——reason/evidence/gap/dimensions（含匹配度数值）全部为库存演示值原样透出。
- shortlist：demand 写死 `'具身智能业务探索'`（:14）；add 用 `onConflictDoNothing`（candidate_slug+demand 唯一）；remove/clear 校验存在性否则 NotFound；sort=最大+1。

### 3.5 梯队与继任 🟡（纯读，无风险计算）

- `GET api/succession`：`succession_candidate` 按 bucket=ready/pipeline 分桶（`succession.service.ts:56-64`）；health/risk/immediate/developing 全为 `succession_position` 库字段。**准备度/风险计算、岗位要求匹配逻辑不存在**。“创建继任培养计划”不落库。

### 3.6 项目组队 🟡（CRUD 真实，推荐不存在）

- 项目固定取 slug `'embodied-intelligence'`，miss 则取第一条（`team.service.ts:165-176`）；headcount 固定 1；自建角色 slug=`custom-role-${Date.now()}`。
- `POST api/team/roles` 入参为手工校验（非 class-validator：title 非空、skills[].type∈required/bonus，:178-226）。
- 指派为 upsert（一角色一人）；无推荐规则（候选人为入库值，覆盖度/冲突为前端公式演出，见 2.8）。

### 3.7 员工目录与画像 ✅（读路径）

- `GET api/employees`：employee + talentCandidate 按 slug 去重合并，员工优先、候选人补尾（`employee.service.ts:37-49`）——搜索是**前端本地过滤**。
- `GET api/employees/:slug`：employee 优先，miss 降级候选人摘要画像（写死文案），再 miss 404。
- `GET api/skill-tree`：两级分类树 + 技能 + 锚点组装（`employee.service.ts:52-104`）——**前端零调用，预留未消费**。

---

## 四、数据模型与存储

### 4.1 存储位置与初始化

- 单库 PostgreSQL，开发/生产共享同一套（妙搭单环境配置）。连接经平台注入的 Drizzle 实例。
- **仓库内无任何 seed 脚本 / SQL 文件 / migration**：种子数据是建库会话中经妙搭平台 DB 工具直接灌入的，版本库只留下生成的 `server/database/schema.ts` 与验收卷（`.spark/e2e-test/standard/db-migration-acceptance.json`）。**迁移时必须另行导出全量数据，否则只有表结构没有数据。**
- 种子规模（由验收卷推断）：职业序列 ≥4、认证 ≥8、待审批 ≥3、候选人 ≥9、IDP ≥4 阶段、关键岗位 4。人名为虚构演示数据。

### 4.2 表结构（`server/database/schema.ts`，27 个 pgTable 导出；AGENTS.md 记 26 表，以 schema.ts 为准）

通用约定：**每表 uuid 主键 defaultRandom + 4 系统列**（`_created_at/_updated_at` timestamptz 默认 CURRENT_TIMESTAMP；`_created_by/_updated_by` 为平台 `user_profile` 复合类型）。**无外键约束**——全部 slug/uuid 软关联 + 索引；**无 pgEnum/CHECK**——枚举值仅由应用层约定（varchar）；**未发现 RLS policy**（全 schema 及仓库无 pgPolicy 命中）；业务“时间”多为 varchar 展示标签（date_label/period/deadline 等），非时间戳。

主要实体分组（关键列；行号为 schema.ts 定位）：

| 域 | 表（行号） | 关键列与含义 |
|---|---|---|
| 技能体系 | skill_category(679) | slug、name、kind('professional'/'generic'，应用层约定)、parent_slug 自关联两级 |
| | skill(659) / skill_level_anchor(640) | 技能；锚点 (skill_slug, level 1–5, anchor) 唯一 |
| 职业序列 | career_sequence(494) / career_node(468) / career_node_skill(447) | 序列→岗位节点（code/state/coverage）→技能要求（required_level/current_level） |
| 员工 | employee(773) | slug 唯一、name、avatar_text/tone、role/org/status、readiness_value、responsibilities/collaboration/development_actions JSONB、**management_profile JSONB** `{hasTeam,scope,years,style,styleDetail,collaborationFit}`、is_current_user bool 默认 false、birth_year/gender/education/hire_date('YYYY.MM') |
| | employee_experience(752) / employee_trait(730) / employee_project(700) / performance_record(120) | 履历/特征/项目/绩效，均按 employee_slug 软关联 |
| 技能与成长 | employee_skill(599) | slug 唯一、employee_slug、skill_slug、current/target_level int、confidence int、status、evidence JSONB `[{type,title,detail}]`、deadline/approved_at/expiry/last_used（varchar） |
| | skill_event(573) / skill_gap(546) | 成长事件（date_label varchar、total）；差距（source、filled/target int、priority p0/p1/p2） |
| 认证审批 | approval(514) | slug、linked_slug、kind('application'/'downgrade')、applicant、current/target_level、submitted_at/due/status 全 varchar |
| IDP | idp_plan(416) / idp_phase(388) / idp_action(364) / idp_milestone(342) / idp_adjust_rule(322) | plan.employee_slug 唯一、horizon、readiness int、strengths/weaknesses JSONB；phase 含 focus_gaps JSONB；action 归属 phase_id |
| 人才/继任/组队 | talent_candidate(284) / talent_shortlist_item(265) | 候选人（tier、dimensions JSONB `[{label,value}]`、evidence JSONB）；名单（candidate_slug+demand 唯一，demand 默认'具身智能业务探索'） |
| | succession_position(237) / succession_candidate(210) | 岗位（incumbent、immediate/developing int、health）；继任者（bucket 'ready'/'pipeline'、employee_slug 可空——前端据此禁用画像跳转） |
| | team_project(190) / team_role(159) / team_assignment(141) | 角色（skills JSONB、candidate_slugs JSONB）；指派（role_slug 唯一=一角色一人） |

### 4.3 数据类别区分

- **数据库实体**：上表全部；27 张表均被后端 service 查询，无废表（hello 模块 import 仅占位）。
- **接口返回对象**：`shared/api.interface.ts` 中的视图类型（如 `EmployeeProfile` 聚合 6 表、`IdpResponse` 聚合 5 表、`TalentCandidatesResponse` 三桶），与表结构非 1:1。
- **前端临时状态**：导航态（page/role/profileId，`ui-context.tsx`）、certification context（写后即 refetch，不落前端存储）、TalentPage prompt/chips、组队/继任弹窗输入、星图视角。刷新即丢。
- **写死数据**：ManagerPage 全页、evidence 历史表与星图节点、ApprovalPage 证据 fallback 与统计、succession/team 指标卡与覆盖度公式、profile 数据来源面板、后端 zhang-san/due/confidence/demand/project-slug 等（散见第三节）。

### 4.4 脱敏 JSON 示例（虚构数据，示意软关联）

```jsonc
// employee_skill —— 认证状态机的主实体
{ "slug": "emp-skill-001", "employee_slug": "zhang-san",
  "skill_slug": "skill-go-backend", "currentLevel": 2, "targetLevel": 3,
  "confidence": 72, "status": "pending",
  "evidence": [{ "type": "工作日志", "title": "XX 服务重构", "detail": "…" }],
  "deadline": "09-19" }

// approval —— 审批单，linked_slug 指向 employee_skill.slug
{ "slug": "appr-001", "linked_slug": "emp-skill-001", "kind": "application",
  "applicant": "张三", "current_level": 2, "target_level": 3,
  "status": "pending", "due": "09-19" }

// succession_candidate —— employee_slug 为空则前端禁用画像跳转
{ "position_slug": "pos-platform-lead", "person_name": "周晨",
  "employee_slug": "zhou-chen", "bucket": "ready", "state": "1 年内可接任" }

// talent_shortlist_item —— demand 全表固定同一字符串
{ "candidate_slug": "lin-xiao", "demand": "具身智能业务探索" }
```

---

## 五、接口清单

通用：前缀 `api/`；错误经全局 `GlobalExceptionFilter`（`server/common/filters/exception.filter.ts`：BusinessException→自定义 code、HttpException→状态码、Postgres 22P02→404、其余 500 带 stack）；写接口一律 `@NeedLogin()`（登录态校验，但**不区分人/角色**），读接口全部公开；前端统一 `axiosForBackend`，决定类接口返回 void、写后靠 refetch。

### 5.1 读接口（全部真实实现、GET、公开）

| 路径 | Service | 返回（shared 类型） | 调用页面 |
|---|---|---|---|
| GET /api/employees | EmployeeService.listEmployees | EmployeeListItem[] | EmployeeLookup |
| GET /api/employees/:slug | ProfileService.getProfile | EmployeeProfile | ProfilePage |
| GET /api/skill-tree | EmployeeService.getSkillTree | SkillTreeResponse | **前端未消费（预留）** |
| GET /api/career | GrowthService | CareerResponse | OverviewPage |
| GET /api/growth/events?range= | GrowthService | GrowthEventsResponse | OverviewPage |
| GET /api/gaps | GrowthService | GapListResponse | OverviewPage |
| GET /api/idp | IdpService | IdpResponse | IDPPage |
| GET /api/certifications | CertificationService | CertificationItem[] | EvidencePage（经 context） |
| GET /api/certifications/:id | CertificationService | CertificationItem | **前端未消费（预留）** |
| GET /api/approvals | ApprovalService | ApprovalItem[] | Evidence/ApprovalPage（经 context） |
| GET /api/talent/candidates | TalentService | TalentCandidatesResponse | TalentPage、TeamPage |
| GET /api/talent/shortlist | TalentService | ShortlistResponse | TalentPage |
| GET /api/succession | SuccessionService | SuccessionResponse | SuccessionPage |
| GET /api/team | TeamService | TeamResponse | TeamPage |

### 5.2 写接口（全部真实实现、@NeedLogin）

| 路径 | 方法 | 用途 | 入参 | 调用页面 |
|---|---|---|---|---|
| /api/certifications/self-application | POST | 自助点亮申请（建认证+审批单） | SelfApplicationInput{skill,level,evidenceType,evidenceTitle,evidenceLink,note} | EvidencePage 抽屉 |
| /api/certifications/:slug/decision | POST | 员工侧响应（submit/resubmit/dismiss/add-evidence/explain） | {action: CertificationDecision, comment} | CertificationDetail |
| /api/approvals/manager-review | POST | 管理者发起降级评审 | ManagerReviewInput{personName,skill,currentLevel,targetLevel,reason,evidence} | **前端未接（预留）** |
| /api/approvals/:slug/decide | POST | 审批决策（approve/return/reject/maintain/extend/downgrade） | {action, comment}（return/reject 必填） | ApprovalPage |
| /api/talent/shortlist/:slug | POST/DELETE | 加入/移出名单 | slug 路径参数 | TalentPage |
| /api/talent/shortlist | DELETE | 清空名单 | — | TalentPage |
| /api/team/roles | POST | 新建组队角色（手工校验入参） | CreateTeamRoleInput{title,allocation,skills,candidates} | TeamPage |
| /api/team/assignments/:roleSlug | PUT/DELETE | 指派/移除成员 | roleSlug + {person} | TeamPage |
| /api/team/assignments | DELETE | 清空指派 | — | TeamPage |

### 5.3 契约与形状差异

- `submitSelfApplication` 响应为内联 `{ certification: CertificationItem }`（`client/src/api/certification.ts:38-46`），**未入 shared 契约**。
- shared 中 `CertificationFilter`/`CertificationDecision` 仅作类型使用，非接口载荷。
- **无 mock 接口、无未接通接口**：前端 7 namespace 与后端路由一一对应；不存在 localStorage 数据路径。getSkillTree/getCertification/manager-review 为“已实现但无前端消费”的预留项。

---

## 六、身份与权限

- **当前用户**：前端**无任何登录/获取用户信息代码**；后端业务代码中 `req.userContext` **零使用**（仅 hello 注释模板）。系统不知道“我是谁”。
- **员工/管理者识别**：纯前端 UI 状态（`ui-context.tsx` 的 role），工作台切换 = 界面切换，**无真实权限校验**；进入 manager 系页面自动切 role（isManagerSurface）。
- **写接口鉴权**：仅校验“已登录”（妙搭 NeedLogin → 平台登录态），**不校验角色、不校验数据归属**：任何登录用户可审批任何单、可清空任何 shortlist、可改任何 employee_skill。
- **数据范围**：不存在。growth/IDP 数据后端写死归属 zhang-san；认证/审批/组队操作无“审批范围/管理范围”概念。
- **数据可见性**：所有 GET 公开（未登录也可读全部员工画像与技能证据）；画像页“授权摘要”降级文案为写死演示，非真实权限分级。
- **迁移结论**：身份与权限是当前系统**最大的未实现面**，高代码实现需重建：用户身份→组织架构（管理者-下属关系）→审批范围→数据行级权限，每层都要新设计。

---

## 七、重构注意事项与待确认问题

### 7.1 完整可用（接口驱动 + 持久化，可整体保留）

- 认证/审批状态机（evidence ↔ approval 双页闭环：申请→审批→点亮/维持/延长/降级/退回→员工补充重提）——业务核心，建议原样迁移逻辑。
- 名单（shortlist）与组队（team）的 CRUD。
- 员工目录/画像读路径（6 表聚合 + 候选人降级 + 同名优先）。
- 各页 loading/空态/失败分支基本齐备（缺口见下）。

### 7.2 演示专用 / 占位 / 未实现（重构时必须重做，勿当成已有能力）

| 项 | 现状 | 位置 |
|---|---|---|
| manager 页 | 整页硬编码，无接口 | ManagerPage.tsx |
| 人才“搜索” | 假解析（850ms+toast），后端无搜索/匹配接口 | TalentPage :147-165 |
| IDP 生成/修改/进度 | 不存在，页面只读+toast 按钮 | IDPPage、idp.service |
| Gap 计算 | 不存在，库表直读 | growth.service |
| 继任风险/准备度计算、培养计划 | 不存在/不落库 | succession.service、SuccessionPage 弹窗 |
| 组队推荐、覆盖度/冲突计算 | 前端公式演出（58+n*25 等） | TeamPage/ShortlistPanel |
| 审批页证据与锚点展示 | 本地 fallback 函数拼装，未读锚点表 | ApprovalPage :9-18 |
| 员工搜索 | 全量拉取+前端 includes 过滤 | EmployeeLookup :61-64 |
| 顶栏主操作 | 8 页中 4 页仅 toast、4 页无 handler | Home.tsx :62-82 |
| profile 分享/加入用人清单等 | 仅 toast | ProfilePage :96 |
| evidence 历史表/星图节点 | 硬编码 | EvidencePage :9-13、EvidenceGalaxy :37-86 |
| 身份/角色/权限/数据范围 | 完全未实现 | 第六节 |

### 7.3 已知缺陷与硬编码清单（演示风险点）

- growth/IDP 后端写死员工 `zhang-san`——所有人看到同一份数据；`is_current_user` 字段存在但未用于此逻辑。
- 写死值：due '09-19'/'09-23'、confidence 72/75、shortlist demand‘具身智能业务探索’、项目 slug 'embodied-intelligence'、headcount=1、候选人降级画像整段文案。
- growth 时间过滤按 sort 切片非按日期（6m=末 6 条）。
- `profileReturnPage` 用 ref 保存，刷新后回落 manager。
- 前后端重复校验（approval 必填意见在 ApprovalPage 与 context 各写一份）；EvidencePage 无 loading 骨架；APITEST 型内联响应类型未入契约。
- 表无 FK/枚举/RLS 约束，业务合法性完全依赖应用层；审批表 submitted_at/due 为 varchar 非时间戳。
- 时间显示文案（“数据更新于 2 天前”“生成于 2026 Q3”）硬编码，会随时间过期。

### 7.4 平台耦合与迁移风险

- 必替换：DRIZZLE_DATABASE 注入、configureApp/PlatformModule、NeedLogin、axiosForBackend/logger/AppContainer、vite preset（见 1.4）。
- **数据不在版本库**：必须单独导出全量库数据（平台工具），仅迁 schema.ts 不够。
- React Router 仅 index 路由 + hash 虚拟页面 + replaceState（无浏览器返回），高代码化建议改为真实路由（导航文档已给出每条跳转的代码位置，可当迁移清单）。

### 7.5 必须由业务方决定（无法从代码判断）

1. 员工/管理者身份与权限模型：真实组织架构同步？管理者-下属关系来源？审批范围？
2. IDP/Gap/匹配度/继任风险的业务规则：种子值暗示了产品意图（24 个月规划、p0-p2 优先级、dimensions 匹配雷达），但真实算法需业务定义。
3. 多员工化：growth/IDP 是否要按登录人取数？`is_current_user` 字段的预期用途？
4. `manager-review`（管理者发起降级评审）与 `getSkillTree`/`getCertification` 三个已实现未接线的接口，是有意预留还是废弃？
5. “搜索员工”“人才搜索”是否需要真实后端搜索（当前为全量拉取+前端过滤）。
6. 员工画像对候选人降级展示（“授权摘要”）真实权限语义如何定。

### 检查范围与限制

- 已全量检查：shared 契约、client/src/api、client/src/pages/Home 全部文件、server/modules 全部 controller/service/module、server/database/schema.ts、package.json、main/app.module/view、vite.config。
- 未读取：`.env` 文件内容（按约定不导出）、`node_modules`、`dist`、数据库实际数据（仅经 schema 与验收卷推断）、`source_package/`（仅确认人名来源）、`scripts/dev.sh` 细节。
