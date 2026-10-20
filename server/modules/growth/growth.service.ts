import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  employeeSkill,
  careerNode,
  careerNodeSkill,
  careerSequence,
  skill,
  skillEvent,
  skillGap,
} from '@server/database/schema';
import type {
  CareerNode,
  CareerNodeSkill,
  CareerResponse,
  CareerSequenceView,
  GapListResponse,
  GapPoolItem,
  GapSource,
  GrowthEventsResponse,
  GrowthRange,
  SkillGrowthEvent,
} from '@shared/api.interface';

const GAP_SOURCES: string[] = ['career', 'okr', 'current'];

function toGapSource(value: string | null): GapSource {
  if (value === 'career' || value === 'okr' || value === 'current' || value === 'profile') {
    return value;
  }
  return 'career';
}

function toGapPriority(value: string | null): 'p0' | 'p1' | 'p2' {
  if (value === 'p0' || value === 'p1' || value === 'p2') return value;
  return 'p2';
}

@Injectable()
export class GrowthService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getCareer(): Promise<CareerResponse> {
    const sequences = await this.db.select().from(careerSequence);
    const nodes = await this.db
      .select()
      .from(careerNode)
      .orderBy(asc(careerNode.sort));
    const nodeSkills = await this.db
      .select()
      .from(careerNodeSkill)
      .orderBy(asc(careerNodeSkill.sort));
    const skills = await this.db.select().from(skill);
    const personalSkills = await this.db.select().from(employeeSkill).where(eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug));
    const levels = new Map<string, number>();
    for (const item of personalSkills) {
      if (!['approved','review','review_submitted'].includes(item.status ?? '')) continue;
      if (item.skillSlug) levels.set(item.skillSlug, item.currentLevel ?? 0);
    }

    const skillNameBySlug = new Map<string, string>(
      skills.map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );

    const skillsByNode = new Map<string, CareerNodeSkill[]>();
    for (const nodeSkill of nodeSkills) {
      const name: string = skillNameBySlug.get(nodeSkill.skillSlug) ?? nodeSkill.skillSlug;
      const item: CareerNodeSkill = {
        name,
        current: levels.get(nodeSkill.skillSlug) ?? 0,
        target: nodeSkill.requiredLevel,
      };
      const list: CareerNodeSkill[] = skillsByNode.get(nodeSkill.nodeSlug) ?? [];
      list.push(item);
      skillsByNode.set(nodeSkill.nodeSlug, list);
    }

    const nodesBySequence = new Map<string, CareerNode[]>();
    for (const node of nodes) {
      const view: CareerNode = {
        id: node.slug,
        code: node.code ?? '',
        title: node.title ?? '',
        meta: '岗位能力要求',
        state: '岗位能力参考',
        coverage: Math.round((skillsByNode.get(node.slug) ?? []).filter(item => item.current >= item.target).length / Math.max(1, (skillsByNode.get(node.slug) ?? []).length) * 100),
        description: '根据当前员工的有效认证技能对照岗位要求。',
        skills: skillsByNode.get(node.slug) ?? [],
      };
      const list: CareerNode[] = nodesBySequence.get(node.sequenceSlug) ?? [];
      list.push(view);
      nodesBySequence.set(node.sequenceSlug, list);
    }

    const sequenceViews: CareerSequenceView[] = sequences.map(
      (sequence: typeof careerSequence.$inferSelect): CareerSequenceView => ({
        key: sequence.slug,
        label: sequence.label,
        description: sequence.description ?? '',
        nodes: nodesBySequence.get(sequence.slug) ?? [],
      }),
    );

    return { sequences: sequenceViews };
  }

  async getEvents(range: GrowthRange): Promise<GrowthEventsResponse> {
    const rows = await this.db
      .select()
      .from(skillEvent)
      .where(eq(skillEvent.employeeSlug, currentEmployee().employeeSlug))
      .orderBy(asc(skillEvent.sort));

    const limited =
      range === '6m'
        ? rows.slice(-6)
        : range === '12m'
          ? rows.slice(-9)
          : rows;

    const events: SkillGrowthEvent[] = limited.map(
      (row: typeof skillEvent.$inferSelect): SkillGrowthEvent => ({
        date: row.dateLabel ?? '',
        total: row.total ?? 0,
        title: row.title ?? '',
        category: row.category ?? '',
        level: row.level ?? '',
        evidence: row.evidence ?? '',
        approver: row.approver ?? '',
        note: row.note ?? '',
      }),
    );

    return { events };
  }

  async getGaps(): Promise<GapListResponse> {
    const rows = await this.db
      .select()
      .from(skillGap)
      .where(
        and(
          eq(skillGap.employeeSlug, currentEmployee().employeeSlug),
          inArray(skillGap.source, GAP_SOURCES),
        ),
      )
      .orderBy(asc(skillGap.sort));

    const items: GapPoolItem[] = rows.map(
      (row: typeof skillGap.$inferSelect): GapPoolItem => ({
        source: toGapSource(row.source),
        sourceLabel: row.sourceLabel ?? '',
        title: row.title,
        description: row.description ?? '',
        filled: row.filled ?? 0,
        target: row.target ?? 0,
        levelRange: row.levelRange ?? '',
        priority: toGapPriority(row.priority),
      }),
    );

    return { items };
  }
}
