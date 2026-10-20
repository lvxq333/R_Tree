import { currentEmployee } from '../auth/employee-context';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { employee, employeeSkill, skillEvent } from '@server/database/schema';
import type { EmployeeWorkspaceResponse } from '@shared/api.interface';
import { FactsService } from '../facts/facts.service';

type SkillRow = Pick<typeof employeeSkill.$inferSelect,
  'id' | 'skillSlug' | 'currentLevel' | 'status' | 'approvedAt' | 'updatedAt'>;
type EventRow = Pick<typeof skillEvent.$inferSelect, 'dateLabel' | 'level'>;

function shanghaiMonth(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  return year * 12 + month - 1;
}

function recordedMonth(value: string | null): number | null {
  const match = value?.match(/^(\d{4})[.-](\d{2})(?:-\d{2})?$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function tenureInMonths(hireDate: string | null, now = new Date()): number | null {
  const start = recordedMonth(hireDate);
  const months = start === null ? null : shanghaiMonth(now) - start;
  return months !== null && months >= 0 ? months : null;
}

/** 只统计有效的当前等级，不把候选目标等级或拟降级等级计入。 */
export function summarizeWorkspace(
  skills: SkillRow[], events: EventRow[], now = new Date(),
): EmployeeWorkspaceResponse['metrics'] {
  const certified = new Map<string, { level: number; at: number; id: string }>();
  for (const row of skills) {
    const validStatus = ['approved', 'review', 'review_submitted'].includes(row.status ?? '');
    const hasPriorCertification = Boolean(row.approvedAt?.match(/^\d{4}-\d{2}-\d{2}$/));
    const level = row.currentLevel;
    if ((!validStatus && !hasPriorCertification) || level === null || !Number.isInteger(level) || level < 1 || level > 5) continue;
    // 无技能标识的旧记录不按名称猜测合并。
    const key = row.skillSlug ? `skill:${row.skillSlug}` : `record:${row.id}`;
    const approved = row.approvedAt ? Date.parse(`${row.approvedAt}T00:00:00+08:00`) : NaN;
    const at = Number.isFinite(approved) ? approved : row.updatedAt.getTime();
    const previous = certified.get(key);
    // 旧表可能有同技能的多次认证。取最新有效结论，不能用历史最高等级覆盖降级。
    if (!previous || at > previous.at || (at === previous.at && row.id > previous.id)) {
      certified.set(key, { level, at, id: row.id });
    }
  }
  const levels = [...certified.values()].map(item => item.level);
  const month = shanghaiMonth(now);
  const recentUpgradeCount = events.filter(event => {
    const at = recordedMonth(event.dateLabel);
    const change = event.level?.match(/^L([1-5])\s*(?:→|->)\s*L([1-5])$/);
    return at !== null && at >= month - 2 && at <= month
      && change !== null && change !== undefined && Number(change[2]) > Number(change[1]);
  }).length;
  return {
    certifiedSkillCount: levels.length,
    averageSkillLevel: levels.length ? Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length * 10) / 10 : null,
    superEmployeeLevel: null, // 原数据库没有此指标，保留展示位置，不推算或伪造。
    recentUpgradeCount,
    candidateCount: skills.filter(row => row.status === 'ready').length,
    maturity: {
      expert: levels.filter(level => level >= 4).length,
      core: levels.filter(level => level === 3).length,
      growth: levels.filter(level => level <= 2).length,
    },
  };
}

@Injectable()
export class EmployeeWorkspaceService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase, private readonly facts: FactsService) {}

  async getCurrent(): Promise<EmployeeWorkspaceResponse> {
    const current = await this.db.select().from(employee).where(eq(employee.id, currentEmployee().employeeId)).limit(1);
    if (!current.length) throw new NotFoundException('当前员工不存在');
    const row = current[0];
    const [skills, events] = await Promise.all([
      this.db.select().from(employeeSkill).where(eq(employeeSkill.employeeSlug, row.slug)),
      this.db.select().from(skillEvent).where(eq(skillEvent.employeeSlug, row.slug)),
    ]);
    const facts = await this.facts.status();
    const now = new Date();
    const timestamps = [row, ...skills, ...events].map(item => item.updatedAt.getTime()).filter(Number.isFinite);
    return {
      workFactCount: facts.activeCount,
      employee: {
        id: row.id, slug: row.slug, name: row.name,
        avatar: row.avatarText || row.name.slice(0, 1),
        role: row.role ?? '', org: row.org ?? '', summary: row.summary ?? '',
        hireDate: row.hireDate,
        tenureMonths: tenureInMonths(row.hireDate, now),
        company: null,
        jobGrade: row.role?.match(/\bT\d+(?:-\d+)?\b/)?.[0] ?? null,
        workLocation: null,
      },
      metrics: summarizeWorkspace(skills, events, now),
      databaseUpdatedAt: new Date(timestamps.length ? Math.max(...timestamps) : now.getTime()).toISOString(),
      loadedAt: now.toISOString(),
      // 当前仅本地数据库适配器；外部事实中心仍未接入。
      factsSync: {
        status: facts.healthy ? 'idle' : 'error',
        pollIntervalSeconds: facts.pollIntervalSeconds,
        lastCheckedAt: facts.lastCheckedAt,
        lastChangedAt: facts.lastChangedAt,
      },
      source: 'local-demo',
    };
  }
}
