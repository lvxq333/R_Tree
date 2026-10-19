/* 前后端共享的类型写在这里 —— 技能树·人才管理 契约 */

/* ========== 基础枚举 ========== */
export type Role = 'employee' | 'manager';
export type GapSource = 'career' | 'okr' | 'current' | 'profile';
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
}

export interface CareerSequenceView {
  key: string;
  label: string;
  description: string;
  nodes: CareerNode[];
}

export interface CareerResponse {
  sequences: CareerSequenceView[];
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

export interface GapPoolItem {
  source: GapSource;
  sourceLabel: string;
  title: string;
  description: string;
  filled: number;
  target: number;
  levelRange: string;
  priority: 'p0' | 'p1' | 'p2';
}

export interface GapListResponse {
  items: GapPoolItem[];
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
