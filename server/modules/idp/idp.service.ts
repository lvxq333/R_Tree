import { currentEmployee } from '../auth/employee-context';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { idpAction, idpAdjustRule, idpMilestone, idpPhase, idpPlan, skillGap } from '@server/database/schema';
import { GrowthService } from '../growth/growth.service';
import { JudgingService } from '../judging/judging.service';
import { buildIdp, sourceFingerprint, syncMilestones } from './idp-plan';
import type { IdpAction, IdpActionKind, IdpGap, IdpMilestone, IdpPhase, IdpResponse, IdpOptions, IdpGenerateRequest,
  IdpActionUpdate, IdpAlignmentRequest, IdpRevision, IdpLiveReview } from '@shared/api.interface';

const GAP_SOURCES = ['career', 'okr', 'current'];
const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const toActionKind = (value: string | null): IdpActionKind => ['learn','practice','mentor','deliver'].includes(value ?? '') ? value as IdpActionKind : 'learn';
const toMilestoneState = (value: string | null): IdpMilestone['state'] => value === 'done' || value === 'current' ? value : 'next';
function text(value: unknown, name: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new BadRequestException(`${name}不完整或过长`);
  return value.trim();
}
function revision(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new BadRequestException('缺少计划版本，请刷新页面');
  return Number(value);
}
const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

@Injectable()
export class IdpService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly growth: GrowthService, private readonly judging: JudgingService) {}

  async getOptions(): Promise<IdpOptions> {
    const overview = await this.judging.getOverview();
    const track = overview.tracks.find(item => item.slug === overview.preferredTrack) ?? overview.tracks[0];
    const nextOrder = (overview.currentTitle?.levelOrder ?? 0) + 1;
    const target = track?.levels.find(item => item.levelOrder === nextOrder) ?? track?.levels.at(-1);
    const evidence = await this.db.execute(sql`SELECT slug,title FROM mvp_evidence WHERE owner_employee_slug=${currentEmployee().employeeSlug} ORDER BY uploaded_at DESC`);
    return { overview, defaultTarget: target ? { track: target.trackSlug, level: target.levelCode } : null,
      evidence: evidence.map(row => ({ slug: String(row.slug), title: String(row.title) })) };
  }

  async getIdp(): Promise<IdpResponse> {
    const [row] = await this.db.execute(sql`SELECT document FROM idp_plan WHERE employee_slug=${currentEmployee().employeeSlug}`);
    if (row?.document) return row.document as IdpResponse;
    const [plan] = await this.db.select().from(idpPlan).where(eq(idpPlan.employeeSlug, currentEmployee().employeeSlug)).limit(1);
    if (plan) return this.legacyPlan(plan);
    return { positioning: { currentRole: currentEmployee().position, targetRole: '', horizon: '', readiness: 0,
      readinessNote: '选择目标职称后生成个人计划草案', strengths: [], weaknesses: [] }, gaps: [], phases: [], milestones: [], adjustRules: [], reviewCadence: '' };
  }

  private async extras() { return (await this.growth.getGaps()).items.filter(item => item.source === 'okr' || item.source === 'current'); }

  async generate(body: IdpGenerateRequest): Promise<IdpResponse> {
    if (!body || typeof body !== 'object') throw new BadRequestException('缺少生成参数');
    const track = text(body.track, '目标序列', 64), level = text(body.level, '目标职称', 16);
    if (!['software','platform','ai'].includes(track)) throw new BadRequestException('请选择技术序列');
    const startMonth = text(body.startMonth, '开始月份', 7);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(startMonth) || ![12,24,36].includes(body.months)) throw new BadRequestException('开始月份或周期无效');
    const [overview, target, extras, previous] = await Promise.all([this.judging.getOverview(), this.judging.getGap(track,level), this.extras(), this.getIdp()]);
    if (!target.total) throw new BadRequestException('目标暂无能力标准，请先维护职称要求');
    const document = buildIdp({track,level,startMonth,months:body.months},overview,target,extras,currentEmployee().position,previous.phases.length ? previous : undefined);
    const draftId = randomUUID();
    document.meta!.draftId = draftId;
    await this.db.execute(sql`INSERT INTO idp_plan_draft(employee_slug,draft_id,base_revision,document,expires_at)
      VALUES(${currentEmployee().employeeSlug},${draftId}::uuid,${document.meta!.revision},${JSON.stringify(document)}::jsonb,now()+interval '1 day')
      ON CONFLICT(employee_slug) DO UPDATE SET draft_id=EXCLUDED.draft_id,base_revision=EXCLUDED.base_revision,document=EXCLUDED.document,expires_at=EXCLUDED.expires_at`);
    return document;
  }

  async saveDraft(body: {draftId: string}): Promise<IdpResponse> {
    if (!uuid(body?.draftId)) throw new BadRequestException('草案标识无效');
    const user = currentEmployee().employeeSlug;
    const [draft] = await this.db.execute(sql`SELECT document,base_revision FROM idp_plan_draft WHERE employee_slug=${user} AND draft_id=${body.draftId}::uuid AND expires_at>now()`);
    if (!draft) throw new NotFoundException('草案已过期或已更新，请重新生成');
    const document = draft.document as IdpResponse;
    const [target, extras] = await Promise.all([this.judging.getGap(document.meta!.track,document.meta!.level),this.extras()]);
    if (sourceFingerprint(target,extras) !== document.meta!.sourceFingerprint) throw new ConflictException('认证或标准已变化，请重新生成草案');
    return this.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`idp:${user}`}))`);
      const [current] = await tx.execute(sql`SELECT id,revision FROM idp_plan WHERE employee_slug=${user} FOR UPDATE`);
      if (Number(current?.revision ?? 0) !== Number(draft.base_revision)) throw new ConflictException('计划已有新修改，请重新生成草案');
      const [valid] = await tx.execute(sql`SELECT draft_id FROM idp_plan_draft WHERE employee_slug=${user} AND draft_id=${body.draftId}::uuid AND expires_at>now() FOR UPDATE`);
      if (!valid) throw new ConflictException('草案已更新或已保存');
      document.meta!.revision = Number(draft.base_revision) + 1;
      delete document.meta!.draftId;
      document.meta!.updatedAt = new Date().toISOString();
      syncMilestones(document);
      const [saved] = await tx.execute(sql`INSERT INTO idp_plan(employee_slug,current_role_label,target_role_label,horizon,readiness,document,revision)
        VALUES(${user},${document.positioning.currentRole},${document.positioning.targetRole},${document.positioning.horizon},${document.positioning.readiness},${JSON.stringify(document)}::jsonb,${document.meta!.revision})
        ON CONFLICT(employee_slug) DO UPDATE SET current_role_label=EXCLUDED.current_role_label,target_role_label=EXCLUDED.target_role_label,horizon=EXCLUDED.horizon,
          readiness=EXCLUDED.readiness,document=EXCLUDED.document,revision=EXCLUDED.revision RETURNING id`);
      await tx.execute(sql`INSERT INTO idp_plan_revision(plan_id,revision,reason,document) VALUES(${saved.id}::uuid,${document.meta!.revision},${current ? '确认更新计划' : '首次确认计划'},${JSON.stringify(document)}::jsonb)`);
      await tx.execute(sql`DELETE FROM idp_plan_draft WHERE employee_slug=${user} AND draft_id=${body.draftId}::uuid`);
      return document;
    });
  }

  private async mutate(expected: number, reason: string, edit: (plan: IdpResponse, tx: PostgresJsDatabase) => Promise<void>): Promise<IdpResponse> {
    const user = currentEmployee().employeeSlug;
    return this.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`idp:${user}`}))`);
      const [row] = await tx.execute(sql`SELECT id,revision,document FROM idp_plan WHERE employee_slug=${user} FOR UPDATE`);
      if (!row?.document) throw new NotFoundException('请先确认并保存计划');
      if (Number(row.revision) !== expected) throw new ConflictException('计划已在其他页面更新，请刷新后重试');
      const plan = row.document as IdpResponse;
      await edit(plan,tx);
      plan.meta!.revision = expected + 1;
      plan.meta!.updatedAt = new Date().toISOString();
      syncMilestones(plan);
      await tx.execute(sql`UPDATE idp_plan SET document=${JSON.stringify(plan)}::jsonb,revision=${expected+1} WHERE id=${row.id}::uuid`);
      await tx.execute(sql`INSERT INTO idp_plan_revision(plan_id,revision,reason,document) VALUES(${row.id}::uuid,${expected+1},${reason},${JSON.stringify(plan)}::jsonb)`);
      return plan;
    });
  }

  async updateAction(id: string, body: IdpActionUpdate): Promise<IdpResponse> {
    const expected = revision(body?.revision);
    if (!['todo','in-progress','done'].includes(body?.status)) throw new BadRequestException('行动状态无效');
    const note = text(body.resultNote,'成果说明',4000,true);
    if (body.status === 'done' && note.length < 5) throw new BadRequestException('完成行动前请填写至少 5 个字的成果说明');
    if (!Array.isArray(body.evidenceSlugs) || body.evidenceSlugs.length>20 || body.evidenceSlugs.some(value => typeof value !== 'string' || value.length>64)) throw new BadRequestException('证据选择无效');
    const slugs = [...new Set(body.evidenceSlugs)];
    let link: string | null = null;
    if (body.evidenceLink) {
      const value = text(body.evidenceLink,'成果链接',512);
      try { const parsed = new URL(value); if (!['https:','http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); if(parsed.href.length>512) throw new Error(); link = parsed.href; }
      catch { throw new BadRequestException('成果链接需为有效的 HTTP 或 HTTPS 地址'); }
      if (slugs.length >= 20) throw new BadRequestException('每项行动最多关联 20 份证据');
    }
    return this.mutate(expected,'更新行动进度与成果',async (plan,tx) => {
      const action = plan.phases.flatMap(phase => phase.actions).find(item => item.id === id);
      if (!action) throw new NotFoundException('行动不存在');
      if (slugs.length) {
        const rows = await tx.execute(sql`SELECT slug FROM mvp_evidence WHERE owner_employee_slug=${currentEmployee().employeeSlug} AND slug IN (${sql.join(slugs.map(value => sql`${value}`),sql`,`)})`);
        if (rows.length !== slugs.length) throw new BadRequestException('只能关联本人可访问的证据');
      }
      if (body.title !== undefined) { const value = text(body.title,'行动名称',255); if (value !== action.title) action.customTitle = true; action.title = value; }
      if (body.window !== undefined) { const value = text(body.window,'时间安排',128); if (value !== action.window) action.customWindow = true; action.window = value; }
      if (link) {
        const slug = `idp-${randomUUID()}`;
        await tx.execute(sql`INSERT INTO mvp_evidence(slug,owner_employee_slug,kind,title,description,external_url)
          VALUES(${slug},${currentEmployee().employeeSlug},'external-link',${action.title.slice(0,255)},${note},${link})`);
        slugs.push(slug);
      }
      const evidence = slugs.length ? await tx.execute(sql`SELECT slug,title,external_url FROM mvp_evidence
        WHERE owner_employee_slug=${currentEmployee().employeeSlug} AND slug IN (${sql.join(slugs.map(value => sql`${value}`),sql`,`)})`) : [];
      action.evidence = evidence.map(row => ({slug:String(row.slug),title:String(row.title),url:row.external_url ? String(row.external_url) : null}));
      action.status = body.status; action.resultNote = note; action.evidenceSlugs = slugs;
    });
  }

  async align(body: IdpAlignmentRequest): Promise<IdpResponse> {
    const expected = revision(body?.revision), participant = text(body.participant,'对齐人',100), note = text(body.note,'对齐记录',4000), date = text(body.date,'对齐日期',10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new BadRequestException('对齐日期无效');
    return this.mutate(expected,'记录管理者对齐',async plan => {
      plan.alignments = [...(plan.alignments ?? []),{id:randomUUID(),date,participant,note,createdAt:new Date().toISOString()}];
    });
  }

  async history(): Promise<IdpRevision[]> {
    const rows = await this.db.execute(sql`SELECT r.revision,r.reason,r.created_at FROM idp_plan_revision r JOIN idp_plan p ON p.id=r.plan_id
      WHERE p.employee_slug=${currentEmployee().employeeSlug} ORDER BY r.revision DESC LIMIT 100`);
    return rows.map(row => ({revision:Number(row.revision),reason:String(row.reason),createdAt:new Date(String(row.created_at)).toISOString()}));
  }
  async version(value: string): Promise<IdpResponse> {
    if (!/^\d+$/.test(value)) throw new NotFoundException('版本不存在');
    const [row] = await this.db.execute(sql`SELECT r.document FROM idp_plan_revision r JOIN idp_plan p ON p.id=r.plan_id
      WHERE p.employee_slug=${currentEmployee().employeeSlug} AND r.revision=${Number(value)}`);
    if (!row) throw new NotFoundException('版本不存在');
    return row.document as IdpResponse;
  }
  async review(): Promise<IdpLiveReview> {
    const plan = await this.getIdp();
    if (!plan.meta) throw new BadRequestException('请先保存个人计划');
    const [target, extras] = await Promise.all([this.judging.getGap(plan.meta.track,plan.meta.level),this.extras()]);
    return {readiness:target.total ? Math.round(target.met/target.total*100) : 0, met:target.met,total:target.total,
      gaps:target.gapItems.map(item => item.skillName),changed:sourceFingerprint(target,extras)!==plan.meta.sourceFingerprint};
  }

  private async legacyPlan(plan: typeof idpPlan.$inferSelect): Promise<IdpResponse> {
    const [phaseRows, milestoneRows, ruleRows, gapRows] = await Promise.all([
      this.db
        .select()
        .from(idpPhase)
        .where(eq(idpPhase.planId, plan.id))
        .orderBy(asc(idpPhase.sort)),
      this.db
        .select()
        .from(idpMilestone)
        .where(eq(idpMilestone.planId, plan.id))
        .orderBy(asc(idpMilestone.sort)),
      this.db
        .select()
        .from(idpAdjustRule)
        .where(eq(idpAdjustRule.planId, plan.id))
        .orderBy(asc(idpAdjustRule.sort)),
      this.db
        .select()
        .from(skillGap)
        .where(
          and(
            eq(skillGap.employeeSlug, currentEmployee().employeeSlug),
            inArray(skillGap.source, GAP_SOURCES),
          ),
        )
        .orderBy(asc(skillGap.sort)),
    ]);

    const phaseIds: string[] = phaseRows.map((row) => row.id);
    const actionRows =
      phaseIds.length > 0
        ? await this.db
            .select()
            .from(idpAction)
            .where(inArray(idpAction.phaseId, phaseIds))
            .orderBy(asc(idpAction.sort))
        : [];

    const actionsByPhase = new Map<string, IdpAction[]>();
    for (const action of actionRows) {
      const list = actionsByPhase.get(action.phaseId) ?? [];
      list.push({
        kind: toActionKind(action.kind),
        kindLabel: action.kindLabel ?? '',
        title: action.title ?? '',
        gap: action.gap ?? '',
        window: action.windowLabel ?? '',
        proof: action.proof ?? '',
      });
      actionsByPhase.set(action.phaseId, list);
    }

    const phases: IdpPhase[] = phaseRows.map((row) => ({
      range: row.rangeLabel ?? '',
      title: row.title ?? '',
      theme: row.theme ?? '',
      focusGaps: toStringArray(row.focusGaps),
      objective: row.objective ?? '',
      actions: actionsByPhase.get(row.id) ?? [],
      milestone: row.milestone ?? '',
      outcome: row.outcome ?? '',
    }));

    const milestones: IdpMilestone[] = milestoneRows.map((row) => ({
      time: row.timeLabel ?? '',
      title: row.title ?? '',
      detail: row.detail ?? '',
      state: toMilestoneState(row.state),
    }));

    const adjustRules = ruleRows.map((row) => ({
      trigger: row.triggerLabel ?? '',
      action: row.action ?? '',
    }));

    const gaps: IdpGap[] = gapRows.map((row) => ({
      title: row.title,
      priority: (row.priority ?? '').toUpperCase(),
      note: row.levelRange ?? row.description ?? '',
    }));

    return {
      positioning: {
        currentRole: plan.currentRoleLabel ?? '',
        targetRole: plan.targetRoleLabel ?? '',
        horizon: plan.horizon ?? '',
        readiness: plan.readiness ?? 0,
        readinessNote: plan.readinessNote ?? '',
        strengths: toStringArray(plan.strengths),
        weaknesses: toStringArray(plan.weaknesses),
      },
      gaps,
      phases,
      milestones,
      adjustRules,
      reviewCadence: plan.reviewCadence ?? '',
    };  }
}
