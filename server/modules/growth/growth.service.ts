import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
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

const GAPS_EMPLOYEE_SLUG = 'zhang-san';
const EVENTS_EMPLOYEE_SLUG = 'zhang-san';
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

    const skillNameBySlug = new Map<string, string>(
      skills.map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );

    const skillsByNode = new Map<string, CareerNodeSkill[]>();
    for (const nodeSkill of nodeSkills) {
      const name: string = skillNameBySlug.get(nodeSkill.skillSlug) ?? nodeSkill.skillSlug;
      const item: CareerNodeSkill = {
        name,
        current: nodeSkill.currentLevel ?? 0,
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
        meta: node.meta ?? '',
        state: node.state ?? '',
        coverage: node.coverage ?? 0,
        description: node.description ?? '',
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
      .where(eq(skillEvent.employeeSlug, EVENTS_EMPLOYEE_SLUG))
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
          eq(skillGap.employeeSlug, GAPS_EMPLOYEE_SLUG),
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
