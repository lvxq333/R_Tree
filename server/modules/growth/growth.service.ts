import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  careerNode,
  careerNodeSkill,
  careerSequence,
  employee,
  skill,
  skillCategory,
} from '@server/database/schema';
import {
  mvpEmployeeSkill,
  mvpEmployeeTitle,
  mvpTitleLevel,
  mvpTitleRequirement,
} from '@server/database/mvp-schema';
import { JudgingService } from '../judging/judging.service';
import { resolveCareerDirection } from './career-position';
import type {
  AbilityAxis,
  AbilityStructureResponse,
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
      .where(and(eq(mvpEmployeeSkill.employeeSlug, employeeSlug), eq(mvpEmployeeSkill.status, 'active'), sql`(${mvpEmployeeSkill.reviewDueAt} IS NULL OR ${mvpEmployeeSkill.reviewDueAt} >= now())`));
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
      .from(mvpTitleLevel).where(sql`${mvpTitleLevel.standardVersionSlug}=(SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1) AND COALESCE(${mvpTitleLevel.pathLabel},'')=''`);
    const reqRows = await this.db
      .select({ titleLevelId: mvpTitleRequirement.titleLevelId, skillSlug: mvpTitleRequirement.skillSlug, requiredLevel: mvpTitleRequirement.requiredLevel })
      .from(mvpTitleRequirement).where(eq(mvpTitleRequirement.isRequired,true));
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

  /** 路线浏览从岗位标准实时生成；不写入员工方向，也不参与Gap池选取。 */
  async getCareer(): Promise<CareerResponse> {
    const employeeSlug=currentEmployee().employeeSlug;
    const [overview,tracks,profiles,held,certificates]=await Promise.all([
      this.judging.getOverview(),
      this.db.execute<{slug:string;name:string;family:import('@shared/api.interface').JobFamily}>(sql`SELECT slug,name,job_family AS family FROM mvp_title_track WHERE status='published' ORDER BY CASE job_family WHEN 'T' THEN 1 WHEN 'P' THEN 2 WHEN 'M' THEN 3 ELSE 4 END,name,slug`),
      this.db.execute<{preferred_track:string|null;role:string|null;job_grade:string|null}>(sql`SELECT preferred_track,role,job_grade FROM employee WHERE slug=${employeeSlug}`),
      this.heldLevelsByTrack(employeeSlug),
      this.db.execute<{skill_slug:string;level:number}>(sql`SELECT skill_slug,max(level)::int AS level FROM mvp_employee_skill WHERE employee_slug=${employeeSlug} AND status='active' AND (review_due_at IS NULL OR review_due_at>=now()) GROUP BY skill_slug`),
    ]);
    const profile=profiles[0];
    const certifiedLevels=new Map(certificates.map(row=>[row.skill_slug,row.level]));
    const preferred=resolveCareerDirection(profile??{role:null,preferred_track:null,job_grade:null},tracks.map(track=>({...track,
      titles:(overview.tracks.find(t=>t.slug===track.slug)?.levels??[]).map(level=>level.levelName)})));
    const sequences:CareerSequenceView[]=tracks.map(track=>{
      const levels=(overview.tracks.find(t=>t.slug===track.slug)?.levels??[]).sort((a,b)=>a.levelOrder-b.levelOrder);
      const recorded=track.slug===preferred&&profile?.job_grade&&new RegExp(`^${track.family}[1-4]$`).test(profile.job_grade)?Number(profile.job_grade.slice(1)):0;
      const heldLevel=Math.max(held.levelByTrack.get(track.slug)??0,recorded);
      const nodes:CareerNode[]=levels.map(level=>{
        const achieved=level.levelOrder<=heldLevel||level.state==='certified';
        // 路线节点可体现岗位职级，但技能展示只使用实际有效认证，不虚构L1或覆盖等级。
        const skills=level.requirements.map(r=>{
          const certifiedLevel=certifiedLevels.get(r.skillSlug);
          return {name:r.skillName,target:r.requiredLevel,current:certifiedLevel??0,
            ...(certifiedLevel!==undefined?{certifiedLevel}:{}),isRequired:r.isRequired,source:'cert' as const};
        });
        const mandatory=skills.filter(s=>s.isRequired!==false);
        return {id:`${track.slug}:${level.levelCode}`,code:level.levelCode,title:level.levelName,
          achieved,isNext:false,meta:achieved?(level.levelOrder===heldLevel?(track.slug===preferred?'当前岗位':'当前职级'):'已达成'):'岗位能力要求',
          state:achieved?'已达成':mandatory.length?'岗位能力参考':'标准未配置',
          coverage:mandatory.length?Math.round(mandatory.filter(s=>s.current>=s.target).length/mandatory.length*100):0,
          description:mandatory.length?'按岗位标准与有效技能认证对照；推荐技能不影响满足度。':'该职级尚未配置必需技能标准，请联系管理人员完善。',skills};
      });
      const next=nodes.find(n=>!n.achieved);
      if(next){next.isNext=true;next.meta='推荐下一站';if(next.skills.some(s=>s.isRequired!==false))next.state='推荐下一站';}
      return {key:track.slug,label:track.name,family:track.family,description:`${track.name}岗位发展路线`,nodes};
    });
    return {sequences,preferredTrack:preferred};
  }

  private async getLegacyCareer(): Promise<CareerResponse> {
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
    const user = currentEmployee();
    const [profile] = await this.db.execute<{ preferred_track: string | null }>(sql`
      SELECT preferred_track FROM employee WHERE slug=${employeeSlug}`);
    const titleTrack = [...levelByTrack.entries()]
      .filter(([track, level]) => TECH_TRACKS.includes(track) && level > 0 && sourceByTrack.get(track) === 'title')
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const preferred = user.personnelRole === 'hr' ? 'management'
      : profile && TECH_TRACKS.includes(profile.preferred_track ?? '') ? profile.preferred_track
        : titleTrack ?? this.judging.preferredTrackForCurrentEmployee();

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
      if (trackSlug === 'management' || trackSlug === 'hr') continue;
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
      .from(mvpTitleLevel).where(sql`${mvpTitleLevel.standardVersionSlug}=(SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1) AND COALESCE(${mvpTitleLevel.pathLabel},'')=''`);
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

    if (user.personnelRole === 'hr') {
      const hrNodes = nodesBySequence.get('hr') ?? [];
      const specialty = user.position.includes('员工关系') ? '员工关系' : '人才发展';
      hrNodes.forEach((node, index) => {
        node.title = [user.position || '人力资源专员', `资深${specialty}专员`, '人力资源经理', '人力资源总监'][index] ?? node.title;
        node.achieved = index === 0;
        node.isNext = index === 1;
        node.meta = index === 0 ? '当前岗位' : index === 1 ? '推荐下一站' : index === 3 ? '长期方向' : '远期方向';
        node.state = index === 0 ? '当前岗位' : node.meta;
        node.description = index === 0 ? '当前人力资源岗位的能力基础，以有效技能认证显示掌握情况。' : '根据人力资源岗位技能要求与当前有效认证对照。';
        node.coverage = Math.round(node.skills.filter(item => item.current >= item.target).length / Math.max(1, node.skills.length) * 100);
      });
      return { sequences: [{ key: 'management', label: '人力资源管理通道', description: '人力资源岗位发展路径', nodes: hrNodes }], preferredTrack: 'management' };
    }

    const sequenceViews: CareerSequenceView[] = sequences.filter(sequence => sequence.slug !== 'hr').map(
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
      .from(mvpTitleLevel).where(sql`${mvpTitleLevel.standardVersionSlug}=(SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1) AND COALESCE(${mvpTitleLevel.pathLabel},'')=''`);
    const reqRows = await this.db
      .select({ titleLevelId: mvpTitleRequirement.titleLevelId, skillSlug: mvpTitleRequirement.skillSlug })
      .from(mvpTitleRequirement).where(eq(mvpTitleRequirement.isRequired,true));
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
    const pending: { at: number; date: string; skills: string[]; freshCount: number; event: SkillGrowthEvent }[] = [];
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

      pending.push({
        at,
        date: monthFormat.format(new Date(at)).replace('-', '.'),
        skills: [...coveredSkills],
        freshCount: 0,
        event: {
          date: '',
          total: lit.size,
          title: title.name,
          category: '职称认定',
          level: title.levelCode,
          evidence: '入职职称认定',
          approver: '',
          note: '',
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
      pending.push({
        at,
        date: monthFormat.format(new Date(at)).replace('-', '.'),
        skills: [row.skillSlug],
        freshCount: 0,
        event: {
          date: '',
          total: lit.size,
          title: skillNameBySlug.get(row.skillSlug) ?? row.skillSlug,
          category: '技能认证',
          level: `L${row.level}`,
          evidence: '',
          approver: '',
          note: '',
        },
      });
    }

    // Merge title and skill records before counting: overlapping skills and upgrades
    // must not produce new lighting points, regardless of record source.
    const now = new Date();
    pending.sort((a, b) => a.at - b.at);
    const history = pending.filter(item => item.at <= now.getTime());
    for (const item of history) {
      const fresh = item.skills.filter(slug => !lit.has(slug));
      fresh.forEach(slug => lit.add(slug));
      item.freshCount = fresh.length;
      item.event.total = lit.size;
      item.event.date = item.date;
      item.event.occurredAt = new Date(item.at).toISOString();
      item.event.note = item.event.category === '职称认定'
        ? `职称认定生效，一次性点亮 ${fresh.length} 项技能要求`
        : fresh.length
          ? `技能认证生效，当前等级 ${item.event.level}`
          : `技能等级进阶认证，当前等级 ${item.event.level}`;
    }
    const shanghai = new Date(now.getTime() + 8 * 3600_000);
    const monthStart = (months: number) => Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth() - months + 1, 1) - 8 * 3600_000;
    const sixMonthsAgo = monthStart(6);
    const cutoff = range === '6m' ? sixMonthsAgo : range === '12m' ? monthStart(12) : 0;
    const limited = history.filter(item => item.at >= cutoff).map(item => item.event);
    // New skill items, not repeated certifications of skills already lit.
    const recentCertCount = history.reduce((count, item) => count + (item.at >= sixMonthsAgo ? item.freshCount : 0), 0);

    return { events: limited, recentCertCount };
  }

  /** 同来源的同一技能合并，保留最高目标和最高优先级；不同来源保留各自依据。 */
  private skillGapItems(items:GapPoolItem[]):GapPoolItem[]{
    const unique=new Map<string,GapPoolItem>();
    const order={p0:0,p1:1,p2:2};
    for(const item of items){
      const key=JSON.stringify([item.source,item.title.trim()]);
      if(!item.title.trim()||item.target<=item.filled)continue;
      const previous=unique.get(key);
      if(!previous){unique.set(key,{...item,levelRange:`L${item.filled} → L${item.target}`});continue;}
      const filled=Math.min(previous.filled,item.filled),target=Math.max(previous.target,item.target);
      unique.set(key,{...(item.target>previous.target?item:previous),filled,target,gapLevels:target-filled,
        levelRange:`L${filled} → L${target}`,priority:order[item.priority]<order[previous.priority]?item.priority:previous.priority});
    }
    return [...unique.values()].sort((a,b)=>order[a.priority]-order[b.priority]||b.gapLevels-a.gapLevels);
  }

  async getGaps(): Promise<GapListResponse> {
    // 与页面职业路线共用岗位匹配、当前职级、下一站及有效认证，禁止从预置差距表兜底。
    const career = await this.getCareer();
    const route = career.sequences.find(sequence => sequence.key === career.preferredTrack);
    if (!route) return { items: [] };
    const current = route.nodes.filter(node => node.achieved).at(-1);
    const next = route.nodes.find(node => node.isNext);
    const categories = await this.loadSkillCategories();
    const items: GapPoolItem[] = [];
    for (const [source, node] of [['current', current], ['career', next]] as const) {
      for (const requirement of node?.skills ?? []) {
        if (requirement.isRequired === false || requirement.current >= requirement.target) continue;
        const gapLevels = requirement.target - requirement.current;
        items.push({
          source, sourceLabel: GAP_SOURCE_LABELS[source], title: requirement.name,
          description: `${categories.get(requirement.name) ?? '专业技能'} · ${route.label} · ${node?.title}要求`,
          filled: requirement.current, target: requirement.target,
          levelRange: `L${requirement.current} → L${requirement.target}`,
          priority: gapLevels >= 3 ? 'p0' : gapLevels === 2 ? 'p1' : 'p2', gapLevels,
        });
      }
    }
    // OKR 尚无目标技能映射，暂不展示模拟推导结果。
    return { items: this.skillGapItems(items) };
  }

  /** 行动建议只对应同一份实时 Gap；学习资源必须明确关联到差距技能。 */
  async getGapActions(): Promise<GapActionsResponse> {
    const { items: gaps } = await this.getGaps();
    if (!gaps.length) return { items: [] };
    const resources = await this.db.execute<{
      skill_name: string; slug: string; kind: string; title: string; estimated_effort: string | null;
    }>(sql`
      SELECT DISTINCT s.name AS skill_name,r.slug,r.kind,r.title,r.estimated_effort
      FROM mvp_learning_resource r
      JOIN mvp_skill_competency sc ON r.targets_competency_slugs @> jsonb_build_array(sc.competency_slug)
      JOIN skill s ON s.slug=sc.skill_slug
      WHERE r.status='active' AND s.name IN (${sql.join(gaps.map(gap => sql`${gap.title}`), sql`, `)})
      ORDER BY r.slug`);
    const usedResources = new Set<string>();
    const uniqueGaps = new Map<string, GapPoolItem>();
    for (const gap of gaps) {
      const previous = uniqueGaps.get(gap.title);
      if (!previous || gap.target > previous.target) uniqueGaps.set(gap.title, gap);
    }
    const items: GapAction[] = [];
    for (const gap of uniqueGaps.values()) {
      const resource = resources.find(item => item.skill_name === gap.title && !usedResources.has(item.slug));
      if (resource) usedResources.add(resource.slug);
      const kind = resource?.kind === 'course' ? 'course' : resource?.kind === 'training' ? 'resource' : 'practice';
      items.push({
        id: `${gap.source}-${gap.title}-${resource?.slug ?? 'practice'}`,
        kind, badge: kind === 'course' ? '课程' : kind === 'resource' ? '专项训练' : '岗位实践',
        title: resource?.title ?? `在实际项目中完成一次「${gap.title}」任务`,
        gapTitle: `${gap.title} · ${gap.sourceLabel}差距`,
        detail: `${gap.description}；当前 L${gap.filled}，目标 L${gap.target}，需补齐 ${gap.gapLevels} 级并沉淀可验证成果`,
        effort: resource?.estimated_effort ?? '4-6 周',
        actionLabel: kind === 'practice' ? '创建行动' : '加入学习计划',
      });
    }
    if (uniqueGaps.size >= 2) {
      const [first, second] = [...uniqueGaps.values()];
      items.push({
        id: 'gap-mentor', kind: 'mentor', badge: '导师建议',
        title: `与资深专家进行 1 次「${first.title}」方案拆解`,
        gapTitle: `${first.title}、${second.title}`,
        detail: `围绕当前差距讨论${first.title}与${second.title}的取舍依据与可验证交付标准`,
        effort: '1 小时 · 每两周', actionLabel: '查看导师',
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
    const dimensions = currentEmployee().personnelRole === 'hr' ? [
      { name: '人力资源实务', categories: ['hr-practice'] },
      { name: '组织管理', categories: ['org-mgmt'] },
      { name: '协作与影响', categories: ['collaboration', 'collab-impact'] },
      { name: '业务理解', categories: ['business'] },
    ] : RADAR_DIMENSIONS;
    const skillRows = await this.db
      .select({ slug: skill.slug, category: skill.categorySlug })
      .from(skill);
    const categoryBySkill = new Map(skillRows.map(row => [row.slug, row.category]));
    const dimIndexByCategory = new Map<string, number>();
    dimensions.forEach((dim, index) => {
      for (const category of dim.categories) dimIndexByCategory.set(category, index);
    });

    // 我的水平：有效等级（认证 / 职称覆盖 / 职称基线）在维度内取最高。
    const effective = await this.judging.effectiveLevelsForCurrentEmployee();
    const myByDim = dimensions.map(() => 0);
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

    const skillsByDim = dimensions.map(dim =>
      new Set(skillRows.filter(row => dim.categories.includes(row.category ?? '')).map(row => row.slug)),
    );
    const axes: AbilityAxis[] = dimensions.map((dim, index) => {
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

  /** 技能 → 所属能力类目名（如 系统设计 / 组织管理），用于 Gap 条目描述。 */
  private async loadSkillCategories(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ name: skill.name, category: skillCategory.name,kind:skillCategory.kind })
      .from(skill)
      .leftJoin(skillCategory, eq(skillCategory.slug, skill.categorySlug));
    return new Map(rows.map(row => [row.name, `${row.kind==='generic'?'通用技能':'专业技能'}${row.category?` / ${row.category}`:''}`]));
  }
}
