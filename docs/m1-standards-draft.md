# M1 标准草稿 v0.2 · 3 条序列 × 4 层职称

> **用途**：M1 数据底座的种子输入，供业务复核后固化进 `mvp_title_track` / `mvp_title_level` / `mvp_title_requirement` / `mvp_competency`。
> **来源文件**：`server/database/seed/standards-draft.json`（本文件由 `scripts/render-standards-draft.mjs` 生成，改内容请改 JSON）
> **生成时间**：2026-10-20　**标准版本**：v2026-q4　**标记**：MVP 假定标准（assumed）

> **范围**：仅技术类三序列：software（软件开发）、platform（平台工程）、ai（数据与 AI）。销售、客户成功、产品、项目管理等业务序列移出 MVP。

> **口径**：序列 slug、层级代码与层级名称沿用库内既有 career_sequence / career_node 定义，不另造。技能要求按层写「该层新增或提高的要求」，与既有 career_node_skill 语义一致：未列出的技能沿用较低层要求，Gap 只算本层新增/提高项。全部标记「MVP 假定标准」，管理端可改。

---

## 1. 序列总览

| # | 序列 | 名称 | 层级 | 层级数 | 技能要求 | 来源 |
|---|---|---|---|---|---|---|
| 1 | `software` | 软件开发序列 | T1 初级软件开发工程师<br>T2 中级软件开发工程师<br>T3 高级软件开发工程师<br>T4 资深 / 专家工程师 | 4 | 20 条 | 精编 |
| 2 | `platform` | 平台工程序列 | T1 初级软件开发工程师<br>T2 平台开发工程师<br>T3 高级平台工程师<br>T4 平台架构专家 | 4 | 20 条 | 精编 |
| 3 | `ai` | 数据与 AI 序列 | T1 初级软件开发工程师<br>T2 AI 应用开发工程师<br>T3 高级 AI 工程师<br>T4 AI 架构专家 | 4 | 20 条 | 精编 |

合计 **3 条序列、12 个职称层级、60 条技能要求**，其中沿用库内既有 48 条、本次补齐 12 条（标 `+`）。

---

## 2. 职称层级与技能要求

> 每层只列**该层新增或提高的要求**，未列出的技能沿用较低层要求。因此「本次升级 Gap」= 本层要求 − 已满足项，不重复计入下层已满足的技能。

> 带 `+` 的是本次补齐项，其余逐条对应库内既有 `career_node_skill`。

### 软件开发序列（`software`）

| 层级 | 本层新增/提高要求 | 条数 | 累计要求 |
|---|---|---|---|
| T1 初级软件开发工程师 | programming `L2`、code-quality `L2`、auto-testing `L2`、requirements `L2`、task-delivery `L2` + | 5 | 5 项技能 |
| T2 中级软件开发工程师 | java-go-eng `L3`、sys-design-split `L3`、engineering-quality `L3`、collaboration `L3`、code-quality `L3` + | 5 | 9 项技能 |
| T3 高级软件开发工程师 | distributed-sys `L4`、perf-capacity `L4`、proposal-decision `L4`、tech-influence `L3`、java-go-eng `L4` + | 5 | 13 项技能 |
| T4 资深 / 专家工程师 | domain-arch `L5`、tech-strategy `L4`、org-governance `L4`、talent-dev `L4`、java-go-eng `L5` + | 5 | 17 项技能 |

**累计最低要求**（把本层与以下各层合并后的结果）：

| 技能 | 分类 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| domain-arch | sys-design | — | — | — | **L5** |
| java-go-eng | coding-eng | — | **L3** | **L4** | **L5** |
| org-governance | org-mgmt | — | — | — | **L4** |
| talent-dev | org-mgmt | — | — | — | **L4** |
| tech-strategy | org-mgmt | — | — | — | **L4** |
| distributed-sys | sys-design | — | — | **L4** | L4 |
| perf-capacity | sys-design | — | — | **L4** | L4 |
| proposal-decision | sys-design | — | — | **L4** | L4 |
| tech-influence | collab-impact | — | — | **L3** | L3 |
| code-quality | eng-quality | **L2** | **L3** | L3 | L3 |
| collaboration | collaboration | — | **L3** | L3 | L3 |
| engineering-quality | eng-quality | — | **L3** | L3 | L3 |
| sys-design-split | sys-design | — | **L3** | L3 | L3 |
| auto-testing | eng-quality | **L2** | L2 | L2 | L2 |
| programming | coding-eng | **L2** | L2 | L2 | L2 |
| requirements | business | **L2** | L2 | L2 | L2 |
| task-delivery | eng-practice | **L2** | L2 | L2 | L2 |

> 加粗为该层要求有变化，浅色为该层沿用下层要求。

### 平台工程序列（`platform`）

| 层级 | 本层新增/提高要求 | 条数 | 累计要求 |
|---|---|---|---|
| T1 初级软件开发工程师 | programming `L2`、code-quality `L2`、auto-testing `L2`、requirements `L2`、task-delivery `L2` + | 5 | 5 项技能 |
| T2 平台开发工程师 | cloud-platform-dev `L3`、k8s `L3`、observability-building `L3`、collaboration `L3`、infra-as-code `L2` + | 5 | 10 项技能 |
| T3 高级平台工程师 | platform-product `L4`、stability-gov `L4`、cost-capacity `L4`、tech-influence `L3`、k8s `L4` + | 5 | 14 项技能 |
| T4 平台架构专家 | infra-arch `L5`、platform-tech-strategy `L4`、org-governance `L4`、talent-dev `L4`、k8s `L5` + | 5 | 18 项技能 |

**累计最低要求**（把本层与以下各层合并后的结果）：

| 技能 | 分类 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| infra-arch | platform-eng | — | — | — | **L5** |
| k8s | cloud-native | — | **L3** | **L4** | **L5** |
| org-governance | org-mgmt | — | — | — | **L4** |
| platform-tech-strategy | platform-eng | — | — | — | **L4** |
| talent-dev | org-mgmt | — | — | — | **L4** |
| cost-capacity | platform-eng | — | — | **L4** | L4 |
| platform-product | platform-eng | — | — | **L4** | L4 |
| stability-gov | stability | — | — | **L4** | L4 |
| tech-influence | collab-impact | — | — | **L3** | L3 |
| cloud-platform-dev | platform-eng | — | **L3** | L3 | L3 |
| collaboration | collaboration | — | **L3** | L3 | L3 |
| infra-as-code | platform-eng | — | **L2** | L2 | L2 |
| observability-building | stability | — | **L3** | L3 | L3 |
| auto-testing | eng-quality | **L2** | L2 | L2 | L2 |
| code-quality | eng-quality | **L2** | L2 | L2 | L2 |
| programming | coding-eng | **L2** | L2 | L2 | L2 |
| requirements | business | **L2** | L2 | L2 | L2 |
| task-delivery | eng-practice | **L2** | L2 | L2 | L2 |

> 加粗为该层要求有变化，浅色为该层沿用下层要求。

### 数据与 AI 序列（`ai`）

| 层级 | 本层新增/提高要求 | 条数 | 累计要求 |
|---|---|---|---|
| T1 初级软件开发工程师 | programming `L2`、code-quality `L2`、auto-testing `L2`、requirements `L2`、task-delivery `L2` + | 5 | 5 项技能 |
| T2 AI 应用开发工程师 | ai-integration `L3`、data-processing `L3`、model-eval `L3`、product-collab `L3`、data-loop `L2` + | 5 | 10 项技能 |
| T3 高级 AI 工程师 | intelligent-sys `L4`、model-eng `L4`、data-quality-gov `L4`、tech-influence `L3`、model-eval `L4` + | 5 | 14 项技能 |
| T4 AI 架构专家 | ai-platform-arch `L5`、ai-tech-strategy `L4`、security-gov `L4`、talent-dev `L4`、distributed-training `L4` + | 5 | 19 项技能 |

**累计最低要求**（把本层与以下各层合并后的结果）：

| 技能 | 分类 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| ai-platform-arch | ai-app | — | — | — | **L5** |
| ai-tech-strategy | ai-app | — | — | — | **L4** |
| distributed-training | data-ai | — | — | — | **L4** |
| security-gov | ai-app | — | — | — | **L4** |
| talent-dev | org-mgmt | — | — | — | **L4** |
| data-quality-gov | data-ai | — | — | **L4** | L4 |
| intelligent-sys | ai-app | — | — | **L4** | L4 |
| model-eng | data-ai | — | — | **L4** | L4 |
| model-eval | data-ai | — | **L3** | **L4** | L4 |
| tech-influence | collab-impact | — | — | **L3** | L3 |
| ai-integration | ai-app | — | **L3** | L3 | L3 |
| data-loop | data-ai | — | **L2** | L2 | L2 |
| data-processing | data-ai | — | **L3** | L3 | L3 |
| product-collab | collaboration | — | **L3** | L3 | L3 |
| auto-testing | eng-quality | **L2** | L2 | L2 | L2 |
| code-quality | eng-quality | **L2** | L2 | L2 | L2 |
| programming | coding-eng | **L2** | L2 | L2 | L2 |
| requirements | business | **L2** | L2 | L2 | L2 |
| task-delivery | eng-practice | **L2** | L2 | L2 | L2 |

> 加粗为该层要求有变化，浅色为该层沿用下层要求。

---

## 3. 技能覆盖

**本次不新增技能、不新增分类。** 三条序列全部落在库内既有 81 项技能上，避免出现「标准里有、系统里没有」的悬空条目。

本草稿引用技能 **38 项**（库内共 81 项）。未引用的技能保留在技能池中，员工可自主认证，但不进入职称硬性要求。

---

## 4. 子能力库

### 4.1 通用子能力

| slug | 编码 | 名称 | 定义 |
|---|---|---|---|
| `req-clarify` | GEN-REQ | 需求澄清 | 澄清目标、边界与验收口径，识别隐含约束 |
| `solution-design` | GEN-DESIGN | 方案设计 | 给出可比较的方案、关键取舍与风险 |
| `impl-delivery` | GEN-IMPL | 实现交付 | 按约定完成实现并保证可维护性 |
| `quality-gate` | GEN-QUALITY | 质量保障 | 设计验证手段，守住交付质量 |
| `troubleshoot` | GEN-DEBUG | 问题定位 | 从现象收敛到根因，给出可验证结论 |
| `knowledge-share` | GEN-SHARE | 知识沉淀 | 把经验转成他人可复用的材料 |
| `collab-deliver` | GEN-COLLAB | 协作交付 | 在多方协作中推进目标达成 |
| `tech-decision` | GEN-DECIDE | 技术决策 | 在信息不全时做出可解释的取舍 |
| `risk-identify` | GEN-RISK | 风险识别 | 提前识别风险并给出应对 |
| `coach-others` | GEN-COACH | 指导他人 | 通过评审、带教提升他人能力 |
| `system-build` | GEN-SYSTEM | 体系建设 | 建立规范、流程或平台形成长期能力 |
| `cross-team-drive` | GEN-CROSS | 跨团队推动 | 在跨团队范围形成共识并落地 |

### 4.2 序列专业子能力

| 序列 | slug | 编码 | 名称 | 定义 |
|---|---|---|---|---|
| software | `sw-modeling` | SW-MODEL | 领域建模 | 把业务规则收敛为清晰的模型、边界与演进路径 |
| software | `sw-runtime` | SW-RUN | 运行时与性能 | 内存、并发、资源使用的度量与调优 |
| software | `sw-maintain` | SW-KEEP | 可维护性 | 让代码与设计在长期迭代中保持低成本 |
| platform | `pf-slo` | PF-SLO | 可靠性目标 | 以 SLO 定义可靠性目标并据此管理容量与成本 |
| platform | `pf-incident` | PF-IR | 故障应急 | 故障定位、止损、复盘与改进闭环 |
| platform | `pf-product` | PF-PROD | 平台产品化 | 把内部能力做成可自助使用的产品 |
| ai | `ai-model` | AI-MODEL | 模型方案 | 从数据与指标出发选择、训练并迭代模型方案 |
| ai | `ai-eval` | AI-EVAL | 离线与在线评估 | 设计评估口径并解释离线与线上效果差异 |
| ai | `ai-loop` | AI-LOOP | 数据闭环 | 从线上问题反推数据采集、标注与训练迭代 |

### 4.3 技能 → 子能力映射规则

为避免「技能 × 5 级 × N 个子能力」的手工爆炸，映射按**技能分类**统一挂载，生成时对等级 1~5 展开：

| 技能分类 | 挂载子能力 |
|---|---|
| coding-eng | impl-delivery、quality-gate、troubleshoot |
| sys-design | solution-design、tech-decision、risk-identify |
| eng-quality | quality-gate、troubleshoot、knowledge-share |
| eng-practice | impl-delivery、collab-deliver、knowledge-share |
| stability | troubleshoot、risk-identify、system-build |
| cloud-native | impl-delivery、risk-identify、system-build |
| platform-eng | solution-design、system-build、cross-team-drive |
| data-ai | solution-design、quality-gate、knowledge-share |
| ai-app | solution-design、quality-gate、cross-team-drive |
| business | req-clarify、solution-design、collab-deliver |
| org-mgmt | system-build、coach-others、cross-team-drive |
| collaboration | collab-deliver、cross-team-drive、knowledge-share |
| collab-impact | cross-team-drive、coach-others、knowledge-share |
| problem-solving | troubleshoot、tech-decision、risk-identify |
| rd-efficiency | impl-delivery、system-build、knowledge-share |

规则：某技能的应考子能力 = 该分类子能力 ∪ 所属序列专业子能力；子能力要求等级 = 该职称层对该技能的要求等级。

---

## 5. 证据要求（按等级统一）

| 等级 | 证据组合 |
|---|---|
| L1 | 学习笔记或培训记录 1 份（note × 1） |
| L2 | 事实中心可追溯的常规任务记录 1 条（fact × 1）；可复述方法与取舍的说明 1 份（note × 1） |
| L3 | 独立承担复杂问题的项目事实 2 条（fact × 2）；方案文档或复盘材料 1 份（upload × 1） |
| L4 | 系统性方案设计或规范制定的事实 3 条（fact × 3）；被团队采用的规范/平台/工具说明 1 份（upload × 1） |
| L5 | 跨团队体系演进的事实 4 条（fact × 4）；可复用方法、工具或标准的落地证据 2 份（upload × 2） |

同一证据可支持多个子能力，但不重复累计进度；L1、L2 的自证材料需事实中心评估后才计入。

---

## 6. 旧 domain 到三序列的映射

现有演示数据（`mvp_org_relation.domain` 等）仍带 13 序列时期的取值，按下表归一；这是一次性迁移，M1 种子脚本按目标序列直接写入。

| 旧 domain | 归入序列 |
|---|---|
| `java` | `software` |
| `frontend` | `software` |
| `python` | `software` |
| `testing` | `software` |
| `devops` | `platform` |
| `data-analysis` | `ai` |
| `data-engineering` | `ai` |
| `data-governance` | `ai` |

无对应序列：`product`、`sales`。当前持有这些 domain 的演示员工共 7 人（销售：唐丽、曹静、冯刚、孔明；产品：谢敏、邓超；项目管理：韩雪），在三序列下没有可归属的专家身份。M1 重写种子时二选一：改岗到三序列内，或保留员工但清空 domain 并标注「超出 MVP 序列范围」。

---

## 7. 需要你确认的 4 件事

1. **层级名称**：三条序列的 T1 都叫「初级软件开发工程师」，是库内既有定义。三条序列 T1 同名是否符合实际（还是分别改成「初级平台工程师」「初级 AI 工程师」）？
2. **每层 4~5 项要求够不够**：既有数据是每层固定 4 项，本次每层补到 5 项。够支撑 Gap 与申请演示，但覆盖偏窄；要不要再补到 6~7 项？
3. **提高要求的位置**：`java-go-eng` 在 T3 提到 L4、T4 到 L5；`k8s` 在 T3 提到 L4、T4 到 L5。这类「同一技能逐层提高」的节奏是否符合实际？
4. **`is_auto` 口径**：T1 走「技能组合自动核验」，T2 及以上走人工审批 + 综合实践说明。这个切分是否符合制度预期？

---

校验：序列 slug 与库内一致（4 条），层级代码与名称与 `career_node` 逐条一致，技能 slug 全部可解析（库内 81 项 + 新增 0 项），子能力引用完整，等级取值 1~5，同一技能只在等级提高时重复出现。
