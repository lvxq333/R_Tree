import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { asc, eq } from 'drizzle-orm';
import {
  employee,
  employeeExperience,
  employeeProject,
  employeeSkill,
  employeeTrait,
  performanceRecord,
  talentCandidate,
} from '@server/database/schema';
import type {
  EmployeeProfile,
  ManagementProfile,
  ProfileDemographics,
  ProfileProject,
  ProfileSkillMeta,
  ProfileSkillRecord,
} from '@shared/api.interface';

type EvidenceItem = { type: string; title: string; detail: string };
type DimensionItem = { label: string; value: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is string => typeof item === 'string');
}

function parseEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    .map((item: Record<string, unknown>) => ({
      type: str(item.type),
      title: str(item.title),
      detail: str(item.detail),
    }));
}

function parseDimensions(value: unknown): DimensionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    .map((item: Record<string, unknown>) => ({
      label: str(item.label),
      value: typeof item.value === 'number' ? item.value : 0,
    }));
}

function parseResponsibilities(value: unknown): [string, string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    .map((item: Record<string, unknown>): [string, string, string] => [
      str(item.label),
      str(item.text),
      str(item.meta),
    ]);
}

function parseCollaboration(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    .map((item: Record<string, unknown>): [string, string] => [str(item.label), str(item.text)]);
}

function parseManagement(value: unknown): ManagementProfile | null {
  if (!isRecord(value)) return null;
  return {
    hasTeam: value.hasTeam === true,
    scope: str(value.scope),
    years: str(value.years),
    style: str(value.style),
    styleDetail: str(value.styleDetail),
    collaborationFit: str(value.collaborationFit),
  };
}

function buildTenure(hireDate: string): string {
  const matched = hireDate.match(/^(\d{4})\.(\d{2})$/);
  if (!matched) return '';
  const hireYear = Number(matched[1]);
  const hireMonth = Number(matched[2]);
  const now = new Date();
  const totalMonths = (now.getFullYear() - hireYear) * 12 + (now.getMonth() + 1 - hireMonth);
  if (totalMonths < 0) return '';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} 年`);
  if (months > 0) parts.push(`${months} 个月`);
  return parts.length > 0 ? `${parts.join(' ')}（${hireDate} 入职）` : '本月入职';
}

function buildDemographics(
  birthYear: number | null,
  gender: string,
  education: string,
  hireDate: string,
): ProfileDemographics | null {
  if (!birthYear && !gender && !education && !hireDate) return null;
  const age = birthYear ? `${new Date().getFullYear() - birthYear} 岁` : '';
  return {
    age,
    gender,
    education,
    tenure: buildTenure(hireDate),
  };
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getProfile(slug: string): Promise<EmployeeProfile> {
    const employeeRows: (typeof employee.$inferSelect)[] = await this.db
      .select()
      .from(employee)
      .where(eq(employee.slug, slug))
      .limit(1);
    if (employeeRows.length > 0) {
      return this.buildEmployeeProfile(employeeRows[0]);
    }

    const candidateRows: (typeof talentCandidate.$inferSelect)[] = await this.db
      .select()
      .from(talentCandidate)
      .where(eq(talentCandidate.slug, slug))
      .limit(1);
    if (candidateRows.length > 0) {
      this.logger.log(`employee 表无 ${slug}，返回人才候选降级画像`);
      return this.buildTalentProfile(candidateRows[0]);
    }

    throw new NotFoundException(`未找到员工画像: ${slug}`);
  }

  private async buildEmployeeProfile(
    row: typeof employee.$inferSelect,
  ): Promise<EmployeeProfile> {
    const [experiences, traits, projects, skillRows, performanceRows] = await Promise.all([
      this.db
        .select()
        .from(employeeExperience)
        .where(eq(employeeExperience.employeeSlug, row.slug))
        .orderBy(asc(employeeExperience.sort)),
      this.db
        .select()
        .from(employeeTrait)
        .where(eq(employeeTrait.employeeSlug, row.slug))
        .orderBy(asc(employeeTrait.sort)),
      this.db
        .select()
        .from(employeeProject)
        .where(eq(employeeProject.employeeSlug, row.slug))
        .orderBy(asc(employeeProject.sort)),
      this.db
        .select()
        .from(employeeSkill)
        .where(eq(employeeSkill.employeeSlug, row.slug))
        .orderBy(asc(employeeSkill.sort)),
      this.db
        .select()
        .from(performanceRecord)
        .where(eq(performanceRecord.employeeSlug, row.slug))
        .orderBy(asc(performanceRecord.sort)),
    ]);

    const skills: ProfileSkillRecord[] = skillRows.map(
      (skillRow: typeof employeeSkill.$inferSelect): ProfileSkillRecord => {
        const evidenceList: EvidenceItem[] = parseEvidence(skillRow.evidence);
        const evidenceText: string =
          evidenceList.length > 0 ? evidenceList[0].title : '';
        const meta: ProfileSkillMeta | undefined =
          skillRow.lastUsed || skillRow.status
            ? {
                lastUsed: skillRow.lastUsed ?? undefined,
                status: skillRow.status ?? undefined,
              }
            : undefined;
        return {
          name: skillRow.title,
          category: skillRow.category ?? '',
          level: `L${skillRow.currentLevel ?? 0}`,
          evidence: evidenceText,
          expiry: skillRow.expiry ?? '',
          ...(meta ? { meta } : {}),
        };
      },
    );

    const projectViews: ProfileProject[] = projects.map(
      (project: typeof employeeProject.$inferSelect): ProfileProject => ({
        time: project.timeRange ?? '',
        title: project.title ?? '',
        responsibility: project.responsibility ?? '',
        actions: project.actions ?? '',
        outcome: project.outcome ?? '',
        impact: project.impact ?? '',
        contribution: project.contribution ?? '',
        skills: parseStringList(project.skills),
        verification: project.verification ?? '',
      }),
    );

    return {
      id: row.slug,
      name: row.name,
      avatar: row.avatarText ?? '',
      tone: row.avatarTone ?? '',
      role: row.role ?? '',
      org: row.org ?? '',
      status: row.status ?? '',
      updated: row.updatedLabel ?? '',
      summary: row.summary ?? '',
      summaryDescription: row.summaryDescription ?? '',
      availability: row.availability ?? '',
      tenureSummary: row.tenureSummary ?? '',
      experience: experiences.map(
        (item: typeof employeeExperience.$inferSelect): [string, string, string] => [
          item.period ?? '',
          item.role ?? '',
          item.org ?? '',
        ],
      ),
      responsibilities: parseResponsibilities(row.responsibilities),
      traits: traits.map(
        (item: typeof employeeTrait.$inferSelect): [string, string, string, string] => [
          item.badge ?? '',
          item.title ?? '',
          item.detail ?? '',
          item.source ?? '',
        ],
      ),
      skills,
      projects: projectViews,
      performance: performanceRows.map(
        (item: typeof performanceRecord.$inferSelect): [string, string, string] => [
          item.period,
          item.rating,
          item.summary ?? '',
        ],
      ),
      demographics: buildDemographics(
        row.birthYear ?? null,
        row.gender ?? '',
        row.education ?? '',
        row.hireDate ?? '',
      ),
      management: parseManagement(row.managementProfile),
      collaboration: parseCollaboration(row.collaboration),
    };
  }

  private buildTalentProfile(
    candidate: typeof talentCandidate.$inferSelect,
  ): EmployeeProfile {
    const evidenceList: string[] = parseStringList(candidate.evidence);
    const dimensions: DimensionItem[] = parseDimensions(candidate.dimensions);

    const levelSkills: ProfileSkillRecord[] = evidenceList
      .slice(0, 3)
      .map((text: string, index: number): ProfileSkillRecord => {
        const matched = text.match(/L\d/);
        const level = matched ? matched[0] : index ? 'L3' : 'L4';
        return {
          name: text.replace(/\sL\d/, ''),
          category: '专业技能 / 已授权摘要',
          level,
          evidence: index === 0 ? '项目成果 + 专家确认' : '技能认证与项目记录',
          expiry: '2027-02',
        };
      });

    const credible: DimensionItem | undefined = dimensions.find(
      (item: DimensionItem) => item.label === '证据可信',
    );

    const fallbackSummaryProject: ProfileProject = {
      time: '近 12 个月',
      title: '相关项目经历',
      responsibility: '承担与本次需求相关的项目职责，完整范围需授权后查看。',
      actions: '已授权摘要仅确认存在相关实践。',
      outcome: '项目成果已被记录并纳入技能证据。',
      impact: '量化影响需发起协作授权后查看。',
      contribution: '授权摘要',
      skills: evidenceList.slice(0, 2),
      verification: '已记录',
    };

    const org: string = candidate.org ?? '';
    const role: string = candidate.role ?? '';
    const reason: string = candidate.reason ?? '';
    const note: string = candidate.note ?? '';
    const gap: string = candidate.gap ?? '';
    const availability: string = candidate.availability ?? '';
    const freshness: string = candidate.freshness ?? '';

    return {
      id: candidate.slug,
      name: candidate.name,
      avatar: candidate.avatarText ?? '',
      tone: candidate.avatarTone ?? '',
      role,
      org: `${org} · 授权摘要`,
      status: '在职',
      updated: `更新于 ${freshness}`,
      summary: reason,
      summaryDescription: `${note} 当前页面仅展示搜索授权范围内的摘要，进一步查看项目原文需发起协作授权。`,
      availability,
      tenureSummary: '跨组织授权摘要，完整任职经历需授权后查看。',
      experience: [['当前', '当前岗位', org]],
      responsibilities: [
        ['当前岗位', role, '来源：HR 基础信息'],
        ['本次匹配', reason, '来源：人才需求匹配'],
      ],
      traits: [
        ['能', '核心能力', reason, '来源：正式技能等级'],
        ['验', '相关经历', note, '来源：项目履历摘要'],
        [
          '证',
          '证据可靠',
          `当前证据可信度 ${credible ? credible.value : 82}%，详情需按权限查看。`,
          '来源：认证与评审记录',
        ],
        ['用', '可用情况', availability, '来源：项目排期'],
        ['缺', '当前缺口', gap, '来源：本次人才需求匹配'],
      ],
      skills: levelSkills,
      projects: [fallbackSummaryProject],
      performance: [],
      demographics: null,
      management: null,
      collaboration: [
        ['擅长合作场景', reason],
        ['沟通偏好', '发起协作后由本人确认'],
        ['权限说明', '当前为跨组织候选摘要'],
      ],
    };
  }
}
