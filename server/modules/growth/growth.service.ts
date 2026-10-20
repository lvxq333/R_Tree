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
import { mvpEmployeeSkill, mvpEmployeeTitle, mvpTitleLevel } from '@server/database/mvp-schema';
import { JudgingService } from '../judging/judging.service';
import type {
  CareerNode,
  CareerNodeSkill,
  CareerResponse,
  CareerSequenceView,
  GapActionsResponse,
  GapAction,
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
    const employeeSlug = currentEmployee().employeeSlug;
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
    const levels = await this.activeSkillLevels(employeeSlug);

    // 已持有职称：序列 → 最高层级。持有层及以下视为达成（职称覆盖技能明细）。
    const titleRows = await this.db
      .select({ trackSlug: mvpTitleLevel.trackSlug, levelOrder: mvpTitleLevel.levelOrder })
      .from(mvpEmployeeTitle)
      .innerJoin(mvpTitleLevel, eq(mvpTitleLevel.id, mvpEmployeeTitle.titleLevelId))
      .where(and(eq(mvpEmployeeTitle.employeeSlug, employeeSlug), eq(mvpEmployeeTitle.status, 'active')));
    const heldLevelByTrack = new Map<string, number>();
    for (const row of titleRows) {
      const held = heldLevelByTrack.get(row.trackSlug) ?? 0;
      if (row.levelOrder > held) heldLevelByTrack.set(row.trackSlug, row.levelOrder);
    }

    const skillNameBySlug = new Map<string, string>(
      skills.map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );

    const skillsByNode = new Map<string, CareerNodeSkill[]>();
    const achievedByNode = new Map<string, boolean>();
    for (const node of nodes) {
      const nodeLevel = Number((node.code ?? '').replace(/^T/, ''));
      const heldLevel = heldLevelByTrack.get(node.sequenceSlug) ?? 0;
      const achieved = Number.isInteger(nodeLevel) && nodeLevel > 0 && nodeLevel <= heldLevel;
      achievedByNode.set(node.slug, achieved);
      const list = (skillsByNode.get(node.slug) ?? []).slice();
      for (const nodeSkill of nodeSkills.filter(row => row.nodeSlug === node.slug)) {
        const raw = levels.get(nodeSkill.skillSlug) ?? 0;
        // 职称已覆盖的层：技能明细按职称视为已满足，避免「高级工程师却显示 T1 全 Gap」。
        const current = achieved ? Math.max(raw, nodeSkill.requiredLevel) : raw;
        const name: string = skillNameBySlug.get(nodeSkill.skillSlug) ?? nodeSkill.skillSlug;
        list.push({ name, current, target: nodeSkill.requiredLevel });
      }
      skillsByNode.set(node.slug, list);
    }

    const nodesBySequence = new Map<string, CareerNode[]>();
    for (const node of nodes) {
      const nodeSkillsForNode = skillsByNode.get(node.slug) ?? [];
      const achieved = achievedByNode.get(node.slug) ?? false;
      const coverage = Math.round(nodeSkillsForNode.filter(item => item.current >= item.target).length / Math.max(1, nodeSkillsForNode.length) * 100);
      const view: CareerNode = {
        id: node.slug,
        code: node.code ?? '',
        title: node.title ?? '',
        meta: '岗位能力要求',
        state: achieved ? '当前职称已达成' : '岗位能力参考',
        coverage,
        description: achieved
          ? '该层级职称已持有，能力要求按职称覆盖视为已满足。'
          : '根据当前员工的有效认证技能对照岗位要求。',
        skills: nodeSkillsForNode,
        achieved,
        isNext: false,
      };
      const list: CareerNode[] = nodesBySequence.get(node.sequenceSlug) ?? [];
      list.push(view);
      nodesBySequence.set(node.sequenceSlug, list);
    }

    // 偏好序列的节点文案：当前职称层 → 当前岗位；最近未达成层 → 推荐下一站；
    // 其余未达成层按远近 → 远期方向 / 长期方向。
    const preferred = this.judging.preferredTrackForCurrentEmployee();
    const preferredNodes = preferred ? nodesBySequence.get(preferred) : undefined;
    if (preferredNodes) {
      const pending = preferredNodes.filter(node => !node.achieved);
      pending.forEach((node, index) => {
        if (pending.length === 1) {
          node.meta = '推荐下一站';
          node.isNext = true;
        } else if (index === 0) {
          node.meta = '推荐下一站';
          node.isNext = true;
        } else if (index === pending.length - 1) {
          node.meta = '长期方向';
        } else {
          node.meta = '远期方向';
        }
        if (node.isNext) node.state = '推荐下一站';
      });
      for (const node of preferredNodes) {
        const nodeLevel = Number((node.code ?? '').replace(/^T/, ''));
        if (node.achieved) {
          node.meta = preferred && Number.isInteger(nodeLevel) && nodeLevel === (heldLevelByTrack.get(preferred) ?? 0)
            ? '当前岗位'
            : '已达成';
        }
      }
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
        const pendingSkills = next.requirements
          .filter(item => !item.met)
          .map(item => `${item.skillName}（L${item.currentLevel} → L${item.requiredLevel}）`);
        items.unshift({
          source: 'career',
          sourceLabel: '职业下一节点',
          title: `${next.levelName}（${next.levelCode}）`,
          description: pendingSkills.length > 0
            ? `未达标：${pendingSkills.join('、')}。可在「资格自查」页查看明细与补齐方向。`
            : `还差 ${next.total - next.met} 项能力要求达标，可在「资格自查」页查看明细。`,
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

  /**
   * 针对 Gap 的行动建议：学习（课程/资源）、岗位实践、导师反馈并重，
   * 每条都对应一个 Gap 技能并给出可验证交付方向。
   */
  async getGapActions(): Promise<GapActionsResponse> {
    const overview = await this.judging.getOverview();
    const preferred = overview.tracks.find(track => track.slug === overview.preferredTrack) ?? overview.tracks[0];
    const next = preferred?.levels
      .filter(level => level.state === 'preparing')
      .sort((a, b) => (b.met / Math.max(1, b.total)) - (a.met / Math.max(1, a.total)))[0];
    if (!next || next.met >= next.total) return { items: [] };

    const detail = await this.judging.getGap(next.trackSlug, next.levelCode);
    const items: GapAction[] = [];
    const usedResourceSlugs = new Set<string>();
    const kindMeta: Record<string, { kind: GapAction['kind']; badge: string; label: string }> = {
      course: { kind: 'course', badge: '课程', label: '加入学习计划' },
      training: { kind: 'resource', badge: '专项训练', label: '加入学习计划' },
      project: { kind: 'practice', badge: '岗位实践', label: '创建行动' },
    };

    for (const gap of detail.gapItems) {
      // 同一资源只推荐一次，避免多个 Gap 技能匹配到同一课程造成重复卡片。
      const resource = gap.resources.find(item => !usedResourceSlugs.has(item.slug));
      if (resource) {
        usedResourceSlugs.add(resource.slug);
        const meta = kindMeta[resource.kind] ?? kindMeta.course;
        items.push({
          id: `${detail.levelCode}-${gap.skillSlug}-${resource.slug}`,
          kind: meta.kind,
          badge: meta.badge,
          title: resource.title,
          gapTitle: `${detail.levelName} · ${gap.skillName}`,
          detail: `对应 Gap：${gap.skillName}（当前 L${gap.currentLevel} · 要求 L${gap.requiredLevel}）`,
          effort: resource.estimatedEffort ?? '',
          actionLabel: meta.label,
        });
      } else {
        const focus = gap.competencyNames.length > 0 ? gap.competencyNames[0] : gap.skillName;
        items.push({
          id: `${detail.levelCode}-${gap.skillSlug}-practice`,
          kind: 'practice',
          badge: '岗位实践',
          title: `在实际项目中主导一次「${gap.skillName}」任务`,
          gapTitle: `${detail.levelName} · ${gap.skillName}`,
          detail: `围绕「${focus}」补齐 ${gap.gapLevels} 级，沉淀方案与结果作为认证证据`,
          effort: '4-6 周',
          actionLabel: '创建行动',
        });
      }
    }

    if (detail.gapItems.length >= 2) {
      const [first, second] = detail.gapItems;
      items.push({
        id: `${detail.levelCode}-mentor`,
        kind: 'mentor',
        badge: '导师建议',
        title: `与资深专家进行 1 次「${first.skillName}」方案拆解`,
        gapTitle: `${detail.levelName}`,
        detail: `重点反馈：${first.skillName}与${second.skillName}的边界识别、取舍依据与可验证交付标准`,
        effort: '1 小时 · 每两周',
        actionLabel: '查看导师',
      });
    }

    return { items };
  }
}
