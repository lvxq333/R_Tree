import { currentEmployee } from '../auth/employee-context';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type {
  JudgingBlocker,
  JudgingCandidate,
  JudgingCandidatesResponse,
  JudgingGapDetail,
  JudgingLevelView,
  JudgingOverview,
  JudgingRequirement,
  JudgingResource,
  JudgingTrackView,
  ReadinessState,
  TitlePipeline,
} from '@shared/api.interface';

/** 驳回后 15 天内不得对同一目标再提交 */
export const REJECT_COOLDOWN_DAYS = 15;
/** 用户忽略候选后，7 天内不再推送同一目标 */
export const DISMISS_COOLDOWN_DAYS = 7;
/** 计入「进行中」的申请状态；approved/rejected/closed 不再阻断 */
export const ACTIVE_APPLICATION_STATUSES = ['draft', 'ai-evaluating', 'pending-exam', 'in-exam', 'pending-approval'];
/** 差 1 项即视为「接近可申请」，作为证据类候选推送 */
export const PREPARING_GAP_THRESHOLD = 1;
/** 技术序列：职称在这些序列之间平级互认 */
export const TECH_TRACKS: string[] = ['software', 'platform', 'ai'];

/** 序列所属发展管道：以 mvp_title_track.pipeline 为准，缺省时按技术序列兜底 */
export const pipelineOf = (row: { track_slug: string; pipeline?: string | null }): TitlePipeline =>
  row.pipeline === 'management' || row.pipeline === 'tech'
    ? row.pipeline
    : TECH_TRACKS.includes(row.track_slug) ? 'tech' : 'management';

type LevelRow = {
  id: string; track_slug: string; track_name: string; pipeline: string | null;
  level_order: number; level_code: string; level_name: string;
};
type RequirementRow = { title_level_id: string; skill_slug: string; required_level: number; is_required: boolean; skill_name: string | null };
type TitleRow = { track_slug: string; level_order: number; level_code: string; level_name: string };
type ApplicationRow = {
  slug: string; target_title_level_id: string | null; status: string; rejected_at: Date | string | null;
};
type CooldownRow = { dismissed_key: string; cooldown_until: Date | string };
type SkillLevelRow = { skill_slug: string; level: number };
type CompetencyRow = { skill_slug: string; competency_slug: string };
type ResourceRow = {
  slug: string; kind: string; title: string; url: string | null;
  estimated_effort: string | null; evidence_template: string | null; targets_competency_slugs: unknown;
};

type JudgingContext = {
  levels: LevelRow[];
  requirements: RequirementRow[];
  requirementsByLevel: Map<string, RequirementRow[]>;
  skillLevels: Map<string, number>;
  /** 有效等级 = max(认证, 职称覆盖, 职称基线)，供判定与概览共用同一口径 */
  effective: EffectiveLevels;
  competencyBySkill: Map<string, string[]>;
  ownedTitles: TitleRow[];
  ownedMaxOrder: number;
  applications: ApplicationRow[];
  openAppealApplications: Set<string>;
  cooldowns: Map<string, Date>;
};

/** 有效等级视图：levels 全量；covered 职称覆盖的技能；baseline 职称基线技能 */
export type EffectiveLevels = {
  levels: Map<string, number>;
  covered: Set<string>;
  baseline: Set<string>;
};

const daysLater = (from: Date | string, days: number) => new Date(new Date(from).getTime() + days * 86_400_000);
const iso = (value: Date | string) => new Date(value).toISOString();

@Injectable()
export class JudgingService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getOverview(): Promise<JudgingOverview> {
    const user = currentEmployee();
    const ctx = await this.load(user.employeeSlug);
    const tracks = new Map<string, JudgingTrackView>();
    for (const level of ctx.levels) {
      const view = this.buildLevel(level, ctx);
      const entry = tracks.get(level.track_slug)
        ?? { slug: level.track_slug, name: level.track_name, pipeline: pipelineOf(level), levels: [] };
      entry.levels.push(view);
      tracks.set(level.track_slug, entry);
    }
    return {
      employeeSlug: user.employeeSlug,
      currentTitle: this.currentTitle(ctx),
      preferredTrack: await this.preferredTrackForEmployee(),
      tracks: [...tracks.values()],
    };
  }

  /** 单个目标的完整 Gap：在层级视图上补子能力名与可提交材料方向 */
  async getGap(trackSlug: string, levelCode: string): Promise<JudgingGapDetail> {
    const employeeSlug = currentEmployee().employeeSlug;
    const ctx = await this.load(employeeSlug);
    const level = ctx.levels.find(row =>
      row.track_slug === trackSlug && (row.level_code.toLowerCase() === levelCode.toLowerCase() || (/^T[1-4]$/i.test(levelCode)&&row.level_order===Number(levelCode.slice(1)))));
    if (!level) throw new NotFoundException(`职称层级不存在：${trackSlug} / ${levelCode}`);

    const view = this.buildLevel(level, ctx);
    const resources = await this.loadResources();
    const competencyNames = await this.loadCompetencyNames();

    const gapItems = view.requirements
      .filter(item => item.isRequired !== false && !item.met)
      .map(item => ({
        ...item,
        competencyNames: item.competencySlugs.map(slug => competencyNames.get(slug) ?? slug),
        resources: this.matchResources(item.competencySlugs, resources),
      }));

    return { ...view, gapItems };
  }

  /** 两类候选：已达标可申请、差一项即可申请。已忽略且在冷却期的不返回 */
  async getCandidates(includeDismissed = false): Promise<JudgingCandidatesResponse> {
    const user = currentEmployee();
    if (user.personnelRole === 'hr') return { items: [] }; // HR 不进入技术职称候选流程。
    const ctx = await this.load(user.employeeSlug);
    const preferred = await this.preferredTrackForEmployee();
    // 三条序列的 T1 要求完全相同（都是通用四项），不去重会同时推三条同名候选。
    // 按「技能:等级」签名合并，优先保留员工所属序列的那一条。
    const bySignature = new Map<string, JudgingCandidate>();
    for (const level of ctx.levels) {
      const view = this.buildLevel(level, ctx);
      const key = `title:${level.track_slug}:${level.level_code}`;
      const isDismissed = ctx.cooldowns.has(key);
      if (isDismissed && !includeDismissed) continue;

      const base = {
        key,
        trackSlug: level.track_slug,
        levelCode: level.level_code,
        met: view.met,
        total: view.total,
        dismissed: isDismissed,
      };
      let candidate: JudgingCandidate | null = null;
      if (view.state === 'ready') {
        candidate = { ...base, kind: 'candidate-application', title: `可以申请${level.level_name}`,
          description: `${view.total} 项要求已全部达标，可直接提交申请` };
      } else if (view.state === 'preparing' && view.total - view.met === PREPARING_GAP_THRESHOLD && view.met > 0) {
        candidate = { ...base, kind: 'candidate-evidence', title: `只差 1 项就能申请${level.level_name}`,
          description: `已达标 ${view.met}/${view.total} 项，补齐剩余一项即可提交` };
      }
      if (!candidate) continue;

      const signature = view.requirements.filter(item=>item.isRequired!==false).map(item => `${item.skillSlug}:${item.requiredLevel}`).sort().join('|');
      const existing = bySignature.get(signature);
      if (!existing || (level.track_slug === preferred && existing.trackSlug !== preferred)) {
        bySignature.set(signature, candidate);
      }
    }
    return { items: [...bySignature.values()] };
  }

  /** 忽略某个候选：写 7 天冷却，期间不再推送同一目标 */
  async dismiss(key: string): Promise<{ key: string; cooldownUntil: string }> {
    if (!/^title:[a-z0-9-]+:[tpmf][1-4]$/i.test(key)) throw new Error('候选标识格式无效');
    const employeeSlug = currentEmployee().employeeSlug;
    const cooldownUntil = new Date(Date.now() + DISMISS_COOLDOWN_DAYS * 86_400_000).toISOString();
    await this.db.execute(sql`
      INSERT INTO mvp_notification_cooldown(employee_slug, dismissed_key, dismissed_at, cooldown_until)
      VALUES(${employeeSlug}, ${key}, now(), ${cooldownUntil})
      ON CONFLICT(employee_slug, dismissed_key)
      DO UPDATE SET dismissed_at=now(), cooldown_until=EXCLUDED.cooldown_until, updated_at=now()`);
    return { key, cooldownUntil };
  }

  /** 把当前候选写入通知表；同 key 已有未读通知则不重复写 */
  async syncCandidates(): Promise<{ created: number; skipped: number }> {
    const employeeSlug = currentEmployee().employeeSlug;
    const { items } = await this.getCandidates(false);
    let created = 0;
    for (const item of items) {
      const rows = await this.db.execute<{ id: string }>(sql`
        INSERT INTO mvp_notification(slug, recipient_employee_slug, kind, title, body, link, payload)
        SELECT ${randomUUID()}, ${employeeSlug}, ${item.kind}, ${item.title}, ${item.description},
               ${`/#/judging?track=${item.trackSlug}&level=${item.levelCode}`},
               ${JSON.stringify({ key: item.key, trackSlug: item.trackSlug, levelCode: item.levelCode })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM mvp_notification n
          WHERE n.recipient_employee_slug=${employeeSlug} AND n.kind=${item.kind} AND n.payload->>'key'=${item.key})
        RETURNING id`);
      if (rows.length > 0) created += 1;
    }
    return { created, skipped: items.length - created };
  }

  // ---------- 数据加载与规则 ----------

  private async load(employeeSlug: string): Promise<JudgingContext> {
    const [levels, requirements, skillLevels, ownedTitles, applications, appealRows, cooldownRows, competencyRows] =
      await Promise.all([
        this.db.execute<LevelRow>(sql`
          SELECT tl.id, tl.track_slug, tt.name AS track_name, tt.pipeline, tl.level_order, tl.level_code, tl.name AS level_name
          FROM mvp_title_level tl JOIN mvp_title_track tt ON tt.slug = tl.track_slug
          WHERE tt.status='published' AND tl.standard_version_slug=(
            SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
          ORDER BY tt.slug, tl.level_order`),
        this.db.execute<RequirementRow>(sql`
          SELECT r.title_level_id, r.skill_slug, r.required_level, r.is_required, s.name AS skill_name
          FROM mvp_title_requirement r LEFT JOIN skill s ON s.slug = r.skill_slug`),
        this.db.execute<SkillLevelRow>(sql`
          SELECT skill_slug, max(level)::int AS level FROM mvp_employee_skill
          WHERE employee_slug=${employeeSlug} AND status='active' GROUP BY skill_slug`),
        this.db.execute<TitleRow>(sql`
          SELECT tl.track_slug, tl.level_order, tl.level_code, tl.name AS level_name
          FROM mvp_employee_title et JOIN mvp_title_level tl ON tl.id = et.title_level_id
          WHERE et.employee_slug=${employeeSlug} AND et.status='active'`),
        this.db.execute<ApplicationRow>(sql`
          SELECT slug, target_title_level_id, status, rejected_at FROM mvp_application
          WHERE applicant_slug=${employeeSlug} AND target_kind='title'`),
        this.db.execute<{ application_slug: string }>(sql`
          SELECT a.application_slug FROM mvp_appeal a JOIN mvp_application ap ON ap.slug = a.application_slug
          WHERE ap.applicant_slug=${employeeSlug} AND a.status='pending'`),
        this.db.execute<CooldownRow>(sql`
          SELECT dismissed_key, cooldown_until FROM mvp_notification_cooldown
          WHERE employee_slug=${employeeSlug} AND cooldown_until > now()`),
        this.db.execute<CompetencyRow>(sql`
          SELECT skill_slug, competency_slug FROM mvp_skill_competency ORDER BY skill_slug`),
      ]);

    const requirementsByLevel = new Map<string, RequirementRow[]>();
    for (const row of requirements) {
      const list = requirementsByLevel.get(row.title_level_id) ?? [];
      list.push(row);
      requirementsByLevel.set(row.title_level_id, list);
    }
    const competencyBySkill = new Map<string, string[]>();
    for (const row of competencyRows) {
      const list = competencyBySkill.get(row.skill_slug) ?? [];
      list.push(row.competency_slug);
      competencyBySkill.set(row.skill_slug, list);
    }

    const cooldowns = new Map<string, Date>();
    for (const row of cooldownRows) cooldowns.set(row.dismissed_key, new Date(row.cooldown_until));

    const effective = this.computeEffectiveLevels({
      levels,
      requirementsByLevel,
      skillLevels: new Map(skillLevels.map(row => [row.skill_slug, row.level])),
      ownedTitles,
    });

    return {
      levels,
      requirements,
      requirementsByLevel,
      skillLevels: new Map(skillLevels.map(row => [row.skill_slug, row.level])),
      effective,
      competencyBySkill,
      ownedTitles,
      ownedMaxOrder: ownedTitles.reduce((max, row) => Math.max(max, row.level_order), 0),
      applications,
      openAppealApplications: new Set(appealRows.map(row => row.application_slug)),
      cooldowns,
    };
  }

  /**
   * 职称带来的有效能力：
   * 1. 覆盖：持有层及以下（同序列）要求过的技能，按该层要求等级视为已达（高等级自动覆盖低等级）。
   * 2. 互认：技术序列之间职称平级互认，互认序列的同层要求同样视为已满足。
   * 3. 基线：紧邻下一层新出现的技能（此前层从未要求、也无认证），按「入门理解 L1」计——
   *    达到 Tn 的员工对下一层技能通常已有初步接触，显示 L0 不符合真实场景。
   * 基线不改变 met（要求等级 ≥ 2），只让 Gap 展示与行动建议更贴近真实。
   */
  private computeEffectiveLevels(input: {
    levels: LevelRow[];
    requirementsByLevel: Map<string, RequirementRow[]>;
    skillLevels: Map<string, number>;
    ownedTitles: TitleRow[];
  }): EffectiveLevels {
    const levels = new Map(input.skillLevels);
    const covered = new Set<string>();
    const baseline = new Set<string>();

    // 每条序列的有效持有层 = 自身职称与（技术序列）互认层级的最大值。
    const heldByTrack = new Map<string, number>();
    for (const title of input.ownedTitles) {
      const held = heldByTrack.get(title.track_slug) ?? 0;
      if (title.level_order > held) heldByTrack.set(title.track_slug, title.level_order);
    }
    const techMax = Math.max(0, ...TECH_TRACKS.map(track => heldByTrack.get(track) ?? 0));
    if (techMax > 0) {
      for (const track of TECH_TRACKS) {
        const held = heldByTrack.get(track) ?? 0;
        if (techMax > held) heldByTrack.set(track, techMax);
      }
    }

    for (const [trackSlug, heldOrder] of heldByTrack) {
      if (heldOrder <= 0) continue;
      for (const level of input.levels) {
        if (level.track_slug !== trackSlug) continue;
        const reqs = (input.requirementsByLevel.get(level.id) ?? []).filter(r=>r.is_required!==false);
        if (level.level_order <= heldOrder) {
          for (const req of reqs) {
            covered.add(req.skill_slug);
            const current = levels.get(req.skill_slug) ?? 0;
            if (req.required_level > current) levels.set(req.skill_slug, req.required_level);
          }
        } else if (level.level_order === heldOrder + 1) {
          for (const req of reqs) {
            if (covered.has(req.skill_slug)) continue;
            if ((levels.get(req.skill_slug) ?? 0) < 1) {
              levels.set(req.skill_slug, 1);
              baseline.add(req.skill_slug);
            }
          }
        }
      }
    }
    return { levels, covered, baseline };
  }

  /** 当前员工的有效能力等级（含职称覆盖与职称基线），供成长概览等模块复用同一口径。 */
  async effectiveLevelsForCurrentEmployee(): Promise<EffectiveLevels> {
    const ctx = await this.load(currentEmployee().employeeSlug);
    return ctx.effective;
  }

  private currentTitle(ctx: JudgingContext) {
    if (ctx.ownedTitles.length === 0) return null;
    const top = [...ctx.ownedTitles].sort((a, b) => b.level_order - a.level_order)[0];
    return { trackSlug: top.track_slug, levelOrder: top.level_order, levelCode: top.level_code, levelName: top.level_name };
  }

  /** 当前员工的偏好序列（供概览等模块复用同一口径）。 */
  preferredTrackForCurrentEmployee(): string | null {
    const user = currentEmployee();
    if (user.personnelRole === 'hr') return null;
    return this.preferredTrack(user.org, user.position);
  }

  private async preferredTrackForEmployee(): Promise<string | null> {
    const user = currentEmployee();
    if (user.personnelRole === 'hr') return null;
    const [row] = await this.db.execute<{ preferred_track: string | null }>(sql`
      SELECT preferred_track FROM employee WHERE slug=${user.employeeSlug}`);
    return row && TECH_TRACKS.includes(row.preferred_track ?? '')
      ? row.preferred_track : this.preferredTrack(user.org, user.position);
  }

  /**
   * 按部门与岗位推断所属技术序列。
   * 员工表没有序列字段（domain 只在 expert 关系上有值，覆盖不全），
   * 所以用部门/岗位关键字兜底；判断不出时返回 null，候选保持三条序列各推一条。
   */
  private preferredTrack(org: string, position: string): string | null {
    const text = `${org} ${position}`;
    if (/数据|算法|AI|模型|智能/i.test(text)) return 'ai';
    if (/运维|SRE|平台|基础设施|DevOps/i.test(text)) return 'platform';
    if (/Java|Python|前端|测试|研发|开发|架构|技术专家/i.test(text)) return 'software';
    return null;
  }

  /**
   * 判定单层：
   * 1. 已持有同层 → certified（D10 禁同级重申）
   * 2. 已持有更高层 → certified（高等级自动覆盖低等级）
   * 3. 有进行中申请 / 驳回未过 15 天 / 申诉未结 → blocked
   * 4. 4 项全达标 → ready，否则 preparing
   */
  private buildLevel(level: LevelRow, ctx: JudgingContext): JudgingLevelView {
    const requirements: JudgingRequirement[] = (ctx.requirementsByLevel.get(level.id) ?? []).map(row => {
      const currentLevel = ctx.effective.levels.get(row.skill_slug) ?? 0;
      return {
        skillSlug: row.skill_slug,
        skillName: row.skill_name ?? row.skill_slug,
        requiredLevel: row.required_level,
        isRequired: row.is_required,
        currentLevel,
        gapLevels: Math.max(0, row.required_level - currentLevel),
        met: currentLevel >= row.required_level,
        competencySlugs: ctx.competencyBySkill.get(row.skill_slug) ?? [],
        fromTitle: ctx.effective.covered.has(row.skill_slug),
        fromBaseline: ctx.effective.baseline.has(row.skill_slug),
      };
    });
    const mandatory = requirements.filter(item=>item.isRequired!==false);
    const met = mandatory.filter(item => item.met).length;
    const total = mandatory.length;
    const blockers: JudgingBlocker[] = [];

    const sameLevel = ctx.ownedTitles.find(row => row.track_slug === level.track_slug && row.level_order === level.level_order);
    const higher = ctx.ownedTitles
      .filter(row => row.track_slug === level.track_slug && row.level_order > level.level_order)
      .sort((a, b) => b.level_order - a.level_order)[0];

    let state: ReadinessState;
    if (sameLevel) {
      state = 'certified';
      blockers.push({ code: 'already-certified', message: `已持有 ${level.level_code}，同等级不可重复申请` });
    } else if (higher) {
      state = 'certified';
      blockers.push({ code: 'higher-title-held', message: `已持有 ${higher.level_code}，低等级自动被更高职称覆盖` });
    } else {
      const application = ctx.applications.find(row => row.target_title_level_id === level.id);
      if (application && ACTIVE_APPLICATION_STATUSES.includes(application.status)) {
        blockers.push({ code: 'same-target-applying', message: '该目标已有进行中的申请，请先处理当前申请' });
      }
      if (application?.rejected_at) {
        const until = daysLater(application.rejected_at, REJECT_COOLDOWN_DAYS);
        if (until.getTime() > Date.now()) {
          blockers.push({ code: 'rejected-cooldown', message: `该目标刚被驳回，${REJECT_COOLDOWN_DAYS} 天内不可再提交`, until: until.toISOString() });
        }
      }
      if (application && ctx.openAppealApplications.has(application.slug)) {
        blockers.push({ code: 'appeal-open', message: '该目标的申诉还在处理中，暂不可新建申请' });
      }
      if (blockers.length > 0) state = 'blocked';
      else state = total > 0 && met === total ? 'ready' : 'preparing';
    }

    const referenceOrder = sameLevel ? level.level_order : ctx.ownedMaxOrder;
    const isCrossLevel = state !== 'certified'
      && (referenceOrder === 0 ? level.level_order > 1 : level.level_order > referenceOrder + 1);

    return {
      trackSlug: level.track_slug,
      trackName: level.track_name,
      levelOrder: level.level_order,
      levelCode: level.level_code,
      levelName: level.level_name,
      state,
      met,
      total,
      isCrossLevel,
      blockers,
      requirements,
    };
  }

  private async loadResources(): Promise<(JudgingResource & { competencySlugs: string[] })[]> {
    const rows = await this.db.execute<ResourceRow>(sql`
      SELECT slug, kind, title, url, estimated_effort, evidence_template, targets_competency_slugs
      FROM mvp_learning_resource WHERE status='active'`);
    return rows.map(row => ({
      slug: row.slug,
      kind: row.kind,
      title: row.title,
      url: row.url,
      estimatedEffort: row.estimated_effort,
      evidenceTemplate: row.evidence_template,
      competencySlugs: Array.isArray(row.targets_competency_slugs)
        ? (row.targets_competency_slugs as string[])
        : [],
    }));
  }

  private async loadCompetencyNames(): Promise<Map<string, string>> {
    const rows = await this.db.execute<{ slug: string; name: string }>(sql`SELECT slug, name FROM mvp_competency`);
    return new Map(rows.map(row => [row.slug, row.name]));
  }

  private matchResources(
    competencySlugs: string[],
    resources: (JudgingResource & { competencySlugs: string[] })[],
  ): JudgingResource[] {
    if (competencySlugs.length === 0) return [];
    return resources
      .filter(item => item.competencySlugs.some(slug => competencySlugs.includes(slug)))
      .map(({ competencySlugs: _ignored, ...rest }) => rest);
  }
}
