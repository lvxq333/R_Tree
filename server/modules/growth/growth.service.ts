import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  careerNode,
  careerNodeSkill,
  careerSequence,
  skill,
  skillGap,
} from '@server/database/schema';
import { mvpEmployeeSkill } from '@server/database/mvp-schema';
import { JudgingService } from '../judging/judging.service';
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
    private readonly judging: JudgingService,
  ) {}

  /** 新表认证：每技能取 active 最高等级（与判断层口径一致）。 */
  private async activeSkillLevels(employeeSlug: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select()
      .from(mvpEmployeeSkill)
      .where(and(eq(mvpEmployeeSkill.employeeSlug, employeeSlug), eq(mvpEmployeeSkill.status, 'active')));
    const levels = new Map<string, number>();
    for (const row of rows) {
      const current = levels.get(row.skillSlug) ?? 0;
      if (row.level > current) levels.set(row.skillSlug, row.level);
    }
    return levels;
  }

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
    const levels = await this.activeSkillLevels(currentEmployee().employeeSlug);

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
    // 轨迹以新表认证为准（skill_event 旧表已停写）；每技能取最高 active 等级，
    // 按认证时间升序生成点亮事件，total 为截至该事件的累计技能数。
    const skillNameBySlug = new Map<string, string>(
      (await this.db.select().from(skill)).map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );
    const certs = await this.db
      .select()
      .from(mvpEmployeeSkill)
      .where(and(eq(mvpEmployeeSkill.employeeSlug, currentEmployee().employeeSlug), eq(mvpEmployeeSkill.status, 'active')))
      .orderBy(asc(mvpEmployeeSkill.certifiedAt));

    const best = new Map<string, { at: number; level: number }>();
    const pending: { at: number; date: string; title: string; level: number }[] = [];
    for (const row of certs) {
      const at = row.certifiedAt instanceof Date ? row.certifiedAt.getTime() : Date.parse(String(row.certifiedAt));
      if (!Number.isFinite(at)) continue;
      const previous = best.get(row.skillSlug);
      if (previous && previous.level >= row.level) continue;
      best.set(row.skillSlug, { at, level: row.level });
      pending.push({
        at,
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date(at)).replace('-', '.'),
        title: skillNameBySlug.get(row.skillSlug) ?? row.skillSlug,
        level: row.level,
      });
    }
    pending.sort((a, b) => a.at - b.at);
    const seen = new Set<string>();
    const events: SkillGrowthEvent[] = pending.map(item => {
      seen.add(item.title);
      return {
        date: item.date,
        total: seen.size,
        title: item.title,
        category: '技能认证',
        level: `L${item.level}`,
        evidence: '',
        approver: '',
        note: `技能认证生效，当前等级 L${item.level}`,
      };
    });

    const limited =
      range === '6m'
        ? events.slice(-6)
        : range === '12m'
          ? events.slice(-9)
          : events;

    return { events: limited };
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

    // 职业下一节点改由判断层推导：取偏好序列中达标进度最高的 preparing 层（离申请最近）。
    try {
      const overview = await this.judging.getOverview();
      const preferred = overview.tracks.find(track => track.slug === overview.preferredTrack) ?? overview.tracks[0];
      const next = preferred?.levels
        .filter(level => level.state === 'preparing')
        .sort((a, b) => (b.met / Math.max(1, b.total)) - (a.met / Math.max(1, a.total)))[0];
      if (next) {
        items.unshift({
          source: 'career',
          sourceLabel: '职业下一节点',
          title: `${next.levelName}（${next.levelCode}）`,
          description: `还差 ${next.total - next.met} 项能力要求达标，可在「资格自查」页查看明细与补齐方向。`,
          filled: next.met,
          target: next.total,
          levelRange: next.levelCode,
          priority: 'p1',
        });
      }
    } catch {
      // 判定层不可用时仅返回旧 Gap 数据，不阻塞页面。
    }

    return { items };
  }
}
