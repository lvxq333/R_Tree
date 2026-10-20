import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  careerNode,
  careerNodeSkill,
  careerSequence,
  employee,
  skill,
  skillCategory,
  skillGap,
} from '@server/database/schema';
import {
  mvpCompetency,
  mvpEmployeeSkill,
  mvpEmployeeTitle,
  mvpSkillCompetency,
  mvpTitleLevel,
  mvpTitleRequirement,
} from '@server/database/mvp-schema';
import { JudgingService } from '../judging/judging.service';
import type {
  AbilityAxis,
  AbilityStructureResponse,
  CareerNode,
  CareerNodeSkill,
  CareerResponse,
  CareerSequenceView,
  GapActionsResponse,
  GapAction,
  GapCompetency,
  GapListResponse,
  GapPoolItem,
  GapSource,
  GrowthEventsResponse,
  GrowthRange,
  SkillGrowthEvent,
} from '@shared/api.interface';

const GAP_SOURCES: string[] = ['career', 'okr', 'current'];
/** 技术序列：管理通道取这些序列的最高职级做平移基准 */
const TECH_TRACKS: string[] = ['software', 'platform', 'ai'];
/** 能力结构雷达图的六个固定维度：技能分类 → 维度聚合 */
const RADAR_DIMENSIONS: { name: string; categories: string[] }[] = [
  { name: '研发工程能力', categories: ['coding-eng', 'eng-practice', 'rd-efficiency', 'cloud-native', 'platform-eng', 'stability', 'data-ai', 'ai-app'] },
  { name: '系统设计', categories: ['sys-design'] },
  { name: '工程质量', categories: ['eng-quality'] },
  { name: '协作与影响', categories: ['collaboration', 'collab-impact'] },
  { name: '业务理解', categories: ['business'] },
  { name: '问题解决', categories: ['problem-solving'] },
];

const GAP_SOURCE_LABELS: Record<GapSource, string> = {
  career: '职业',
  okr: 'OKR',
  current: '岗位',
  profile: '画像',
};

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

  /**
   * 各序列职级核算（不做序列间互认）：
   * 1. 职称：员工在该序列实际持有的职称层级；
   * 2. 技能：按该序列各层全部能力要求逐层核算，全部由有效认证满足的最高层。
   * 两者取高作为该序列的职级，并记录来源（title / skills / none）。
   */
  private async heldLevelsByTrack(employeeSlug: string): Promise<{
    levelByTrack: Map<string, number>;
    sourceByTrack: Map<string, 'title' | 'skills' | 'none'>;
  }> {
    const titleRows = await this.db
      .select({ trackSlug: mvpTitleLevel.trackSlug, levelOrder: mvpTitleLevel.levelOrder })
      .from(mvpEmployeeTitle)
      .innerJoin(mvpTitleLevel, eq(mvpTitleLevel.id, mvpEmployeeTitle.titleLevelId))
      .where(and(eq(mvpEmployeeTitle.employeeSlug, employeeSlug), eq(mvpEmployeeTitle.status, 'active')));
    const titleLevel = new Map<string, number>();
    for (const row of titleRows) {
      const held = titleLevel.get(row.trackSlug) ?? 0;
      if (row.levelOrder > held) titleLevel.set(row.trackSlug, row.levelOrder);
    }

    const levelRows = await this.db
      .select({ id: mvpTitleLevel.id, trackSlug: mvpTitleLevel.trackSlug, levelOrder: mvpTitleLevel.levelOrder })
      .from(mvpTitleLevel);
    const reqRows = await this.db
      .select({ titleLevelId: mvpTitleRequirement.titleLevelId, skillSlug: mvpTitleRequirement.skillSlug, requiredLevel: mvpTitleRequirement.requiredLevel })
      .from(mvpTitleRequirement);
    const reqsByLevelId = new Map<string, { skillSlug: string; requiredLevel: number }[]>();
    for (const row of reqRows) {
      const list = reqsByLevelId.get(row.titleLevelId) ?? [];
      list.push({ skillSlug: row.skillSlug, requiredLevel: row.requiredLevel });
      reqsByLevelId.set(row.titleLevelId, list);
    }

    const rawLevels = await this.activeSkillLevels(employeeSlug);
    const tracks = [...new Set([...titleLevel.keys(), ...levelRows.map(row => row.trackSlug)])];
    const skillLevel = new Map<string, number>();
    for (const track of tracks) {
      const levels = levelRows
        .filter(row => row.trackSlug === track)
        .sort((a, b) => a.levelOrder - b.levelOrder);
      let reached = 0;
      for (const level of levels) {
        const reqs = reqsByLevelId.get(level.id) ?? [];
        const allMet = reqs.length > 0 && reqs.every(req => (rawLevels.get(req.skillSlug) ?? 0) >= req.requiredLevel);
        if (!allMet) break;
        reached = level.levelOrder;
      }
      skillLevel.set(track, reached);
    }

    const levelByTrack = new Map<string, number>();
    const sourceByTrack = new Map<string, 'title' | 'skills' | 'none'>();
    for (const track of tracks) {
      const byTitle = titleLevel.get(track) ?? 0;
      const bySkill = skillLevel.get(track) ?? 0;
      const level = Math.max(byTitle, bySkill);
      levelByTrack.set(track, level);
      sourceByTrack.set(track, level === 0 ? 'none' : byTitle >= bySkill ? 'title' : 'skills');
    }
    return { levelByTrack, sourceByTrack };
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
    const rawLevels = await this.activeSkillLevels(employeeSlug);
    const effective = await this.judging.effectiveLevelsForCurrentEmployee();
    const { levelByTrack, sourceByTrack } = await this.heldLevelsByTrack(employeeSlug);

    const skillNameBySlug = new Map<string, string>(
      skills.map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );
    const preferred = this.judging.preferredTrackForCurrentEmployee();

    const skillsByNode = new Map<string, CareerNodeSkill[]>();
    const achievedByNode = new Map<string, boolean>();
    for (const node of nodes) {
      const nodeLevel = Number((node.code ?? '').replace(/^T/, '').replace(/^M/, ''));
      const heldLevel = levelByTrack.get(node.sequenceSlug) ?? 0;
      const achieved = Number.isInteger(nodeLevel) && nodeLevel > 0 && nodeLevel <= heldLevel;
      achievedByNode.set(node.slug, achieved);
      const list: CareerNodeSkill[] = [];
      for (const nodeSkill of nodeSkills.filter(row => row.nodeSlug === node.slug)) {
        const raw = rawLevels.get(nodeSkill.skillSlug) ?? 0;
        let current = raw;
        let source: CareerNodeSkill['source'] = 'cert';
        if (achieved) {
          // 已达成的层：技能明细按职称/认证覆盖视为已满足，避免「高级工程师却显示 T1 全 Gap」。
          current = Math.max(raw, nodeSkill.requiredLevel);
          source = sourceByTrack.get(node.sequenceSlug) === 'skills' ? 'skill-covered' : 'title-covered';
        } else if (Number.isInteger(nodeLevel) && heldLevel > 0 && nodeLevel === heldLevel + 1) {
          // 紧邻下一层：偏好序列用有效等级（职称覆盖 + 职称基线）反映既有能力；
          // 其他序列按原始认证展示，避免本序列职称覆盖泄漏到别的序列、与实际职级矛盾。
          const eff = node.sequenceSlug === preferred ? (effective.levels.get(nodeSkill.skillSlug) ?? 0) : 0;
          current = Math.max(raw, eff);
          source = eff > raw && effective.baseline.has(nodeSkill.skillSlug)
            ? 'title-baseline'
            : eff > raw && effective.covered.has(nodeSkill.skillSlug)
              ? 'title-covered'
              : 'cert';
        }
        const name: string = skillNameBySlug.get(nodeSkill.skillSlug) ?? nodeSkill.skillSlug;
        list.push({ name, current, target: nodeSkill.requiredLevel, source });
      }
      skillsByNode.set(node.slug, list);
    }

    const nodesBySequence = new Map<string, CareerNode[]>();
    for (const node of nodes) {
      const nodeSkillsForNode = skillsByNode.get(node.slug) ?? [];
      const achieved = achievedByNode.get(node.slug) ?? false;
      const coverage = Math.round(nodeSkillsForNode.filter(item => item.current >= item.target).length / Math.max(1, nodeSkillsForNode.length) * 100);
      const bySkills = sourceByTrack.get(node.sequenceSlug) === 'skills';
      const view: CareerNode = {
        id: node.slug,
        code: node.code ?? '',
        title: node.title ?? '',
        meta: '岗位能力要求',
        state: achieved ? (bySkills ? '技能认证已达标' : '当前职称已达成') : '岗位能力参考',
        coverage,
        description: achieved
          ? bySkills
            ? '该层级能力要求已全部由有效认证满足，按实际掌握技能核算达标。'
            : '该层级职称已持有，能力要求按职称覆盖视为已满足。'
          : '根据当前员工的有效认证技能对照岗位要求。',
        skills: nodeSkillsForNode,
        achieved,
        isNext: false,
      };
      const list: CareerNode[] = nodesBySequence.get(node.sequenceSlug) ?? [];
      list.push(view);
      nodesBySequence.set(node.sequenceSlug, list);
    }

    for (const [trackSlug, trackNodes] of nodesBySequence) {
      if (trackSlug === 'management') continue;
      const heldLevel = levelByTrack.get(trackSlug) ?? 0;
      const pending = trackNodes.filter(node => !node.achieved);
      pending.forEach((node, index) => {
        if (index === 0) {
          node.meta = '推荐下一站';
          node.isNext = true;
          node.state = '推荐下一站';
        } else if (index === pending.length - 1) {
          node.meta = '长期方向';
        } else {
          node.meta = '远期方向';
        }
      });
      for (const node of trackNodes) {
        const nodeLevel = Number((node.code ?? '').replace(/^T/, ''));
        if (!node.achieved || !Number.isInteger(nodeLevel)) continue;
        node.meta = nodeLevel === heldLevel
          ? (trackSlug === preferred ? '当前岗位' : '当前职级')
          : '已达成';
      }
    }

    // 管理通道：取各序列最高职级做平移基准。已达成的职级沿用该技术序列的职称，
    // 未达成的职级展示管理通道自身职称；能力要求按基准职级覆盖。
    const titleLevelRows = await this.db
      .select({ trackSlug: mvpTitleLevel.trackSlug, levelOrder: mvpTitleLevel.levelOrder, name: mvpTitleLevel.name })
      .from(mvpTitleLevel);
    const trackLevelTitles = new Map(
      titleLevelRows.map(row => [`${row.trackSlug}:${row.levelOrder}`, row.name]),
    );
    const mgmtNodes = nodesBySequence.get('management') ?? [];
    const candidates = [...levelByTrack.entries()]
      .filter(([, level]) => level > 0)
      .map(([track, level]) => ({ track, level, byTitle: sourceByTrack.get(track) === 'title' }))
      .sort((a, b) => b.level - a.level || Number(b.byTitle) - Number(a.byTitle) || Number(a.track === preferred) - Number(b.track === preferred));
    const baseline = candidates[0];
    mgmtNodes.forEach((node, index) => {
      const ordinal = index + 1;
      const achieved = baseline !== undefined && ordinal <= baseline.level;
      node.achieved = achieved;
      if (baseline !== undefined) {
        const baselineTitle = trackLevelTitles.get(`${baseline.track}:${ordinal}`);
        if (achieved && baselineTitle) node.title = baselineTitle;
      }
      const nodeSkillsForNode = skillsByNode.get(node.id) ?? [];
      node.coverage = achieved
        ? 100
        : Math.round(nodeSkillsForNode.filter(item => item.current >= item.target).length / Math.max(1, nodeSkillsForNode.length) * 100);
      if (achieved) {
        node.state = '按技术职级平移';
        node.description = baseline
          ? `沿用${this.trackLabel(baseline.track)}序列第 ${ordinal} 层职级（${node.title}）；能力要求按该职级视为已满足。`
          : '该职级按技术序列最高职级平移。';
        node.meta = ordinal === baseline?.level ? '当前职级' : '已达成';
        node.skills = (node.skills ?? []).map(skill => ({
          ...skill,
          current: Math.max(skill.current, skill.target),
          source: 'title-covered' as const,
        }));
      } else {
        const pendingIndex = mgmtNodes.filter(item => !item.achieved).indexOf(node);
        if (pendingIndex === 0) {
          node.meta = '推荐下一站';
          node.isNext = true;
          node.state = '推荐下一站';
        } else if (pendingIndex === mgmtNodes.filter(item => !item.achieved).length - 1) {
          node.meta = '长期方向';
        } else {
          node.meta = '远期方向';
        }
      }
    });

    const sequenceViews: CareerSequenceView[] = sequences.map(
      (sequence: typeof careerSequence.$inferSelect): CareerSequenceView => ({
        key: sequence.slug,
        label: sequence.label,
        description: sequence.description ?? '',
        nodes: nodesBySequence.get(sequence.slug) ?? [],
      }),
    );

    return { sequences: sequenceViews, preferredTrack: preferred };
  }

  private trackLabel(track: string): string {
    return ({ software: '软件开发', platform: '平台工程', ai: '数据与 AI', management: '管理' })[track] ?? track;
  }

  async getEvents(range: GrowthRange): Promise<GrowthEventsResponse> {
    // 轨迹从入职第一次点亮开始：先落初始职称认定（一次性点亮持有层及以下全部技能要求），
    // 再按认证时间生成认证事件；total 为截至该事件的累计点亮技能数（去重）。
    const employeeSlug = currentEmployee().employeeSlug;
    const skillNameBySlug = new Map<string, string>(
      (await this.db.select().from(skill)).map((row: typeof skill.$inferSelect) => [row.slug, row.name]),
    );

    const titles = await this.db
      .select({
        trackSlug: mvpTitleLevel.trackSlug,
        levelOrder: mvpTitleLevel.levelOrder,
        levelCode: mvpTitleLevel.levelCode,
        name: mvpTitleLevel.name,
        certifiedAt: mvpEmployeeTitle.certifiedAt,
      })
      .from(mvpEmployeeTitle)
      .innerJoin(mvpTitleLevel, eq(mvpTitleLevel.id, mvpEmployeeTitle.titleLevelId))
      .where(and(eq(mvpEmployeeTitle.employeeSlug, employeeSlug), eq(mvpEmployeeTitle.status, 'active')))
      .orderBy(asc(mvpEmployeeTitle.certifiedAt));

    const levelRows = await this.db
      .select({ id: mvpTitleLevel.id, trackSlug: mvpTitleLevel.trackSlug, levelOrder: mvpTitleLevel.levelOrder })
      .from(mvpTitleLevel);
    const reqRows = await this.db
      .select({ titleLevelId: mvpTitleRequirement.titleLevelId, skillSlug: mvpTitleRequirement.skillSlug })
      .from(mvpTitleRequirement);
    const reqsByLevel = new Map<string, string[]>();
    for (const row of reqRows) {
      const list = reqsByLevel.get(row.titleLevelId) ?? [];
      list.push(row.skillSlug);
      reqsByLevel.set(row.titleLevelId, list);
    }

    const certs = await this.db
      .select()
      .from(mvpEmployeeSkill)
      .where(and(eq(mvpEmployeeSkill.employeeSlug, employeeSlug), eq(mvpEmployeeSkill.status, 'active')))
      .orderBy(asc(mvpEmployeeSkill.certifiedAt));

    const lit = new Set<string>();
    const pending: { at: number; date: string; event: SkillGrowthEvent }[] = [];
    const monthFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' });

    // 1) 职称认定事件：持有层及以下要求过的技能在职称生效当天一次性点亮。
    for (const title of titles) {
      const at = title.certifiedAt instanceof Date ? title.certifiedAt.getTime() : Date.parse(String(title.certifiedAt));
      if (!Number.isFinite(at)) continue;
      const levelIds = new Set(
        levelRows
          .filter(row => row.trackSlug === title.trackSlug && row.levelOrder <= title.levelOrder)
          .map(row => row.id),
      );
      const coveredSkills = new Set<string>();
      for (const [levelId, skillSlugs] of reqsByLevel) {
        if (!levelIds.has(levelId)) continue;
        for (const skillSlug of skillSlugs) coveredSkills.add(skillSlug);
      }
      const fresh = [...coveredSkills].filter(skillSlug => !lit.has(skillSlug));
      fresh.forEach(skillSlug => lit.add(skillSlug));
      pending.push({
        at,
        date: monthFormat.format(new Date(at)).replace('-', '.'),
        event: {
          date: '',
          total: lit.size,
          title: title.name,
          category: '职称认定',
          level: title.levelCode,
          evidence: '入职职称认定',
          approver: '',
          note: `初始职称认定生效，一次性点亮 ${fresh.length} 项技能要求`,
        },
      });
    }

    // 2) 认证事件：每技能取最高等级；已被职称点亮的技能记为进阶认证（累计数不变）。
    const best = new Map<string, { at: number; level: number }>();
    for (const row of certs) {
      const at = row.certifiedAt instanceof Date ? row.certifiedAt.getTime() : Date.parse(String(row.certifiedAt));
      if (!Number.isFinite(at)) continue;
      const previous = best.get(row.skillSlug);
      if (previous && previous.level >= row.level) continue;
      best.set(row.skillSlug, { at, level: row.level });
      const alreadyLit = lit.has(row.skillSlug);
      lit.add(row.skillSlug);
      pending.push({
        at,
        date: monthFormat.format(new Date(at)).replace('-', '.'),
        event: {
          date: '',
          total: lit.size,
          title: skillNameBySlug.get(row.skillSlug) ?? row.skillSlug,
          category: '技能认证',
          level: `L${row.level}`,
          evidence: '',
          approver: '',
          note: alreadyLit
            ? `技能等级进阶认证，当前等级 L${row.level}`
            : `技能认证生效，当前等级 L${row.level}`,
        },
      });
    }

    pending.sort((a, b) => a.at - b.at);
    const events: SkillGrowthEvent[] = pending.map(item => ({ ...item.event, date: item.date }));

    // 时间范围按真实日期过滤：近 N 个月以今天为基准回溯，全部返回完整轨迹。
    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30.44 * 24 * 3600 * 1000;
    const cutoff =
      range === '6m' ? sixMonthsAgo
        : range === '12m' ? now - 12 * 30.44 * 24 * 3600 * 1000
          : 0;
    const limited = cutoff > 0
      ? pending.filter(item => item.at >= cutoff).map(item => ({ ...item.event, date: item.date }))
      : events;

    // 右上角统计：近 6 个月新增认证次数（不含职称认定），与时间范围筛选无关。
    const recentCertCount = pending.filter(
      item => item.event.category === '技能认证' && item.at >= sixMonthsAgo,
    ).length;

    return { events: limited, recentCertCount };
  }

  async getGaps(): Promise<GapListResponse> {
    const items: GapPoolItem[] = [];

    // 1) 职业下一节点：按技能拆条，每条带该技能在目标等级下的子能力要求。
    try {
      const overview = await this.judging.getOverview();
      const preferred = overview.tracks.find(track => track.slug === overview.preferredTrack) ?? overview.tracks[0];
      const next = preferred?.levels
        .filter(level => level.state === 'preparing')
        .sort((a, b) => (b.met / Math.max(1, b.total)) - (a.met / Math.max(1, a.total)))[0];
      if (next) {
        const pending = next.requirements.filter(item => !item.met);
        const competenciesBySkill = await this.loadCompetencyRequirements(
          pending.map(item => ({ skillSlug: item.skillSlug, level: item.requiredLevel })),
        );
        const categoryBySkill = await this.loadSkillCategories();
        for (const item of pending) {
          const gapLevels = Math.max(0, item.requiredLevel - item.currentLevel);
          items.push({
            source: 'career',
            sourceLabel: GAP_SOURCE_LABELS.career,
            title: item.skillName,
            description: `${categoryBySkill.get(item.skillSlug) ?? '专业技能'} · ${next.levelName}要求`,
            filled: item.currentLevel,
            target: item.requiredLevel,
            levelRange: `L${item.currentLevel} → L${item.requiredLevel}`,
            priority: gapLevels >= 3 ? 'p0' : gapLevels === 2 ? 'p1' : 'p2',
            gapLevels,
            competencies: competenciesBySkill.get(item.skillSlug) ?? [],
          });
        }
        // 优先级升序（P0 在前），同优先级按差距降序。
        items.sort((a, b) => {
          const order = { p0: 0, p1: 1, p2: 2 } as const;
          if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
          return b.gapLevels - a.gapLevels;
        });
      }
    } catch {
      // 判定层不可用时仅返回旧 Gap 数据，不阻塞页面。
    }

    // 2) OKR 推导 / 当前岗位：仍读旧表记录，与职业 Gap 合并展示。
    const rows = await this.db
      .select()
      .from(skillGap)
      .where(
        and(
          eq(skillGap.employeeSlug, currentEmployee().employeeSlug),
          inArray(skillGap.source, ['okr', 'current']),
        ),
      )
      .orderBy(asc(skillGap.sort));

    for (const row of rows) {
      const source = toGapSource(row.source);
      const filled = row.filled ?? 0;
      const target = row.target ?? 0;
      items.push({
        source,
        sourceLabel: GAP_SOURCE_LABELS[source],
        title: row.title,
        description: row.description ?? '',
        filled,
        target,
        levelRange: row.levelRange ?? '',
        priority: toGapPriority(row.priority),
        gapLevels: Math.max(0, target - filled),
        competencies: [],
      });
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

  /**
   * 能力结构分布（雷达图）：六个固定能力维度（按技能分类聚合），
   * 我的水平用有效等级（认证/职称覆盖/职称基线）在维度内取最高，
   * 对照同部门团队各成员同口径最高等级的平均值。
   */
  async getAbilityStructure(): Promise<AbilityStructureResponse> {
    const employeeSlug = currentEmployee().employeeSlug;
    const skillRows = await this.db
      .select({ slug: skill.slug, category: skill.categorySlug })
      .from(skill);
    const categoryBySkill = new Map(skillRows.map(row => [row.slug, row.category]));
    const dimIndexByCategory = new Map<string, number>();
    RADAR_DIMENSIONS.forEach((dim, index) => {
      for (const category of dim.categories) dimIndexByCategory.set(category, index);
    });

    // 我的水平：有效等级（认证 / 职称覆盖 / 职称基线）在维度内取最高。
    const effective = await this.judging.effectiveLevelsForCurrentEmployee();
    const myByDim = RADAR_DIMENSIONS.map(() => 0);
    for (const [skillSlug, level] of effective.levels) {
      const dimIndex = dimIndexByCategory.get(categoryBySkill.get(skillSlug) ?? '');
      if (dimIndex === undefined) continue;
      myByDim[dimIndex] = Math.max(myByDim[dimIndex], Math.min(level, 5));
    }

    // 团队口径：同部门（org）员工；部门只有本人时回退全体员工作为参照。
    const orgRows = await this.db
      .select({ slug: employee.slug, org: employee.org })
      .from(employee);
    const orgBySlug = new Map(orgRows.map(row => [row.slug, row.org]));
    const myOrg = orgBySlug.get(employeeSlug) ?? '';
    let members = orgRows.filter(row => row.org && row.org === myOrg).map(row => row.slug);
    let teamLabel: string | null = members.length >= 2 ? `${myOrg} · ${members.length} 人` : null;
    if (members.length < 2) {
      members = orgRows.map(row => row.slug);
      teamLabel = members.length >= 2 ? `全体员工 · ${members.length} 人` : null;
    }

    const certRows = members.length > 0
      ? await this.db
        .select({ employeeSlug: mvpEmployeeSkill.employeeSlug, skillSlug: mvpEmployeeSkill.skillSlug, level: mvpEmployeeSkill.level })
        .from(mvpEmployeeSkill)
        .where(and(eq(mvpEmployeeSkill.status, 'active'), inArray(mvpEmployeeSkill.employeeSlug, members)))
      : [];
    const bestByMemberSkill = new Map<string, number>();
    for (const row of certRows) {
      const key = `${row.employeeSlug}:${row.skillSlug}`;
      bestByMemberSkill.set(key, Math.max(bestByMemberSkill.get(key) ?? 0, row.level));
    }

    const skillsByDim = RADAR_DIMENSIONS.map(dim =>
      new Set(skillRows.filter(row => dim.categories.includes(row.category ?? '')).map(row => row.slug)),
    );
    const axes: AbilityAxis[] = RADAR_DIMENSIONS.map((dim, index) => {
      const values = members.map(member => {
        let best = 0;
        for (const skillSlug of skillsByDim[index]) {
          best = Math.max(best, bestByMemberSkill.get(`${member}:${skillSlug}`) ?? 0);
        }
        return best;
      });
      const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return {
        name: dim.name,
        current: myByDim[index],
        target: Math.round(avg * 10) / 10,
        fromBaseline: false,
      };
    });

    return {
      axes,
      heldLevelCode: null,
      teamLabel,
      summary: '我的水平与团队平均对比',
    };
  }

  /** 技能在指定等级下的子能力要求（含名称与要求等级）。 */
  private async loadCompetencyRequirements(
    targets: { skillSlug: string; level: number }[],
  ): Promise<Map<string, GapCompetency[]>> {
    const result = new Map<string, GapCompetency[]>();
    if (targets.length === 0) return result;
    const rows = await this.db
      .select({
        skillSlug: mvpSkillCompetency.skillSlug,
        level: mvpSkillCompetency.level,
        name: mvpCompetency.name,
        required: mvpSkillCompetency.requiredCompetencyLevel,
      })
      .from(mvpSkillCompetency)
      .innerJoin(mvpCompetency, eq(mvpCompetency.slug, mvpSkillCompetency.competencySlug))
      .where(inArray(mvpSkillCompetency.skillSlug, [...new Set(targets.map(item => item.skillSlug))]));
    for (const row of rows) {
      if (!targets.some(item => item.skillSlug === row.skillSlug && item.level === row.level)) continue;
      const list = result.get(row.skillSlug) ?? [];
      list.push({ name: row.name, level: row.required });
      result.set(row.skillSlug, list);
    }
    return result;
  }

  /** 技能 → 所属能力类目名（如 系统设计 / 组织管理），用于 Gap 条目描述。 */
  private async loadSkillCategories(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ slug: skill.slug, category: skillCategory.name })
      .from(skill)
      .leftJoin(skillCategory, eq(skillCategory.slug, skill.categorySlug));
    return new Map(rows.map(row => [row.slug, row.category ?? '专业技能']));
  }
}
