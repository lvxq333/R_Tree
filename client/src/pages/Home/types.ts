import type { ProfileProject } from '@shared/api.interface';

export type PageId =
  | 'overview'
  | 'evidence'
  | 'judging'
  | 'idp'
  | 'colleagues'
  | 'manager'
  | 'profile'
  | 'approval'
  | 'talent'
  | 'succession'
  | 'team'
  | 'factCenter';

/* 与 shared 契约完全一致的字段直接 re-export，避免双源漂移 */
export type { TalentCandidate, ProfileProject } from '@shared/api.interface';

export interface ProfileSkillMeta {
  lastUsed?: string;
  status?: string;
}

export type ProfileSkillRecord =
  | [string, string, string, string, string]
  | [string, string, string, string, string, ProfileSkillMeta];

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
  goal: string;
  nextCheckin: string;
  availability: string;
  readiness: string;
  readinessValue: number;
  readinessCopy: string;
  tenureSummary: string;
  experience: [string, string, string][];
  responsibilities: [string, string, string][];
  traits: [string, string, string, string][];
  skills: ProfileSkillRecord[];
  projects: ProfileProject[];
  gaps: [string, string][];
  developmentActions: [string, string, string][];
  collaboration: [string, string][];
}
