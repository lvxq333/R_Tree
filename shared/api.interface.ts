/* 前后端共享的类型写在这里 —— 技能树·人才管理 契约 */

/* ========== 基础枚举 ========== */
export type Role = 'employee' | 'manager';

export interface AuthUser {
  accountId: string;
  employeeId: string;
  username: string;
  name: string;
  feishuLinked: boolean;
  employeeSlug: string;
  accessRole: Role;
  org: string;
  position: string;
  department: string;
  jobGrade: `${'T' | 'P' | 'M' | 'F'}${1 | 2 | 3 | 4}` | null;
  personnelRole: 'employee' | 'hr' | 'expert';
}
export interface RegisterInput { username: string; password: string; name: string; org?: string; position?: string; hireDate?: string }
export interface AuthConfig { feishuEnabled: boolean; ssoEnabled: boolean; validationMode?: boolean }

/* 事实中心基础契约：事实不等于能力评估或技能认证。 */
export const FACT_KINDS = ['project', 'performance', 'legacy_evidence', 'git_commit', 'okr', 'employee_transfer', 'work_artifact'] as const;
export interface FactRecord {
  id: string;
  employeeId: string;
  sourceTable: string;
  sourceKey: string;
  kind: typeof FACT_KINDS[number];
  title: string;
  occurrenceLabel: string | null;
  content: Record<string, unknown>;
  version: number;
  status: 'active' | 'deleted';
  provenance: 'local_legacy_import' | 'simulated' | 'validation_fixture' | 'manager_entered';
  updatedAt: string;
}
export interface FactChange {
  cursor: string;
  operation: 'created' | 'updated' | 'deleted';
  fact: FactRecord;
  recordedAt: string;
}
export interface FactCenterStatus {
  employee: { name: string; slug: string; org: string | null; role: string | null; hireDate: string | null } | null;
  adapter: 'local-database';
  externalConnected: false;
  pollIntervalSeconds: number;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  healthy: boolean;
  employeeId: string;
  activeCount: number;
  deletedCount: number;
  countsByKind: Record<string, number>;
  assessment: 'not-configured' | 'available';
  unavailableSources: string[];
  simulatedSources: string[];
}
export interface EmployeeWideRow {
  employeeId: string;
  employeeSlug: string;
  name: string;
  role: string | null;
  org: string | null;
  status: string | null;
  hireDate: string | null;
  summary: string | null;
  department: string | null;
  jobGrade: string | null;
  personnelRole: string;
  workLocation: string | null;
  preferredTrack: string | null;
  isDemo: boolean;
  factCount: number;
  projectCount: number;
  performanceCount: number;
  evidenceCount: number;
  otherFactCount: number;
  latestFactAt: string | null;
  factTitles: string[];
  refreshedAt: string;
}
export interface TeamSkillMapRow { skillSlug: string; name: string; employeeCount: number; maxLevel: number }
export interface ManagerDashboardResponse {
  filters: { roles: string[]; grades: string[] };
  scope: { employeeCount: number; standardEmployeeCount: number; requirementCount: number; metCount: number;
    p0GapCount: number; planCount: number; completedActionCount: number; actionCount: number };
  // heat：技能等级供给变化。threshold = 该职级标准对该技能要求的等级（null 表示该职级不要求此技能）
  // met/pastMet = 现在 / 30 天前技能等级达到该门槛的人数；gained/lost = 期间新增达标 / 达标失效人数
  heat: { skillSlug: string; name: string;
    grades: { grade: string; threshold: number | null; met: number; pastMet: number; gained: number; lost: number }[] }[];
  risks: { kind: 'gap' | 'expiry' | 'standard'; severity: 'high' | 'medium'; title: string; detail: string;
    employeeSlug?: string;
    employees?: { slug: string; name: string; grade: string | null; role: string | null; note: string }[] }[];
  members: { employeeSlug: string; name: string; role: string; grade: string | null; target: string;
    p0Gaps: number; progress: number | null; nextCheckin: string | null }[];
  calculatedAt: string;
}
// 热力图单元格明细：某技能 × 某职级门槛下的达标成员名单（权限口径与 manager-overview 一致）
export interface HeatDetailResponse {
  skillSlug: string; skillName: string; grade: string; threshold: number | null;
  met: number; gained: number;
  employees: { slug: string; name: string; grade: string | null; department: string | null; role: string | null;
    level: number; certifiedAt: string | null; gained: boolean }[];
}
export type GapSource = 'career' | 'okr' | 'current' | 'profile';

export interface AbilityStandard {
  id: string;
  name: string;
  anchors: string[]; // L1~L5，按数组顺序
  evidenceRequirements?: string[];
}
export interface SkillAssessmentStandard {
  skillSlug: string;
  name: string;
  version: string;
  hash: string;
  abilities: AbilityStandard[];
  description?: string;
  managed?: boolean;
  configuredLevels?: number[];
}
export interface AssessmentCitation { factId: string; version: number; quote: string }
export interface AbilityAssessment {
  abilityId: string;
  supportedLevel: number | null;
  reason: string;
  citations: AssessmentCitation[];
  gaps: string[];
  questions: string[];
}
export interface AssessmentResult {
  abilities: AbilityAssessment[];
  supportedCount: number;
  gapCount: number;
  totalCount: number;
}
export interface SkillAssessment {
  id: string;
  simulated: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed';
  targetLevel: number;
  standardVersion: string;
  factIds: string[];
  selfMaterial: string;
  result: AssessmentResult | null;
  error: string | null;
  stale: boolean;
  createdAt: string;
}
export interface AssessmentMaterial {
  id: string;
  version: number;
  title: string;
  kind: FactRecord['kind'];
  detail: string;
  recommended: boolean;
  simulated: boolean;
}
export interface AssessmentWorkspace {
  standard: SkillAssessmentStandard;
  materials: AssessmentMaterial[];
  latest: SkillAssessment | null;
}
export interface CreateAssessmentInput { targetLevel: number; factIds: string[]; selfMaterial: string }
export interface CandidateSuggestion {
  skillSlug: string;
  targetLevel: number;
  reason: string;
  limitations: string[];
  citations: AssessmentCitation[];
}
export interface CandidateDiscoveryResult {
  candidates: CandidateSuggestion[];
  notSuggested: { skillSlug: string; reason: string }[];
}
export interface ValidationWorkspace {
  testOnly: true;
  materials: FactRecord[];
  job: { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; error: string | null; model: string; result: CandidateDiscoveryResult | null } | null;
  notices: { id: string; title: string; message: string; certificationSlug: string; citations: AssessmentCitation[]; readAt: string | null; status: string; createdAt: string }[];
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'maintained' | 'extended';
export type ApprovalAction = 'approve' | 'return' | 'reject' | 'maintain' | 'extend' | 'downgrade';
export type CertificationDecision = 'submit' | 'resubmit' | 'dismiss' | 'add-evidence' | 'explain';
export type CertificationFilter = 'all' | 'approved' | 'review' | 'manual' | 'worklog' | 'performance';
export type GrowthRange = '6m' | '12m' | 'all';
export type IdpActionKind = 'learn' | 'practice' | 'mentor' | 'deliver';

/* ========== 员工与画像 ========== */
export interface EmployeeListItem {
  id: string;
  name: string;
  avatar: string;
  tone: string;
  role: string;
  org: string;
}

/** 当前登录员工的基础工作台数据；身份与权限以服务端会话为准。 */
export interface EmployeeWorkspaceResponse {
  workFactCount: number;
  employee: {
    id: string;
    slug: string;
    name: string;
    avatar: string;
    role: string;
    org: string;
    summary: string;
    hireDate: string | null;
    tenureMonths: number | null;
    company: string | null;
    jobGrade: string | null;
    workLocation: string | null;
  };
  metrics: {
    certifiedSkillCount: number;
    averageSkillLevel: number | null;
    superEmployeeLevel: number | null;
    recentUpgradeCount: number;
    candidateCount: number;
    maturity: { expert: number; core: number; growth: number };
  };
  databaseUpdatedAt: string;
  loadedAt: string;
  factsSync: {
    status: 'not-connected' | 'idle' | 'syncing' | 'error';
    pollIntervalSeconds: number;
    lastCheckedAt: string | null;
    lastChangedAt: string | null;
  };
  source: 'local-demo';
}

export interface ProfileSkillMeta {
  lastUsed?: string;
  status?: string;
}

export type ProfileSkillRecord = {
  name: string;
  category: string;
  level: string;
  evidence: string;
  expiry: string;
  meta?: ProfileSkillMeta;
};

export interface ProfileProject {
  time: string;
  title: string;
  responsibility: string;
  actions: string;
  outcome: string;
  impact: string;
  contribution: string;
  skills: string[];
  verification: string;
}

export interface ManagementProfile {
  hasTeam: boolean;
  scope: string;
  years: string;
  style: string;
  styleDetail: string;
  collaborationFit: string;
}

export interface ProfileDemographics {
  age: string;
  gender: string;
  education: string;
  tenure: string;
}

export interface EmployeeProfile {
  id: string;
  name: string;
  avatar: string;
  tone: string;
  role: string;
  org: string;
  status: string;
  updated: string;
  summary: string;
  summaryDescription: string;
  availability: string;
  tenureSummary: string;
  experience: [string, string, string][];
  responsibilities: [string, string, string][];
  traits: [string, string, string, string][];
  skills: ProfileSkillRecord[];
  projects: ProfileProject[];
  performance: [string, string, string][];
  demographics: ProfileDemographics | null;
  management: ManagementProfile | null;
  collaboration: [string, string][];
}

/* ========== 技能字典 ========== */
export interface SkillCategoryNode {
  slug: string;
  name: string;
  kind: 'professional' | 'generic';
  children: { slug: string; name: string; skills: SkillNode[] }[];
}

export interface SkillNode {
  slug: string;
  name: string;
  levels: string[];
}

export interface SkillTreeResponse {
  categories: SkillCategoryNode[];
}

export interface SkillRelationEdge {
  fromSkillSlug: string;
  toSkillSlug: string;
  sharedCompetencies: string[];
  sharedTitleLevels: string[];
}

export interface SkillRelationsResponse {
  edges: SkillRelationEdge[];
}

/* ========== 认证（技能点亮记录） ========== */
export interface CertificationEvidence {
  type: string;
  title: string;
  detail: string;
}

export interface CertificationItem {
  id: string;
  skillSlug: string | null;
  historical?: boolean;
  source: string;
  sourceShort: string;
  sourceLabel: string;
  title: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  confidence: number;
  status: string;
  statusLabel: string;
  explanation: string;
  anchor: string;
  evidence: CertificationEvidence[];
  deadline: string;
  approvedAt: string | null;
}

export interface SelfApplicationInput {
  standardHash?: string;
  skill: string;
  skillSlug: string;
  level: number;
  evidenceType: string;
  evidenceTitle: string;
  evidenceLink: string;
  note: string;
}

/* ========== 审批 ========== */
/** 催办状态：次数、最近一次时间、当前账号能否催办与不可催办的原因，全部由后端判定 */
export interface ApprovalReminderState {
  count: number;
  /** 最近一次催办时间（已格式化，如 10-23 15:20） */
  lastAt: string | null;
  canRemind: boolean;
  /** 不可催办的真实业务原因，前端直接展示 */
  reason: string | null;
}

export interface ApprovalItem {
  id: string;
  linkedId: string | null;
  kind: 'application' | 'downgrade';
  applicant: string;
  avatar: string;
  department: string;
  title: string;
  currentLevel: number;
  targetLevel: number;
  sourceLabel: string;
  submittedAt: string;
  due: string;
  /** 队列状态标记，业务判定全部在后端完成：processed=已处理（status 非 pending）；overdue=待处理但已过 SLA 期限；active=处理中未逾期 */
  dueState: 'active' | 'overdue' | 'processed';
  status: ApprovalStatus;
  detail: string | null;
  employeeResponse: string | null;
  evidence: CertificationEvidence[];
  anchor: string | null;
  reminder: ApprovalReminderState;
}

/** 催办结果：写入催办记录后的最新审批单状态 */
export interface ApprovalRemindResult {
  approval: ApprovalItem;
  /** 本次催办已送达的审批人范围说明（后端按可见范围计算） */
  deliveredTo: string;
}

/** 审批工作台顶部统计（后端按当前账号可见范围实时计算） */
export interface ApprovalStats {
  pending: number;
  downgrade: number;
  processedThisMonth: number;
}

export interface ManagerReviewInput {
  personName: string;
  skill: string;
  currentLevel: number;
  targetLevel: number;
  reason: string;
  evidence: string;
}

/* ========== 成长概览 ========== */
export interface CareerNodeSkill {
  /** 有效技能认证的实际等级；未认证时不提供，不以职称覆盖或基线代替。 */
  certifiedLevel?: number;
  isRequired?: boolean;
  name: string;
  current: number;
  target: number;
  /** current 的来源：cert 有效认证；title-covered 职称覆盖；title-baseline 职称基线（下一层新技能的入门理解）；skill-covered 认证覆盖（按实际掌握技能核算达标） */
  source?: 'cert' | 'title-covered' | 'title-baseline' | 'skill-covered';
}

export interface CareerNode {
  id: string;
  code: string;
  title: string;
  meta: string;
  state: string;
  coverage: number;
  description: string;
  skills: CareerNodeSkill[];
  /** 已持有该层或更高层职称：技能明细按职称覆盖显示为已满足 */
  achieved: boolean;
  /** 偏好序列中最近的未达成层（推荐下一站） */
  isNext: boolean;
}

export interface CareerSequenceView {
  family?: JobFamily;
  key: string;
  label: string;
  description: string;
  nodes: CareerNode[];
}

export interface CareerResponse {
  sequences: CareerSequenceView[];
  /** 按部门/岗位推断的偏好技术序列，用于概览默认选中 */
  preferredTrack: string | null;
}

export interface SkillGrowthEvent {
  date: string;
  /** Exact event time for chronological chart placement; date is the display month. */
  occurredAt?: string;
  total: number;
  title: string;
  category: string;
  level: string;
  evidence: string;
  approver: string;
  note: string;
}

export interface GrowthEventsResponse {
  events: SkillGrowthEvent[];
  /** 近 6 个月首次点亮的技能项数（去重），用于右上角统计 */
  recentCertCount: number;
}

export interface GapPoolItem {
  source: GapSource;
  sourceLabel: string;
  title: string;
  description: string;
  filled: number;
  target: number;
  levelRange: string;
  priority: 'p0' | 'p1' | 'p2';
  /** 距目标的等级差 */
  gapLevels: number;
}

export interface GapListResponse {
  items: GapPoolItem[];
}

/** 针对 Gap 的行动建议：学习（课程/资源）、实践、导师反馈与可验证交付并重 */
export interface GapAction {
  id: string;
  kind: 'course' | 'resource' | 'practice' | 'mentor';
  badge: string;
  title: string;
  /** 对应的 Gap 条目 */
  gapTitle: string;
  detail: string;
  effort: string;
  actionLabel: string;
}

export interface GapActionsResponse {
  items: GapAction[];
}

/* ========== 能力结构分布（雷达图） ========== */
export interface AbilityAxis {
  name: string;
  /** 有效等级：认证 / 职称覆盖 / 职称基线取大 */
  current: number;
  /** 团队平均等级（同部门员工在该技能上的平均有效认证等级，1 位小数） */
  target: number;
  fromBaseline?: boolean;
}

export interface AbilityStructureResponse {
  axes: AbilityAxis[];
  /** 已持有职称层代码；无职称为 null */
  heldLevelCode: string | null;
  /** 团队口径描述（如「研发技术中心-Java组 · 3 人」）；无团队数据为 null */
  teamLabel: string | null;
  summary: string;
}

/* ========== IDP ========== */
export interface IdpAction {
  carriedOver?: boolean;
  customTitle?: boolean;
  customWindow?: boolean;
  id?: string;
  gapKey?: string;
  status?: IdpActionStatus;
  resultNote?: string;
  evidenceSlugs?: string[];
  evidence?: { slug: string; title: string; url: string | null }[];
  resourceUrl?: string | null;
  effort?: string;
  kind: IdpActionKind;
  kindLabel: string;
  title: string;
  gap: string;
  window: string;
  proof: string;
}

export interface IdpPhase {
  id?: string;
  range: string;
  title: string;
  theme: string;
  focusGaps: string[];
  objective: string;
  actions: IdpAction[];
  milestone: string;
  outcome: string;
}

export interface IdpMilestone {
  phaseId?: string;
  time: string;
  title: string;
  detail: string;
  state: 'done' | 'current' | 'next';
}

export interface IdpPositioning {
  currentRole: string;
  targetRole: string;
  horizon: string;
  readiness: number;
  readinessNote: string;
  strengths: string[];
  weaknesses: string[];
}

export interface IdpGap {
  key?: string;
  source?: string;
  skillSlug?: string;
  title: string;
  priority: string;
  note: string;
}

export interface IdpResponse {
  meta?: IdpPlanMeta;
  alignments?: IdpAlignment[];
  changes?: string[];
  positioning: IdpPositioning;
  gaps: IdpGap[];
  phases: IdpPhase[];
  milestones: IdpMilestone[];
  adjustRules: { trigger: string; action: string }[];
  reviewCadence: string;
}

/* ========== 人才候选与清单 ========== */
export interface TalentSkillCondition { skillSlug: string; level: number }
export interface TalentCriteria {
  title: string;
  required: TalentSkillCondition[];
  bonus: TalentSkillCondition[];
  keywords: string[];
  minimumAvailability: number | null;
  startMonth: string;
}
export interface TalentSkillMatch {
  skillSlug: string; name: string; requiredLevel: number; currentLevel: number; met: boolean;
}
export interface TalentWorkspace {
  prompt: string; criteria: TalentCriteria; revision: number; updatedAt: string | null;
}
export interface TalentCatalog {
  skills: { slug: string; name: string }[];
  departments: string[];
  scopeLabel: string;
  aiAvailable: boolean;
}
export interface TalentParseResponse { criteria: TalentCriteria; warnings: string[]; model: string }
export interface TalentSearchInput { criteria: TalentCriteria; departments: string[]; availabilityOnly: boolean; keyword: string }
export interface TalentSearchResponse extends TalentCandidatesResponse {
  searchedCount: number; calculatedAt: string;
}
export interface TalentCandidate {
  id: string;
  name: string;
  avatar: string;
  avatarTone: string;
  org: string;
  role: string;
  available: boolean;
  reason: string;
  note: string;
  evidence: string[];
  gap: string;
  availability: string;
  freshness: string;
  dimensions: [string, number][];
  requiredMatches?: TalentSkillMatch[];
  bonusMatches?: TalentSkillMatch[];
  projects?: { title: string; verification: string }[];
  matchedKeywords?: string[];
  availabilityPercent?: number | null;
  isDemo?: boolean;
}

export interface TalentCandidatesResponse {
  direct: TalentCandidate[];
  adjacent: TalentCandidate[];
  potential: TalentCandidate[];
}

export interface ShortlistResponse {
  items: TalentCandidate[];
}

/* ========== 梯队与继任 ========== */
export type Criticality = 'core' | 'key' | 'normal';
/** 关键岗位名录项：HR 手工指定，决定盘点对象。 */
export interface KeyPositionRecord {
  trackSlug: string;
  levelCode: string;
  criticality: Criticality;
  reason: string;
  impact: string;
}
export interface KeyPositionCatalogLevel {
  code: string;
  name: string;
  order: number;
  holders: number;
  selected: boolean;
  criticality: Criticality;
  reason: string;
  impact: string;
}
export interface KeyPositionCatalogTrack {
  slug: string;
  name: string;
  family: 'T' | 'P' | 'F' | 'M';
  levels: KeyPositionCatalogLevel[];
}
export interface KeyPositionCatalog {
  tracks: KeyPositionCatalogTrack[];
  updatedAt: string;
}
export interface KeyPositionSaveInput {
  positions: KeyPositionRecord[];
}
export interface SuccessionRequirementView {
  skillName: string;
  requiredLevel: number;
  /** 盘点范围内已达标该要求的人数。 */
  metCount: number;
}
export interface SuccessionGapView {
  skillName: string;
  current: number;
  required: number;
}
export interface SuccessionCandidateView {
  employeeId: string;
  name: string;
  avatar: string;
  tone: string;
  grade: string;
  trackName: string;
  department: string;
  role: string;
  /** 已达标项数 / 必备项数。 */
  met: number;
  total: number;
  /** 逐项达标率（0–100），决定分桶。 */
  readiness: number;
  /** 加权接近度 Σmin(现有,要求)/Σ要求（0–100），仅作参考，不影响分桶。 */
  weighted: number;
  state: 'ready' | 'developing' | 'watch';
  stateText: string;
  gaps: SuccessionGapView[];
  gapText: string;
}
export interface SuccessionIncumbentView {
  employeeId: string;
  name: string;
  avatar: string;
  tone: string;
  department: string;
  grade: string;
  tenure: string;
}
export interface SuccessionPositionView {
  slug: string;
  trackSlug: string;
  trackName: string;
  family: 'T' | 'P' | 'F' | 'M';
  levelCode: string;
  levelName: string;
  title: string;
  criticality: Criticality;
  criticalityText: string;
  reason: string;
  impact: string;
  vacancy: boolean;
  incumbents: SuccessionIncumbentView[];
  incumbentLabel: string;
  incumbentMeta: string;
  requirements: SuccessionRequirementView[];
  ready: SuccessionCandidateView[];
  developing: SuccessionCandidateView[];
  watch: SuccessionCandidateView[];
  health: 'healthy' | 'attention' | 'risk' | 'unrated';
  healthText: string;
  riskNote: string;
  /** 该岗位的候选池人数（已按职级规则筛选）。 */
  poolSize: number;
}
export interface SuccessionOverview {
  positions: SuccessionPositionView[];
  summary: {
    keyPositions: number;
    healthy: number;
    attention: number;
    risk: number;
    unrated: number;
    readyCount: number;
    developingCount: number;
    covered: number;
  };
  filters: {
    departments: string[];
    tracks: { slug: string; name: string }[];
    levels: string[];
  };
  updatedAt: string;
}

/* ========== 项目组队 ========== */
export interface TeamRoleSkill {
  /** 技能目录 slug */
  skillSlug: string;
  /** 需要的认证等级 L1~L5 */
  level: number;
  type: 'required' | 'bonus';
  /** 目录展示名（服务端解析） */
  name: string;
}

/** 服务端按真实认证技能计算出的角色候选推荐 */
export interface TeamCandidateOption {
  candidateSlug: string;
  name: string;
  avatar: string;
  avatarTone: string;
  org: string;
  roleTitle: string;
  requiredMet: number;
  requiredTotal: number;
  bonusMet: number;
  bonusTotal: number;
  score: number;
  tier: 'direct' | 'adjacent' | 'potential';
  /** 命中的认证技能（含等级），必需在前 */
  evidence: string[];
  availabilityText: string;
  availabilityPercent: number | null;
  assignedHere: boolean;
  /** 已被本方案其他角色占用时的角色名 */
  assignedElsewhere: string | null;
  /** 可投入比例低于角色要求 */
  insufficient: boolean;
  declinedPreviously: boolean;
  recentParticipations: TeamRecentParticipation[];
}

export interface TeamRecentParticipation {
  projectTitle: string;
  roleTitle: string;
  status: TeamStatus;
  response: TeamAssignmentResponseState;
  recordedAt: string;
}

export interface TeamHistoryRecord {
  id: string;
  event: string;
  actorName: string;
  description: string;
  createdAt: string;
  snapshot: {
    title: string;
    status: TeamStatus;
    roles: { title: string; headcount: number; allocation: string }[];
    members: { roleTitle: string; candidateSlug: string; name: string; response: TeamAssignmentResponseState; note: string | null; source: 'mock' | 'employee' | 'feishu' }[];
  };
}

export interface TeamCoordinationNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipientName: string;
  event: 'invite' | 'response';
  decision: 'accepted' | 'rejected' | null;
  state: 'retained' | 'withdrawn';
}

export interface TeamRole {
  id: string;
  title: string;
  headcount: number;
  allocation: string;
  skills: TeamRoleSkill[];
  /** 服务端计算的真实候选推荐，按匹配度排序 */
  recommendations: TeamCandidateOption[];
  members: TeamCandidateOption[];
}

/** 方案状态：draft 草稿 / confirming 协调确认中 / adjusting 有成员拒绝待调整 / confirmed 全员接受 */
export type TeamStatus = 'draft' | 'confirming' | 'adjusting' | 'confirmed';

/** 成员对组队邀请的响应状态 */
export type TeamAssignmentResponseState = 'pending' | 'accepted' | 'rejected';

export interface TeamConflictItem {
  kind: 'multi-role' | 'insufficient-availability';
  candidateSlug: string;
  name: string;
  detail: string;
}

export interface TeamResponseNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  action: 'accepted' | 'rejected';
  candidateSlug: string;
  source: 'mock' | 'employee' | 'feishu';
  channel: 'feishu-mock' | 'feishu' | 'in-app';
}

export interface TeamArchiveResponse {
  projects: TeamProjectSummary[];
  notifications: (TeamCoordinationNotification & { projectSlug: string; projectTitle: string })[];
}

export interface TeamCandidateSearchResponse {
  candidates: TeamCandidateOption[];
  total: number;
}

export interface MockTeamResponseInput {
  project: string;
  roleSlug: string;
  candidateSlug: string;
  action: 'accept' | 'reject';
  note?: string;
}

export interface TeamProjectView {
  id: string;
  title: string;
  period: string;
  note: string;
  status: TeamStatus;
  updatedAt: string | null;
  /** 方案归属部门（创建时手选，跨部门不可见） */
  department: string;
  creatorSlug: string;
  creatorName: string;
  roles: TeamRole[];
  assignments: { [roleSlug: string]: string[] };
  /** 各角色中每位成员对邀请的响应状态，以员工 slug 索引 */
  responses: { [roleSlug: string]: { [candidateSlug: string]: { state: TeamAssignmentResponseState; respondedAt: string | null; note: string | null; source: 'mock' | 'employee' | 'feishu' } } };
  /** 按需求人数计算必需技能覆盖（未配置名额按 0 计） */
  skillCoverage: number;
  conflicts: TeamConflictItem[];
  /** 已配置成员中投入比例未登记的人数 */
  pendingAvailabilityCount: number;
  mockResponsesEnabled: boolean;
  responseNotifications: TeamResponseNotification[];
  history: TeamHistoryRecord[];
  coordinationNotifications: TeamCoordinationNotification[];
}

/** 方案列表摘要（可见范围：本部门方案 + 本人创建的方案；HR 可见全部） */
export interface TeamProjectSummary {
  slug: string;
  title: string;
  status: TeamStatus;
  department: string;
  creatorName: string;
  roleCount: number;
  updatedAt: string | null;
}

export interface TeamResponse {
  project: TeamProjectView;
  projects: TeamProjectSummary[];
}

/** 员工组队邀请及已响应结果（首页横幅用） */
export interface TeamInviteItem {
  id: string;
  projectSlug: string;
  projectTitle: string;
  roleSlug: string;
  roleTitle: string;
  creatorName: string;
  createdAt: string;
  state: TeamAssignmentResponseState;
  note: string | null;
  source: 'mock' | 'employee' | 'feishu';
}

export interface CreateTeamProjectInput {
  title: string;
  department: string;
  note?: string;
}

export interface TeamRoleSkillInput {
  skillSlug: string;
  level: number;
  type: 'required' | 'bonus';
}

export interface CreateTeamRoleInput {
  title: string;
  allocation: string;
  headcount: number;
  skills: TeamRoleSkillInput[];
}

export interface UpdateTeamRoleInput extends CreateTeamRoleInput {}

export interface TeamStatusInput {
  action: 'confirm' | 'reopen';
  /** 目标方案 slug；缺省时取最近更新的可见方案 */
  project?: string;
}

/** 员工对组队邀请的响应输入 */
export interface TeamRespondInput {
  roleSlug: string;
  project?: string;
  action: 'accept' | 'reject';
  note?: string;
}

/* ========== 判断层（M2）：资格 / 进度 / Gap ========== */

/** 单个职称层的判定状态。certified 已持有或被更高职称覆盖；ready 已达标可提交；preparing 仍在补；blocked 被规则挡住。 */
export type ReadinessState = 'certified' | 'ready' | 'preparing' | 'blocked';

export interface JudgingBlocker {
  code: 'already-certified' | 'higher-title-held' | 'same-target-applying' | 'rejected-cooldown' | 'appeal-open';
  message: string;
  /** 冷却类阻断的解除时间 */
  until?: string;
}

export interface JudgingRequirement {
  isRequired?: boolean;
  skillSlug: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number;
  /** requiredLevel - currentLevel，最小 0 */
  gapLevels: number;
  met: boolean;
  competencySlugs: string[];
  /** 当前等级来自职称覆盖（持有层及以下要求视为已满足） */
  fromTitle?: boolean;
  /** 当前等级来自职称基线（下一层新出现技能按入门理解 L1 计） */
  fromBaseline?: boolean;
}

export interface JudgingLevelView {
  trackSlug: string;
  trackName: string;
  levelOrder: number;
  levelCode: string;
  levelName: string;
  state: ReadinessState;
  met: number;
  total: number;
  /** 目标层比已持有职称高出不止一级，提交时需追加独立专家复核 */
  isCrossLevel: boolean;
  blockers: JudgingBlocker[];
  requirements: JudgingRequirement[];
}

/** 发展管道：职称序列的上层分组，选择目标时的第一级 */
export type TitlePipeline = 'tech' | 'management';

/** 管道顺序与展示名，服务端分组与前端选择器共用同一口径 */
export const TITLE_PIPELINES: { slug: TitlePipeline; name: string }[] = [
  { slug: 'tech', name: '技术管道' },
  { slug: 'management', name: '管理管道' },
];

export interface JudgingTrackView {
  slug: string;
  name: string;
  /** 所属发展管道；老数据缺省时前端按 TECH_TRACKS 兜底归入技术管道 */
  pipeline: TitlePipeline;
  levels: JudgingLevelView[];
}

export interface JudgingOverview {
  employeeSlug: string;
  /** 当前持有的最高职称；无职称为 null */
  currentTitle: { trackSlug: string; levelOrder: number; levelCode: string; levelName: string } | null;
  /** 按部门与岗位推断的所属序列，用于默认选中与候选去重；无法判断时为 null */
  preferredTrack: string | null;
  tracks: JudgingTrackView[];
}

export interface JudgingResource {
  slug: string;
  kind: string;
  title: string;
  url: string | null;
  estimatedEffort: string | null;
  evidenceTemplate: string | null;
}

/** 单层 Gap 详情：在层级视图上补子能力名与可提交材料方向 */
export interface JudgingGapDetail extends JudgingLevelView {
  gapItems: (JudgingRequirement & { competencyNames: string[]; resources: JudgingResource[] })[];
}

export interface JudgingCandidate {
  /** 稳定标识，用于忽略与冷却，形如 title:software:T2 */
  key: string;
  kind: 'candidate-application' | 'candidate-evidence';
  title: string;
  description: string;
  trackSlug: string;
  levelCode: string;
  met: number;
  total: number;
  dismissed: boolean;
}

export interface JudgingCandidatesResponse {
  items: JudgingCandidate[];
}


export type IdpActionStatus = 'todo' | 'in-progress' | 'done';
export interface IdpPlanMeta {
  revision: number;
  draftId?: string;
  track: string;
  level: string;
  startMonth: string;
  months: number;
  generatedAt: string;
  updatedAt: string;
  sourceFingerprint: string;
  generator: 'gap-rules';
}
export interface IdpAlignment { id: string; date: string; participant: string; note: string; createdAt: string; }
export interface IdpOptions {
  overview: JudgingOverview;
  defaultTarget: { track: string; level: string } | null;
  evidence: { slug: string; title: string }[];
}
export interface IdpGenerateRequest { track: string; level: string; startMonth: string; months: number; }
export interface IdpSaveRequest { draftId: string; }
export interface IdpActionUpdate {
  revision: number;
  status: IdpActionStatus;
  resultNote: string;
  evidenceSlugs: string[];
  evidenceLink?: string;
  title?: string;
  window?: string;
}
export interface IdpAlignmentRequest { revision: number; date: string; participant: string; note: string; }
export interface IdpRevision { revision: number; reason: string; createdAt: string; }
export interface IdpLiveReview { readiness: number; met: number; total: number; gaps: string[]; changed: boolean; }

// 岗位管理复用职称标准：序列 → 方向 → T1–T4 → L1–L5 技能要求。
export type JobFamily = 'T' | 'P' | 'F' | 'M';
export interface PositionSkillRequirement { skillName: string; requiredLevel: number; isRequired?: boolean; standard?: PositionSkillStandard }
export interface PositionGrade { code: string; name: string; requirements: PositionSkillRequirement[] }
export interface PositionDirection {
  slug: string; family: JobFamily; name: string; revision: string; grades: PositionGrade[];
}
export interface PositionCatalog {
  skillStandards: Record<string, PositionSkillStandard>;
  directions: PositionDirection[]; skills: string[]; standardVersion: string; revision: string; canEdit: boolean;
}
export interface PositionInput { family: JobFamily; name: string; revision?: string; grades: PositionGrade[] }
export interface PositionImportRow {
  family: JobFamily; direction: string; grade: string; skillName: string; requiredLevel: number;
  skillDescription?: string; levelDescription?: string; evidenceRequirements?: string;
  isRequired?: boolean;
  standard?: PositionSkillStandard;
}
export interface PositionImportPreview { rows: PositionImportRow[]; errors: string[] }

export interface SkillLevelStandard { level: number; anchor: string; evidence: string }
export interface PositionSkillStandard {
  description: string; levels: SkillLevelStandard[]; revision: string;
}

export interface FeishuIntegrationStatus {
  enabled: boolean;
  linked: boolean;
  deliveries: { id: string; title: string; state: string; error: string | null; sent: boolean; result: string | null; decision: string | null; updatedAt: string }[];
}
