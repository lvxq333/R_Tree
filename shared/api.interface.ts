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
  provenance: 'local_legacy_import' | 'simulated' | 'validation_fixture';
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
export type GapSource = 'career' | 'okr' | 'current' | 'profile';

export interface AbilityStandard {
  id: string;
  name: string;
  anchors: string[]; // L1~L5，按数组顺序
}
export interface SkillAssessmentStandard {
  skillSlug: string;
  name: string;
  version: string;
  hash: string;
  abilities: AbilityStandard[];
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

/* ========== 认证（技能点亮记录） ========== */
export interface CertificationEvidence {
  type: string;
  title: string;
  detail: string;
}

export interface CertificationItem {
  id: string;
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
}

export interface SelfApplicationInput {
  skill: string;
  level: number;
  evidenceType: string;
  evidenceTitle: string;
  evidenceLink: string;
  note: string;
}

/* ========== 审批 ========== */
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
  status: ApprovalStatus;
  detail: string | null;
  employeeResponse: string | null;
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
}

/** Gap 条目下的一条子能力要求（技能在该等级下的可评估子能力） */
export interface GapCompetency {
  name: string;
  level: number;
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
  /** 该技能在目标等级下的子能力要求明细 */
  competencies: GapCompetency[];
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
  kind: IdpActionKind;
  kindLabel: string;
  title: string;
  gap: string;
  window: string;
  proof: string;
}

export interface IdpPhase {
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
  title: string;
  priority: string;
  note: string;
}

export interface IdpResponse {
  positioning: IdpPositioning;
  gaps: IdpGap[];
  phases: IdpPhase[];
  milestones: IdpMilestone[];
  adjustRules: { trigger: string; action: string }[];
  reviewCadence: string;
}

/* ========== 人才候选与清单 ========== */
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
export interface SuccessorPerson {
  name: string;
  avatar: string;
  tone: string;
  role: string;
  gap: string;
  state: string;
  stateClass: string;
  employeeId: string | null;
}

export interface SuccessionRole {
  id: string;
  title: string;
  family: string;
  incumbent: string;
  incumbentMeta: string;
  immediate: number;
  developing: number;
  health: string;
  healthText: string;
  summary: string;
  risk: string;
  ready: SuccessorPerson[];
  pipeline: SuccessorPerson[];
}

export interface SuccessionResponse {
  roles: SuccessionRole[];
}

/* ========== 项目组队 ========== */
export interface TeamRoleSkill {
  name: string;
  type: 'required' | 'bonus';
}

export interface TeamRole {
  id: string;
  title: string;
  headcount: number;
  allocation: string;
  skills: TeamRoleSkill[];
  candidates: string[];
}

export interface TeamProjectView {
  id: string;
  title: string;
  period: string;
  note: string;
  roles: TeamRole[];
  assignments: { [roleSlug: string]: string };
}

export interface TeamResponse {
  project: TeamProjectView;
}

export interface CreateTeamRoleInput {
  title: string;
  allocation: string;
  skills: TeamRoleSkill[];
  candidates: string[];
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

export interface JudgingOverview {
  employeeSlug: string;
  /** 当前持有的最高职称；无职称为 null */
  currentTitle: { trackSlug: string; levelOrder: number; levelCode: string; levelName: string } | null;
  /** 按部门与岗位推断的所属序列，用于默认选中与候选去重；无法判断时为 null */
  preferredTrack: string | null;
  tracks: { slug: string; name: string; levels: JudgingLevelView[] }[];
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
