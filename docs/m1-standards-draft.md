# M1 标准草稿 v0.1 · 13 条序列 × 4 层职称

> **用途**：M1 数据底座的种子输入，供业务复核后固化进 `mvp_title_track` / `mvp_title_level` / `mvp_title_requirement` / `mvp_competency`。
> **来源文件**：`server/database/seed/standards-draft.json`（本文件由 `scripts/render-standards-draft.mjs` 生成，改内容请改 JSON）
> **生成时间**：2026-10-20　**标准版本**：v2026-q4　**标记**：MVP 假定标准（assumed）

> 层级名称与技能矩阵为通用草稿，未经公司制度确认。`java` / `data-analysis` / `sales` 三条标为精编口径，其余 10 条为 AI 草稿口径。

---

## 1. 序列总览

| # | 序列 | 名称 | 类别 | 路径 | 层级数 | 来源 |
|---|---|---|---|---|---|---|
| 1 | `java` | Java 工程师 | 研发技术 | 单路径 | 4 | 精编 |
| 2 | `frontend` | 前端工程师 | 研发技术 | 单路径 | 4 | AI 草稿 |
| 3 | `python` | Python 工程师 | 研发技术 | 单路径 | 4 | AI 草稿 |
| 4 | `qa` | 测试与质量工程师 | 研发技术 | 单路径 | 4 | AI 草稿 |
| 5 | `sre` | 运维与可靠性工程师 | 研发技术 | 单路径 | 4 | AI 草稿 |
| 6 | `algorithm` | 算法工程师 | 研发技术 | 单路径 | 4 | AI 草稿 |
| 7 | `data-analysis` | 数据分析师 | 数据 | 单路径 | 4 | 精编 |
| 8 | `data-eng` | 数据工程师 | 数据 | 单路径 | 4 | AI 草稿 |
| 9 | `data-gov` | 数据治理工程师 | 数据 | 单路径 | 4 | AI 草稿 |
| 10 | `sales` | 销售 | 业务与管理 | 双路径（专业/管理） | 8 | 精编 |
| 11 | `product` | 产品经理 | 业务与管理 | 单路径 | 4 | AI 草稿 |
| 12 | `project-mgmt` | 项目管理 | 业务与管理 | 单路径 | 4 | AI 草稿 |
| 13 | `customer-success` | 客户成功 | 业务与管理 | 单路径 | 4 | AI 草稿 |

合计 **13 条序列、56 个职称层级、258 条技能要求**（null 不计）。

---

## 2. 职称层级与技能要求

> 单元格为该层要求的最低技能等级；`—` 表示该层不要求此技能。技能名后的 `*` 为本次新增技能。

### Java 工程师（`java`）

| 技能 | T1 初级 Java 工程师 | T2 中级 Java 工程师 | T3 高级 Java 工程师 | T4 资深 Java 工程师 |
|---|---|---|---|---|
| java-go-eng | L2 | L3 | L4 | L5 |
| sys-design | — | L2 | L3 | L5 |
| domain-arch | — | L1 | L3 | L5 |
| programming | L2 | L3 | L3 | L4 |
| code-quality | L2 | L3 | L4 | L4 |
| testing | L1 | L2 | L3 | L4 |

### 前端工程师（`frontend`）

| 技能 | T1 初级前端工程师 | T2 中级前端工程师 | T3 高级前端工程师 | T4 资深前端工程师 |
|---|---|---|---|---|
| frontend-eng * | L2 | L3 | L4 | L5 |
| frontend-arch * | — | L2 | L4 | L5 |
| programming | L2 | L3 | L3 | L4 |
| sys-design | — | L2 | L3 | L4 |
| code-quality | L2 | L3 | L3 | L4 |

### Python 工程师（`python`）

| 技能 | T1 初级 Python 工程师 | T2 中级 Python 工程师 | T3 高级 Python 工程师 | T4 资深 Python 工程师 |
|---|---|---|---|---|
| python-eng * | L2 | L3 | L4 | L5 |
| programming | L2 | L3 | L3 | L4 |
| data-processing | L1 | L2 | L3 | L4 |
| automation-dev | — | L2 | L3 | L4 |
| code-quality | L2 | L2 | L3 | L4 |

### 测试与质量工程师（`qa`）

| 技能 | T1 初级测试工程师 | T2 中级测试工程师 | T3 高级测试工程师 | T4 质量专家 |
|---|---|---|---|---|
| testing | L2 | L3 | L4 | L5 |
| auto-testing | — | L2 | L4 | L5 |
| quality-awareness | L2 | L3 | L4 | L4 |
| code-quality | L2 | L3 | L3 | L4 |
| engineering-quality | — | L1 | L3 | L4 |

### 运维与可靠性工程师（`sre`）

| 技能 | T1 初级运维工程师 | T2 中级运维工程师 | T3 高级可靠性工程师 | T4 可靠性专家 |
|---|---|---|---|---|
| stability-gov | L1 | L2 | L4 | L5 |
| observability | L2 | L3 | L4 | L5 |
| k8s | L2 | L3 | L4 | L5 |
| slo-design | — | L1 | L3 | L5 |
| incident-response | L1 | L2 | L3 | L4 |
| capacity-gov | — | L2 | L3 | L4 |

### 算法工程师（`algorithm`）

| 技能 | T1 初级算法工程师 | T2 中级算法工程师 | T3 高级算法工程师 | T4 算法专家 |
|---|---|---|---|---|
| machine-learning | L2 | L3 | L4 | L5 |
| model-eng | L1 | L2 | L4 | L5 |
| distributed-training | — | L1 | L3 | L5 |
| model-eval | — | L2 | L3 | L4 |
| data-processing | L2 | L2 | L3 | L4 |

### 数据分析师（`data-analysis`）

| 技能 | T1 初级数据分析师 | T2 数据分析师 | T3 高级数据分析师 | T4 数据分析专家 |
|---|---|---|---|---|
| data-analysis | L2 | L3 | L4 | L5 |
| data-processing | L2 | L3 | L3 | L4 |
| requirements | L1 | L2 | L3 | L4 |
| business-exploration | — | L2 | L3 | L4 |
| communication | L1 | L2 | L3 | L4 |

### 数据工程师（`data-eng`）

| 技能 | T1 初级数据工程师 | T2 数据工程师 | T3 高级数据工程师 | T4 数据架构专家 |
|---|---|---|---|---|
| data-processing | L2 | L3 | L4 | L5 |
| distributed-sys | — | L1 | L3 | L5 |
| data-loop | — | L2 | L3 | L4 |
| k8s | — | L2 | L3 | L4 |
| data-quality-gov | — | L1 | L3 | L4 |

### 数据治理工程师（`data-gov`）

| 技能 | T1 初级数据治理工程师 | T2 数据治理工程师 | T3 高级数据治理工程师 | T4 数据治理专家 |
|---|---|---|---|---|
| data-quality-gov | L2 | L3 | L4 | L5 |
| data-processing | L2 | L2 | L3 | L4 |
| risk-mgmt | — | L2 | L3 | L4 |
| security-gov | — | L1 | L3 | L4 |
| org-governance | — | — | L2 | L4 |

### 销售（`sales`）

**专业路径**

| 技能 | P1 销售代表 | P2 客户经理 | P3 高级客户经理 | P4 销售专家 |
|---|---|---|---|---|
| sales-discovery * | L2 | L3 | L4 | L5 |
| sales-negotiation * | L1 | L2 | L4 | L5 |
| key-account * | — | L2 | L4 | L5 |
| sales-pipeline * | L2 | L3 | L4 | L4 |
| business-planning | — | L1 | L2 | L3 |

**管理路径**

| 技能 | M1 销售主管 | M2 销售经理 | M3 销售总监 | M4 销售负责人 |
|---|---|---|---|---|
| sales-pipeline * | L2 | L3 | L4 | L5 |
| key-account * | L2 | L3 | L4 | L5 |
| business-planning | — | L1 | L3 | L5 |
| talent-dev | — | L2 | L3 | L4 |
| resource-allocation | — | L1 | L3 | L4 |

### 产品经理（`product`）

| 技能 | T1 产品助理 | T2 产品经理 | T3 高级产品经理 | T4 产品专家 |
|---|---|---|---|---|
| requirements | L2 | L3 | L4 | L5 |
| product-design * | L2 | L3 | L4 | L5 |
| user-research * | L1 | L2 | L3 | L4 |
| business-planning | — | L2 | L3 | L4 |
| project-planning | — | L1 | L3 | L4 |

### 项目管理（`project-mgmt`）

| 技能 | T1 项目助理 | T2 项目经理 | T3 高级项目经理 | T4 项目管理专家 |
|---|---|---|---|---|
| project-planning | L2 | L3 | L4 | L5 |
| risk-mgmt | L1 | L2 | L3 | L5 |
| resource-allocation | — | L2 | L3 | L4 |
| cross-team-synergy | L1 | L2 | L3 | L4 |
| task-delivery | L2 | L3 | L3 | L4 |

### 客户成功（`customer-success`）

| 技能 | T1 客户成功专员 | T2 客户成功经理 | T3 高级客户成功经理 | T4 客户成功专家 |
|---|---|---|---|---|
| cs-value * | L1 | L2 | L4 | L5 |
| cs-onboarding * | L2 | L3 | L4 | L4 |
| cs-renewal * | — | L2 | L3 | L4 |
| communication | L1 | L2 | L3 | L4 |
| business-exploration | — | L1 | L3 | L4 |

---

## 3. 新增技能与分类

现有 81 项技能集中在机器人、自动驾驶、平台与 AI 方向，销售、客户成功、前端、产品缺少对应技能，因此新增以下条目。

| 技能 | 名称 | 归入分类 |
|---|---|---|
| `frontend-eng` | 前端工程化 | coding-eng |
| `frontend-arch` | 前端架构 | coding-eng |
| `python-eng` | Python 工程化 | coding-eng |
| `sales-discovery` | 客户开拓 | commerce |
| `sales-negotiation` | 商务谈判 | commerce |
| `key-account` | 大客户经营 | commerce |
| `sales-pipeline` | 销售漏斗管理 | commerce |
| `cs-onboarding` | 客户上手与成功计划 | commerce |
| `cs-value` | 价值交付与复盘 | commerce |
| `cs-renewal` | 续约与增购 | commerce |
| `product-design` | 产品设计 | business |
| `user-research` | 用户研究 | business |

新增分类：`commerce`（商务与客户成功）

新增技能合计 **12 项**，技能总量 81 → 93。

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
| `commercial-close` | GEN-CLOSE | 商务成交 | 推动商机进入签约与回款 |
| `customer-value` | GEN-CVALUE | 客户价值 | 把客户目标转成可验证的业务结果 |

### 4.2 序列专业子能力

| 序列 | slug | 编码 | 名称 | 定义 |
|---|---|---|---|---|
| java | `java-modeling` | JAVA-MODEL | 领域建模 | 把业务规则收敛为清晰的领域模型与边界 |
| java | `java-runtime` | JAVA-RUN | 运行时治理 | JVM、并发与资源使用的调优与治理 |
| frontend | `fe-interaction` | FE-UX | 交互实现 | 把设计稿与交互意图准确还原并处理边界态 |
| frontend | `fe-performance` | FE-PERF | 前端性能 | 加载、渲染与交互性能的度量与优化 |
| python | `py-dataflow` | PY-DATA | 数据流处理 | 用脚本与管道处理结构化/非结构化数据 |
| python | `py-automation` | PY-AUTO | 自动化编排 | 把重复工作转成可维护的自动化流程 |
| qa | `qa-strategy` | QA-STRAT | 测试策略 | 按风险分层设计测试范围与投入 |
| qa | `qa-automation` | QA-AUTO | 自动化体系 | 建设可维护的自动化与质量门禁 |
| sre | `sre-slo` | SRE-SLO | SLO 与容量 | 以 SLO 定义可靠性目标并管理容量 |
| sre | `sre-incident` | SRE-IR | 故障应急 | 故障定位、止损、复盘与改进闭环 |
| algorithm | `algo-model` | ALGO-MODEL | 模型方案 | 从数据与指标出发选择并训练模型方案 |
| algorithm | `algo-eval` | ALGO-EVAL | 离线与在线评估 | 设计评估口径并解释模型效果差异 |
| data-analysis | `da-metric` | DA-METRIC | 指标体系 | 定义指标口径并保证可解释、可复用 |
| data-analysis | `da-insight` | DA-INSIGHT | 分析洞察 | 从数据中得出结论并推动决策 |
| data-eng | `de-pipeline` | DE-PIPE | 数据管道 | 设计与维护稳定可回溯的数据链路 |
| data-eng | `de-model` | DE-MODEL | 数据建模 | 分层建模并控制口径与冗余 |
| data-gov | `dg-standard` | DG-STD | 数据标准 | 制定并落地数据标准与责任边界 |
| data-gov | `dg-quality` | DG-QUALITY | 质量度量 | 建立质量规则、监控与整改闭环 |
| sales | `sales-funnel` | SALES-FUNNEL | 商机推进 | 按阶段推进商机并提升转化 |
| product | `pd-discovery` | PD-DISC | 需求发现 | 从用户与业务中发现值得做的问题 |
| product | `pd-prioritize` | PD-PRIO | 优先级取舍 | 在资源约束下决定做什么与不做什么 |
| project-mgmt | `pm-plan` | PM-PLAN | 计划与里程碑 | 拆解目标、识别关键路径并守住节点 |
| project-mgmt | `pm-stakeholder` | PM-STAKE | 干系人管理 | 识别关键干系人并管理预期 |
| customer-success | `cs-adoption` | CS-ADOPT | 客户采用 | 推动客户真正用起来并形成习惯 |
| customer-success | `cs-health` | CS-HEALTH | 客户健康度 | 以数据判断流失风险并提前干预 |

### 4.3 技能 → 子能力映射规则

为避免「81 项技能 × 5 级 × N 个子能力」的手工爆炸，映射按**技能分类**统一挂载，生成时对等级 1~5 展开：

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
| commerce | commercial-close、customer-value、collab-deliver |
| business | req-clarify、solution-design、collab-deliver |
| org-mgmt | system-build、coach-others、cross-team-drive |
| collaboration | collab-deliver、cross-team-drive、knowledge-share |
| collab-impact | cross-team-drive、coach-others、knowledge-share |
| problem-solving | troubleshoot、tech-decision、risk-identify |
| rd-efficiency | impl-delivery、system-build、knowledge-share |

规则：某技能的应考子能力 = 该分类子能力 ∪ 所属序列专业子能力；子能力要求等级 = 该职称层对该技能的要求等级（同层对齐）。

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

## 6. 需要你确认的 5 件事

1. **层级名称**：`T1~T4` 的「初级/中级/高级/资深」是否可作为公司口径？销售用了 `P1~P4` + `M1~M4` 双路径，是否符合实际职级体系？
2. **新增 12 项技能**：销售 4 项、客户成功 3 项、产品 2 项、前端 2 项、Python 1 项，是否都保留？有没有公司已有的叫法需要对齐？
3. **技能矩阵的等级节奏**：核心技能 `L2→L3→L4→L5` 逐层递增、支撑技能 `L1→L2→L3→L4`，这个节奏是否偏严或偏松？
4. **销售双路径**：专业线与管理线的层级名称、以及管理线从哪一层开始带团队（现在是 M1 销售主管起）是否合适？
5. **`is_auto` 口径**：草稿把 T1 的处理为「技能组合自动核验」，T2 及以上走人工审批 + 综合实践说明。确认这个切分是否符合制度预期。

---

校验：技能 slug 全部可解析（库内 81 项 + 新增 12 项），子能力引用完整，等级取值均在 1~5。
