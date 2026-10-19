# 技能树 · 人才管理系统 — 页面与导航关系

> 用途：确定前端路由关系。生成时间：2026-10-15，基于当前代码整理。

## 1. 路由架构总览

- React Router 只注册一个 index 路由 `/`（`client/src/app.tsx`），渲染 `Home`。
- **没有多路径路由**。应用内部 9 个虚拟页面全部由状态切换实现：
  - 状态源：`UIProvider`（`client/src/pages/Home/ui-context.tsx`）持有 `page: PageId`。
  - 页面分发：`Home.tsx` 的 `renderActivePage(page)`，按 `PageId` 渲染对应组件。
  - URL 同步：`navigate()` / `openProfile()` 用 `window.history.replaceState` 写 `#<pageId>`（只替换不压栈，浏览器返回键不可用）。
  - 直达：刷新或外链 `#overview` / `#manager` / `#talent` … 可直接打开对应页面（`readInitialPage()` + `hashchange` 监听）；非法 hash 回落 `overview`。
- 路由状态由 `role`（员工/管理者工作台）与 `page` 两个维度组成：进入管理者页面时 `role` 自动切为 `manager`。

## 2. 页面清单（9 个 PageId）

`PageId` 定义于 `client/src/pages/Home/types.ts`；页面标题/主操作定义于 `ui-context.tsx` 的 `PAGE_TITLE_MAP`；侧边栏入口定义于 `Home.tsx` 的 `EMPLOYEE_NAV` / `MANAGER_NAV`。

| PageId | 页面标题 | 组件文件 | 侧边栏入口 | 顶栏主操作按钮 |
|---|---|---|---|---|
| `overview` | 成长概览 | `OverviewPage.tsx` | 员工工作台 | 更新成长计划 |
| `idp` | 个人职业发展计划 | `IDPPage.tsx` | 员工工作台 | 导出 IDP |
| `evidence` | 技能池 | `EvidencePage.tsx` | 员工工作台（带待确认徽标） | 申请点亮技能 |
| `manager` | 团队概览 | `ManagerPage.tsx` | 管理者工作台 | 导出盘点摘要 |
| `approval` | 认证与复核 | `ApprovalPage.tsx` | 管理者工作台（带待审批徽标） | 批量处理 |
| `talent` | 人才搜索 | `TalentPage.tsx` | 管理者工作台 | 保存人才需求 |
| `succession` | 梯队与继任 | `SuccessionPage.tsx` | 管理者工作台 | 导出梯队盘点 |
| `team` | 项目组队 | `TeamPage.tsx` | 管理者工作台 | 保存组队方案 |
| `profile` | 员工画像 | `ProfilePage.tsx` | **无侧边栏入口**（只能通过搜索/列表进入） | 导出画像摘要 |

## 3. 导航关系图

```mermaid
graph TD
  subgraph 全局入口
    SIDEBAR[侧边栏 nav-item]
    ROLE[工作台切换 role-menu]
    LOOKUP[顶栏「搜索员工」EmployeeLookup]
  end

  subgraph 员工工作台
    overview[成长概览]
    idp[个人发展计划]
    evidence[技能池]
  end

  subgraph 管理者工作台
    manager[团队概览]
    approval[认证与复核]
    talent[人才搜索]
    succession[梯队与继任]
    team[项目组队]
    profile[员工画像]
  end

  SIDEBAR --> overview & idp & evidence
  SIDEBAR --> manager & approval & talent & succession & team
  ROLE -- setRole --> overview
  ROLE -- setRole --> manager
  LOOKUP -- openProfile 任意员工 --> profile

  overview -- 待确认成长信号/进入技能池 --> evidence
  overview -- 查看 Gap 池/完整 IDP --> idp
  overview -- 查看认证记录 --> evidence
  idp -- 查看 Gap 池/返回成长概览 --> overview
  manager -- 寻找项目人才 --> talent
  manager -- 成员行 openProfile --> profile
  talent -- 候选人卡 openProfile --> profile
  talent -- 「改为项目组队模式」 --> team
  succession -- 继任者 openProfile --> profile
  team -- 候选人 openProfile --> profile
  team -- 「编辑人才需求」 --> talent
  profile -- 返回 profileReturnPage --> manager|talent|succession|team
```

## 4. 跳转明细（代码级）

| 来源 | 目标 | 触发点 | 调用 | 代码位置 |
|---|---|---|---|---|
| 侧边栏 | 8 个有入口的页面 | `nav-item` 按钮 | `navigate(page)` | `Home.tsx:94,102` |
| 工作台切换 | `overview` / `manager` | `role-menu` | `setRole(role)` → `navigate` | `Home.tsx:127-128`（定义于 `ui-context.tsx setRole`） |
| 顶栏搜索（仅管理者页面显示） | `profile` | 候选人列表项 | `openProfile(id)` | `EmployeeLookup.tsx:67` |
| 成长概览 | `evidence` | 成长信号卡、雷达「进入技能池」、查看认证记录 | `navigate('evidence')` | `OverviewPage.tsx:193,212,429` |
| 成长概览 | `idp` | 「查看完整 IDP →」 | `navigate('idp')` | `OverviewPage.tsx:331` |
| 个人发展计划 | `overview` | 「查看 Gap 池 →」「返回成长概览」 | `navigate('overview')` | `IDPPage.tsx:87,173` |
| 团队概览 | `talent` | 「寻找项目人才」 | `navigate('talent')` | `ManagerPage.tsx:14` |
| 团队概览 | `profile` | 成员行（周晨/林晓/陈然） | `openProfile(id)` | `ManagerPage.tsx:16-18` |
| 人才搜索 | `profile` | 候选人卡「查看画像」 | `openProfile(item.id)` | `TalentCandidateList.tsx:48` |
| 人才搜索 | `team` | 「改为项目组队模式」 | `navigate('team')` | `TalentPage.tsx:214` |
| 梯队与继任 | `profile` | 继任者卡（有 employeeId 时） | `openProfile(person.employeeId)` | `SuccessionPage.tsx:51` |
| 项目组队 | `talent` | 「编辑人才需求」 | `navigate('talent')` | `TeamPage.tsx:266` |
| 项目组队 | `profile` | 候选人卡 | `openProfile(candidate.id)` | `TeamPage.tsx:334` |
| 员工画像 | `profileReturnPage`（默认 `manager`） | 面包屑「← 返回」 | `navigate(target)` | `ProfilePage.tsx:60-66`（`RETURN_PAGES = manager/talent/succession/team`） |
| 认证上下文 | `evidence` | `openCertification(id)`（当前无组件调用，预留） | `navigate('evidence')` | `certification-context.tsx:114-118` |

## 5. 关键机制

- **`openProfile(id)`**（`ui-context.tsx`）：设置 `profileId` 并切到 `profile` 页，同时记录来源页到 `profileReturnPage` ref（若当前已在画像页则不覆盖）；`role` 强制切为 `manager`。画像页面包屑「← 返回」按 `profileReturnPage` 回到来源页，非法值回落 `manager`。
- **顶栏「搜索员工」**只在管理者页面显示（`managerSurface` 判定 = `MANAGER_PAGES`：manager/approval/talent/succession/team/profile），搜索结果员工与人才候选人同名时员工画像优先（`EmployeeLookup`）。
- **页面显隐**：legacy.css `.page` 默认 `display:none`，页面组件顶层容器固定 `className="page active"`，同一时刻仅渲染当前 `page` 对应组件（分发在 `renderActivePage`，非全量挂载隐藏）。
- **徽标计数**：`evidence`（待确认技能）与 `approval`（待审批）的侧边栏计数来自 `certification-context`，接口驱动，跨页共享。
- **返回路径`profileReturnPage` 未持久化**：刷新后 ref 回到默认值 `manager`。
