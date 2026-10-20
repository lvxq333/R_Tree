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
  ReadinessState,
} from '@shared/api.interface';

/** 驳回后 15 天内不得对同一目标再提交 */
export const REJECT_COOLDOWN_DAYS = 15;
/** 用户忽略候选后，7 天内不再推送同一目标 */
export const DISMISS_COOLDOWN_DAYS = 7;
/** 计入「进行中」的申请状态；approved/rejected/closed 不再阻断 */
export const ACTIVE_APPLICATION_STATUSES = ['draft', 'ai-evaluating', 'pending-exam', 'in-exam', 'pending-approval'];
/** 差 1 项即视为「接近可申请」，作为证据类候选推送 */
export const PREPARING_GAP_THRESHOLD = 1;

type LevelRow = {
  id: string; track_slug: string; track_name: string; level_order: number; level_code: string; level_name: string;
};
type RequirementRow = { title_level_id: string; skill_slug: string; required_level: number; skill_name: string | null };
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
  competencyBySkill: Map<string, string[]>;
  ownedTitles: TitleRow[];
  ownedMaxOrder: number;
  applications: ApplicationRow[];
  openAppealApplications: Set<string>;
  cooldowns: Map<string, Date>;
};

const daysLater = (from: Date | string, days: number) => new Date(new Date(from).getTime() + days * 86_400_000);
const iso = (value: Date | string) => new Date(value).toISOString();

@Injectable()
export class JudgingService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getOverview(): Promise<JudgingOverview> {
    const user = currentEmployee();
    const ctx = await this.load(user.employeeSlug);
    const tracks = new Map<string, { slug: string; name: string; levels: JudgingLevelView[] }>();
    for (const level of ctx.levels) {
      const view = this.buildLevel(level, ctx);
      const entry = tracks.get(level.track_slug) ?? { slug: level.track_slug, name: level.track_name, levels: [] };
      entry.levels.push(view);
      tracks.set(level.track_slug, entry);
    }
    return {
      employeeSlug: user.employeeSlug,
      currentTitle: this.currentTitle(ctx),
      preferredTrack: this.preferredTrack(user.org, user.position),
      tracks: [...tracks.values()],
    };
  }

  /** 单个目标的完整 Gap：在层级视图上补子能力名与可提交材料方向 */
  async getGap(trackSlug: string, levelCode: string): Promise<JudgingGapDetail> {
    const employeeSlug = currentEmployee().employeeSlug;
    const ctx = await this.load(employeeSlug);
    const level = ctx.levels.find(row =>
      row.track_slug === trackSlug && row.level_code.toLowerCase() === levelCode.toLowerCase());
    if (!level) throw new NotFoundException(`职称层级不存在：${trackSlug} / ${levelCode}`);

    const view = this.buildLevel(level, ctx);
    const resources = await this.loadResources();
    const competencyNames = await this.loadCompetencyNames();

    const gapItems = view.requirements
      .filter(item => !item.met)
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
    const ctx = await this.load(user.employeeSlug);
    const preferred = this.preferredTrack(user.org, user.position);
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

      const signature = view.requirements.map(item => `${item.skillSlug}:${item.requiredLevel}`).sort().join('|');
      const existing = bySignature.get(signature);
      if (!existing || (level.track_slug === preferred && existing.trackSlug !== preferred)) {
        bySignature.set(signature, candidate);
      }
    }
    return { items: [...bySignature.values()] };
  }

  /** 忽略某个候选：写 7 天冷却，期间不再推送同一目标 */
  async dismiss(key: string): Promise<{ key: string; cooldownUntil: string }> {
    if (!/^title:[a-z0-9-]+:t[1-6]$/i.test(key)) throw new Error('候选标识格式无效');
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
          SELECT tl.id, tl.track_slug, tt.name AS track_name, tl.level_order, tl.level_code, tl.name AS level_name
          FROM mvp_title_level tl JOIN mvp_title_track tt ON tt.slug = tl.track_slug
          ORDER BY tt.slug, tl.level_order`),
        this.db.execute<RequirementRow>(sql`
          SELECT r.title_level_id, r.skill_slug, r.required_level, s.name AS skill_name
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

    return {
      levels,
      requirements,
      requirementsByLevel,
      skillLevels: new Map(skillLevels.map(row => [row.skill_slug, row.level])),
      competencyBySkill,
      ownedTitles,
      ownedMaxOrder: ownedTitles.reduce((max, row) => Math.max(max, row.level_order), 0),
      applications,
      openAppealApplications: new Set(appealRows.map(row => row.application_slug)),
      cooldowns,
    };
  }

  private currentTitle(ctx: JudgingContext) {
    if (ctx.ownedTitles.length === 0) return null;
    const top = [...ctx.ownedTitles].sort((a, b) => b.level_order - a.level_order)[0];
    return { trackSlug: top.track_slug, levelOrder: top.level_order, levelCode: top.level_code, levelName: top.level_name };
  }

  /** 当前员工的偏好序列（供概览等模块复用同一口径）。 */
  preferredTrackForCurrentEmployee(): string | null {
    const user = currentEmployee();
    return this.preferredTrack(user.org, user.position);
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
      const currentLevel = ctx.skillLevels.get(row.skill_slug) ?? 0;
      return {
        skillSlug: row.skill_slug,
        skillName: row.skill_name ?? row.skill_slug,
        requiredLevel: row.required_level,
        currentLevel,
        gapLevels: Math.max(0, row.required_level - currentLevel),
        met: currentLevel >= row.required_level,
        competencySlugs: ctx.competencyBySkill.get(row.skill_slug) ?? [],
      };
    });
    const met = requirements.filter(item => item.met).length;
    const total = requirements.length;
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
