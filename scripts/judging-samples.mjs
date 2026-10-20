/**
 * 判断层（M2）演示认证样本
 *
 * 目的：让 `mvp_employee_skill` 的达标度呈现梯度，M2 的资格/Gap/候选三处才有对比可看。
 * M1 结束时 24 人里只有 5 人有认证，绝大多数人的 Gap 都是「4 项全未达标」，
 * 演示不出「可申请」「只差一项」这两种真实状态。
 *
 * 三档设计（对应三条技术序列）：
 *   1. 可申请     —— 该层 4 条要求全部达标，且未持有该职称
 *   2. 只差一项   —— 3/4 达标，剩下一项差 1 级 → 证据类候选
 *   3. 差得多     —— 1/4 或 0/4，仍需长期积累
 *
 * 约束：skill_slug 必须存在于 skill 表（该列没有外键，写错不会报错）。
 * 这些数据同时被 seed-enterprise-data.mjs（新库重建）和 seed-judging-samples.mjs（存量补齐）引用，
 * 改这里两边同时生效。
 */

/** 可申请：王芳（Java 组工程师）→ software T1 四项全达标 */
const READY_SOFTWARE_T1 = [
  { employee: 'wang-fang', skill: 'requirements', level: 2, certifiedAt: '2025-09-10' },
  { employee: 'wang-fang', skill: 'programming', level: 2, certifiedAt: '2025-08-22' },
  { employee: 'wang-fang', skill: 'auto-testing', level: 2, certifiedAt: '2025-10-08' },
  { employee: 'wang-fang', skill: 'code-quality', level: 2, certifiedAt: '2025-11-19' },
];

/** 只差一项：张伟（Java 高级工程师）→ software T2 差 system-design-split 1 级 */
const NEAR_SOFTWARE_T2 = [
  // java-go-eng 已在初始种子里是 L2，这里补一条 L3 作为新认证；判定取 max(level)
  { employee: 'zhang-wei', skill: 'java-go-eng', level: 3, certifiedAt: '2026-03-11' },
  { employee: 'zhang-wei', skill: 'engineering-quality', level: 3, certifiedAt: '2026-02-06' },
  { employee: 'zhang-wei', skill: 'collaboration', level: 3, certifiedAt: '2026-04-17' },
  { employee: 'zhang-wei', skill: 'sys-design-split', level: 2, certifiedAt: '2026-05-09' },
];

/** 可申请（跨级）：李娜（Java 技术专家）→ software T3 四项全达标，未持有任何职称 */
const READY_SOFTWARE_T3 = [
  { employee: 'li-na', skill: 'proposal-decision', level: 4, certifiedAt: '2025-04-14' },
  { employee: 'li-na', skill: 'perf-capacity', level: 4, certifiedAt: '2025-06-30' },
  { employee: 'li-na', skill: 'distributed-sys', level: 4, certifiedAt: '2025-09-25' },
  { employee: 'li-na', skill: 'tech-influence', level: 3, certifiedAt: '2025-12-03' },
];

/** 只差一项：林晓（数据工程）→ ai T2 差 data-processing 3 级 */
const NEAR_AI_T2 = [
  { employee: 'lin-xiao', skill: 'ai-integration', level: 3, certifiedAt: '2026-01-16' },
  { employee: 'lin-xiao', skill: 'product-collab', level: 3, certifiedAt: '2026-02-27' },
  { employee: 'lin-xiao', skill: 'model-eval', level: 3, certifiedAt: '2026-03-30' },
];

/** 只差一项：刘伟（高级运维）→ platform T2 差 k8s 1 级 */
const NEAR_PLATFORM_T2 = [
  { employee: 'liu-wei', skill: 'cloud-platform-dev', level: 3, certifiedAt: '2025-11-05' },
  { employee: 'liu-wei', skill: 'observability-building', level: 3, certifiedAt: '2026-01-22' },
  { employee: 'liu-wei', skill: 'k8s', level: 2, certifiedAt: '2026-04-02' },
];

export const JUDGING_SAMPLE_SKILLS = [
  ...READY_SOFTWARE_T1,
  ...NEAR_SOFTWARE_T2,
  ...READY_SOFTWARE_T3,
  ...NEAR_AI_T2,
  ...NEAR_PLATFORM_T2,
];

/** 样本说明，供脚本输出对照 */
export const JUDGING_SAMPLE_EXPECTATION = [
  { employee: 'wang-fang', track: 'software', level: 'T1', state: 'ready', detail: '4/4 达标' },
  { employee: 'zhang-wei', track: 'software', level: 'T2', state: 'preparing', detail: '3/4 达标，差系统设计与拆分 1 级' },
  { employee: 'li-na', track: 'software', level: 'T3', state: 'ready', detail: '4/4 达标，跨级申请' },
  { employee: 'lin-xiao', track: 'ai', level: 'T2', state: 'preparing', detail: '3/4 达标，差数据处理 3 级' },
  { employee: 'liu-wei', track: 'platform', level: 'T2', state: 'preparing', detail: '3/4 达标，差容器与编排 1 级' },
];

/**
 * 学习资源演示数据（mvp_learning_resource 为空表时资源推荐无从验证）。
 * kind 受 CHECK 约束：course / project / training。
 * targets 指向 mvp_competency 的 21 个子能力 slug，指向不存在的 slug 会被脚本拒绝。
 */
export const JUDGING_SAMPLE_RESOURCES = [
  {
    slug: 'res-ddd-modeling', kind: 'course', title: '领域驱动设计实战工作坊',
    description: '通过一个真实订单系统完成限界上下文划分与领域建模演练。',
    url: 'https://demo.skilltree.local/ddd-workshop',
    targets: ['sw-modeling', 'solution-design', 'tech-decision'],
    estimatedEffort: '12 小时 · 4 周', evidenceTemplate: '提交一份目标系统的限界上下文图与聚合设计说明',
  },
  {
    slug: 'res-code-review', kind: 'training', title: '代码评审与质量门禁实操',
    description: '在公司真实仓库上完成 5 次有效评审，沉淀评审清单。',
    targets: ['quality-gate', 'sw-maintain', 'impl-delivery'],
    estimatedEffort: '6 小时 · 3 周', evidenceTemplate: '提交评审记录与被采纳的改进项清单',
  },
  {
    slug: 'res-distributed', kind: 'project', title: '分布式改造专题：把单体拆出第一个服务',
    description: '在导师指导下完成一个模块的服务化拆分并上线观察。',
    targets: ['sw-runtime', 'troubleshoot', 'system-build'],
    estimatedEffort: '6 周', evidenceTemplate: '提交拆分方案、压测数据与上线复盘',
  },
  {
    slug: 'res-sre-handbook', kind: 'course', title: 'SRE 实践：可靠性目标与故障演练',
    description: '以平台某个核心服务为例制定 SLO 并完成一次故障演练。',
    url: 'https://demo.skilltree.local/sre-course',
    targets: ['pf-slo', 'pf-incident', 'troubleshoot'],
    estimatedEffort: '10 小时 · 3 周', evidenceTemplate: '提交 SLO 定义文档与演练复盘报告',
  },
  {
    slug: 'res-k8s-prod', kind: 'training', title: 'K8s 生产环境进阶训练',
    description: '从部署到扩缩容、滚动发布与回滚，覆盖平台日常运维动作。',
    targets: ['pf-slo', 'system-build'],
    estimatedEffort: '8 小时 · 2 周', evidenceTemplate: '提交一次真实发布的操作记录与变更说明',
  },
  {
    slug: 'res-platform-product', kind: 'training', title: '平台产品化思维分享',
    description: '如何把内部平台当产品运营：用户调研、路线图与采纳度量。',
    targets: ['pf-product', 'cross-team-drive', 'knowledge-share'],
    estimatedEffort: '2 小时', evidenceTemplate: '提交一份平台能力采纳度分析',
  },
  {
    slug: 'res-data-loop', kind: 'course', title: '数据闭环设计：从埋点到特征回流',
    description: '以一个 AI 应用为例打通数据采集、清洗、特征与评估回流。',
    url: 'https://demo.skilltree.local/data-loop',
    targets: ['ai-loop', 'ai-model', 'ai-eval'],
    estimatedEffort: '14 小时 · 4 周', evidenceTemplate: '提交数据闭环设计文档与一次回流验证结果',
  },
  {
    slug: 'res-model-eval', kind: 'training', title: '模型评估实操：构造离线与在线评估集',
    description: '针对一个真实业务模型，建立可复现的评估集与指标基线。',
    targets: ['ai-eval', 'ai-model'],
    estimatedEffort: '10 小时 · 3 周', evidenceTemplate: '提交评估集构建脚本与基线报告',
  },
  {
    slug: 'res-tech-influence', kind: 'training', title: '技术影响力：从知识沉淀到跨团队推动',
    description: '如何把个人经验转化为团队资产，并推动跨团队技术决策。',
    targets: ['knowledge-share', 'coach-others', 'cross-team-drive'],
    estimatedEffort: '2 小时', evidenceTemplate: '提交一次内部分享的讲稿与反馈记录',
  },
];
