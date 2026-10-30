import { SkillStandardsService } from '../skill-standards/skill-standards';
import { currentEmployee } from '../auth/employee-context';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq, sql } from 'drizzle-orm';
import dayjs from 'dayjs';
import { approval, employeeSkill, skill, skillCategory } from '@server/database/schema';
import { employee } from '@server/database/schema';
import { mvpEmployeeSkill } from '@server/database/mvp-schema';
import type {
  ApprovalItem,
  ApprovalReminderState,
  CertificationDecision,
  CertificationEvidence,
  CertificationItem,
  SelfApplicationInput,
} from '@shared/api.interface';

/** 审批处理期限 SLA：提交后 7 个自然日内完成审核 */
export const APPROVAL_SLA_DAYS = 7;

/** 审批单处理期限（提交时间 + SLA），前后端一切「是否过期」判断都以它为准 */
export function approvalDueAt(createdAt: Date | string): dayjs.Dayjs {
  return dayjs(createdAt).add(APPROVAL_SLA_DAYS, 'day');
}

/**
 * 审批单是否已超过处理期限。
 * 处理期限为「提交当日起算的第 7 个自然日」，当天仍可处理，跨日后算超期。
 */
export function isApprovalOverdue(createdAt: Date | string): boolean {
  return approvalDueAt(createdAt).isBefore(dayjs(), 'day');
}

export interface CertificationDecisionInput {
  decision: CertificationDecision;
  comment?: string;
}

export interface CertificationMutationResult {
  certification: CertificationItem | null;
  approval: ApprovalItem | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

/** 兼容 jsonb 中对象 / 三元组两种存法，统一输出契约结构 */
export function normalizeEvidence(raw: unknown): CertificationEvidence[] {
  if (!Array.isArray(raw)) return [];
  const items: CertificationEvidence[] = [];
  for (const entry of raw) {
    if (Array.isArray(entry) && entry.length >= 3) {
      items.push({
        type: toText(entry[0]),
        title: toText(entry[1]),
        detail: toText(entry[2]),
      });
      continue;
    }
    if (isRecord(entry)) {
      items.push({
        type: toText(entry.type),
        title: toText(entry.title),
        detail: toText(entry.detail),
      });
    }
  }
  return items;
}

export function toCertificationItem(
  row: typeof employeeSkill.$inferSelect,
  resolvedSkillSlug?: string | null,
  resolvedCategory?: string | null,
): CertificationItem {
  return {
    id: row.slug,
    skillSlug: row.skillSlug ?? resolvedSkillSlug ?? null,
    source: row.source ?? '',
    sourceShort: row.sourceShort ?? '',
    sourceLabel: row.sourceLabel ?? '',
    title: row.title,
    category: resolvedCategory ?? row.category ?? '',
    currentLevel: row.currentLevel ?? 0,
    targetLevel: row.targetLevel ?? 0,
    confidence: row.confidence ?? 0,
    status: row.status ?? '',
    statusLabel: row.statusLabel ?? '',
    explanation: row.explanation ?? '',
    anchor: row.anchor ?? '',
    evidence: normalizeEvidence(row.evidence),
    deadline: row.deadline ?? '',
    approvedAt: row.approvedAt ?? null,
  };
}

function toApprovalStatus(raw: string | null): ApprovalItem['status'] {
  switch (raw) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'returned':
      return 'returned';
    case 'maintained':
      return 'maintained';
    case 'extended':
      return 'extended';
    default:
      return 'pending';
  }
}

function toApprovalKind(raw: string | null): ApprovalItem['kind'] {
  return raw === 'downgrade' ? 'downgrade' : 'application';
}

/** 提交时间的真实展示：相对时间（刚提交 / 今天 / 昨天）或完整月日 */
function formatSubmittedAt(createdAt: Date): string {
  const submitted = dayjs(createdAt);
  const now = dayjs();
  if (now.diff(submitted, 'minute') < 10) return '刚刚';
  if (submitted.isSame(now, 'day')) return `今天 ${submitted.format('HH:mm')}`;
  if (submitted.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${submitted.format('HH:mm')}`;
  return submitted.format('MM-DD HH:mm');
}

export function toApprovalItem(
  row: typeof approval.$inferSelect,
  linked?: { evidence: unknown; anchor: string | null } | null,
  reminder?: ApprovalReminderState,
): ApprovalItem {
  // 时间统一由后端按真实入库时间计算：提交时间 = _created_at，处理期限 = 提交时间 + SLA
  const submitted = dayjs(row.createdAt);
  const due = approvalDueAt(row.createdAt);
  // 队列状态标记同样由后端判定：非 pending 即已处理；待处理且期限早于今天即已过期
  const status = toApprovalStatus(row.status);
  const dueState: ApprovalItem['dueState'] =
    status !== 'pending' ? 'processed'
      : isApprovalOverdue(row.createdAt) ? 'overdue'
        : 'active';
  return {
    id: row.slug,
    linkedId: row.linkedSlug ?? null,
    kind: toApprovalKind(row.kind),
    applicant: row.applicant ?? '',
    avatar: row.avatar ?? '',
    department: row.department ?? '',
    title: row.title,
    currentLevel: row.currentLevel ?? 0,
    targetLevel: row.targetLevel ?? 0,
    sourceLabel: row.sourceLabel ?? '',
    submittedAt: formatSubmittedAt(submitted.toDate()),
    due: due.format('MM-DD'),
    dueState,
    status,
    detail: row.detail ?? null,
    employeeResponse: row.employeeResponse ?? null,
    evidence: normalizeEvidence(linked?.evidence),
    anchor: linked?.anchor ?? null,
    reminder: reminder ?? { count: 0, lastAt: null, canRemind: false, reason: null },
  };
}

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly standards: SkillStandardsService,
  ) {}

  async listCertifications(): Promise<CertificationItem[]> {
    const employeeSlug = currentEmployee().employeeSlug;
    const [rows, catalog, categories, activeSkills, [person]] = await Promise.all([this.db
      .select()
      .from(employeeSkill)
      .where(and(eq(employeeSkill.employeeSlug, employeeSlug),sql`${employeeSkill.status} IS DISTINCT FROM 'withdrawn'`))
      .orderBy(asc(employeeSkill.sort)), this.db.select({slug:skill.slug,name:skill.name,categorySlug:skill.categorySlug}).from(skill),
      this.db.select({slug:skillCategory.slug,name:skillCategory.name,parentSlug:skillCategory.parentSlug}).from(skillCategory),
      this.db.select().from(mvpEmployeeSkill).where(eq(mvpEmployeeSkill.employeeSlug, employeeSlug)),
      this.db.select({hireDate:employee.hireDate}).from(employee).where(eq(employee.slug, employeeSlug)).limit(1)]);
    const byName = new Map(catalog.map(entry => [entry.name, entry.slug]));
    const bySlug = new Map(catalog.map(entry => [entry.slug, entry]));
    const categoryBySlug = new Map(categories.map(entry => [entry.slug, entry]));
    const categoryPath = (skillSlug: string) => {
      const category = categoryBySlug.get(bySlug.get(skillSlug)?.categorySlug ?? '');
      const parent = categoryBySlug.get(category?.parentSlug ?? '');
      return category ? [parent?.name, category.name].filter(Boolean).join(' / ') : '';
    };
    const activeBySkill = new Map<string, typeof mvpEmployeeSkill.$inferSelect>();
    const knownSkills = new Set(activeSkills.map(row => row.skillSlug));
    for (const row of activeSkills) {
      if (row.status !== 'active') continue;
      const certifiedDate = new Date(row.certifiedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
      if (person?.hireDate && certifiedDate < person.hireDate) continue;
      const previous = activeBySkill.get(row.skillSlug);
      if (!previous || row.level > previous.level ||
        (row.level === previous.level && new Date(row.certifiedAt) > new Date(previous.certifiedAt))) {
        activeBySkill.set(row.skillSlug, row);
      }
    }
    const matters = rows.map((row: typeof employeeSkill.$inferSelect) => {
      const resolvedSlug = row.skillSlug ?? byName.get(row.title);
      return toCertificationItem(row, resolvedSlug, resolvedSlug ? categoryPath(resolvedSlug) : null);
    });
    const effectiveMatters = new Set<string>();
    const seenApproved = new Set<string>();
    const visibleMatters = matters.filter(item => {
      if (item.status !== 'approved' || !item.skillSlug) return true;
      if (seenApproved.has(item.skillSlug)) return false;
      const active = activeBySkill.get(item.skillSlug);
      if (!active) {
        if (knownSkills.has(item.skillSlug)) return false;
        seenApproved.add(item.skillSlug);
        return true;
      }
      if (item.targetLevel !== active.level) return false;
      effectiveMatters.add(item.skillSlug);
      seenApproved.add(item.skillSlug);
      return true;
    });
    const historical: CertificationItem[] = [...activeBySkill.values()]
      .filter(row => !effectiveMatters.has(row.skillSlug) && bySlug.has(row.skillSlug))
      .map(row => {
        const certifiedDate = new Date(row.certifiedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
        return {
          id: `history-${row.slug}`,
          skillSlug: row.skillSlug,
          historical: true,
          source: 'history',
          sourceShort: '历',
          sourceLabel: '历史技能认证',
          title: bySlug.get(row.skillSlug)!.name,
          category: categoryPath(row.skillSlug),
          currentLevel: row.level,
          targetLevel: row.level,
          confidence: 0,
          status: 'approved',
          statusLabel: '已点亮',
          explanation: `该技能自 ${certifiedDate} 起正式点亮，当前有效等级为 L${row.level}。`,
          anchor: '',
          evidence: [],
          deadline: '',
          approvedAt: certifiedDate,
        };
      });
    return [...visibleMatters, ...historical];
  }

  async getCertification(slug: string): Promise<CertificationItem> {
    if (slug.startsWith('history-')) {
      const item = (await this.listCertifications()).find(entry => entry.id === slug);
      if (!item) throw new NotFoundException(`认证记录不存在：${slug}`);
      return item;
    }
    const rows = await this.db
      .select()
      .from(employeeSkill)
      .where(and(eq(employeeSkill.slug, slug), eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException(`认证记录不存在：${slug}`);
    const [catalog] = row.skillSlug ? [] : await this.db.select({slug:skill.slug}).from(skill).where(eq(skill.name,row.title)).limit(1);
    return toCertificationItem(row,catalog?.slug);
  }

  /** 员工主动申请：新建认证（审批中）+ 新建关联审批单 */
  async submitSelfApplication(
    input: SelfApplicationInput,
  ): Promise<CertificationMutationResult> {
    if (!input.skillSlug) throw new BadRequestException('请选择技能');
    if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) {
      throw new BadRequestException('level 必须为 L1 至 L5');
    }
    const [chosen] = await this.db.select().from(skill).where(eq(skill.slug, input.skillSlug)).limit(1);
    if (!chosen) throw new BadRequestException('技能不在当前技能库中');
    const standard=(await this.standards.read(chosen.slug)).assessment;
    if(standard.managed&&!standard.configuredLevels?.includes(input.level))throw new BadRequestException('该技能目标等级尚未配置完整的技能说明、达标标准和证明材料要求，请联系管理者补齐后再申请');
    if(input.standardHash&&input.standardHash!==standard.hash)throw new BadRequestException('技能标准已更新，请重新查看标准后提交');
    const applicationAnchor=[`标准版本：${standard.version}`,standard.description?`技能说明：${standard.description}`:'',
      ...standard.abilities.map(a=>`${a.name} · L${input.level} 达标标准：${a.anchors[input.level-1]}${a.evidenceRequirements?.[input.level-1]?`\n证明材料要求：${a.evidenceRequirements[input.level-1]}`:''}`)].filter(Boolean).join('\n\n');
    const [category] = chosen.categorySlug
      ? await this.db.select().from(skillCategory).where(eq(skillCategory.slug, chosen.categorySlug)).limit(1) : [];
    const [parent] = category?.parentSlug
      ? await this.db.select().from(skillCategory).where(eq(skillCategory.slug, category.parentSlug)).limit(1) : [];
    const currentLevel: number = await this.resolveCurrentLevel(chosen.slug);
    if (input.level <= currentLevel) throw new BadRequestException(`该技能当前已达到 L${currentLevel}，请选择更高等级`);
    const [openApplication] = await this.db.execute<{slug:string}>(sql`SELECT slug FROM employee_skill
      WHERE employee_slug=${currentEmployee().employeeSlug} AND
        (skill_slug=${chosen.slug} OR (skill_slug IS NULL AND title=${chosen.name}))
        AND status IN ('pending','ready','returned') LIMIT 1`);
    if (openApplication) throw new BadRequestException('该技能已有待处理申请，请先查看或完成现有事项');
    const slug = `self-${randomUUID()}`;
    const baseExplanation =
      '你已主动提交点亮申请。系统只校验证明是否完整，最终等级由管理者或 HR 依据行为锚点确认。';
    const explanation = input.note ? `${baseExplanation}补充说明：${input.note}` : baseExplanation;
    const evidence: CertificationEvidence[] = [
      {
        type: input.evidenceType ?? '',
        title: input.evidenceTitle ?? '',
        detail: input.evidenceLink ?? '',
      },
    ];
    const sort = await this.nextCertificationSort();
    const inserted = await this.db
      .insert(employeeSkill)
      .values({
        slug,
        employeeSlug: currentEmployee().employeeSlug,
        skillSlug: chosen.slug,
        title: chosen.name,
        category: category ? [parent?.name, category.name].filter(Boolean).join(' / ') : '技能',
        source: 'manual',
        sourceShort: '自证',
        sourceLabel: '员工主动申请',
        currentLevel,
        targetLevel: input.level,
        confidence: 72,
        status: 'pending',
        statusLabel: '审批中',
        explanation,
        anchor: applicationAnchor,
        evidence,
        deadline: '',
        sort,
      })
      .returning();
    const certRow = inserted[0];
    if (!certRow) throw new InternalServerErrorException('认证记录创建失败');
    const approvalItem = await this.createApplicationApproval(certRow);
    this.logger.log(`self-application created: ${JSON.stringify({ slug })}`);
    return { certification: toCertificationItem(certRow), approval: approvalItem };
  }

  /** 认证侧决策：submit / resubmit / dismiss / add-evidence / explain */
  async decideCertification(
    slug: string,
    input: CertificationDecisionInput,
  ): Promise<CertificationMutationResult> {
    const rows = await this.db
      .select()
      .from(employeeSkill)
      .where(and(eq(employeeSkill.slug, slug), eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug)))
      .limit(1);
    const certRow = rows[0];
    if (!certRow) throw new NotFoundException(`认证记录不存在：${slug}`);
    const comment: string = input.comment ?? '';

    if (input.decision === 'dismiss') {
      await this.db
        .delete(approval)
        .where(and(eq(approval.linkedSlug, slug), eq(approval.status, 'pending')));
      const removed = await this.db
        .delete(employeeSkill)
        .where(and(eq(employeeSkill.slug, slug), eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug)))
        .returning({ id: employeeSkill.slug });
      if (removed.length === 0) throw new NotFoundException(`认证记录不存在：${slug}`);
      this.logger.log(`certification dismissed: ${JSON.stringify({ slug })}`);
      return { certification: null, approval: null };
    }

    if (input.decision === 'add-evidence') {
      if (certRow.status !== 'returned') {
        throw new BadRequestException('仅“待补充”状态的认证可以补充材料');
      }
      const evidence: CertificationEvidence[] = [
        ...normalizeEvidence(certRow.evidence),
        { type: '补充', title: comment, detail: '员工补充材料' },
      ];
      const updated = await this.updateCertification(slug, { evidence });
      return { certification: updated, approval: null };
    }

    if (input.decision === 'explain') {
      if (certRow.status !== 'review') {
        throw new BadRequestException('仅“待复核”状态的认证可以提交说明');
      }
      const explanation = certRow.explanation ? `${certRow.explanation}\n${comment}` : comment;
      const updated = await this.updateCertification(slug, { explanation });
      return { certification: updated, approval: null };
    }

    if (input.decision === 'submit' && certRow.status !== 'ready') {
      throw new BadRequestException('仅“待我确认”状态的认证可以发起申请');
    }
    if (input.decision === 'resubmit' && certRow.status !== 'returned') {
      throw new BadRequestException('仅“待补充”状态的认证可以重新提交');
    }

    const patch: Partial<typeof employeeSkill.$inferInsert> = {
      status: 'pending',
      statusLabel: '审批中',
      explanation:
        input.decision === 'resubmit'
          ? '你已根据审核意见补充证明并重新提交，目前等待审批。'
          : '你已核对系统整理的依据并发起申请，目前等待审批。',
    };
    if (input.decision === 'resubmit' && comment) {
      patch.evidence = [
        ...normalizeEvidence(certRow.evidence),
        { type: '补充', title: comment, detail: '员工补充材料' },
      ];
    }
    const updated = await this.updateCertification(slug, patch);
    const approvalItem = await this.createApplicationApproval(certRow);
    this.logger.log(
      `certification decision applied: ${JSON.stringify({ slug, decision: input.decision })}`,
    );
    return { certification: updated, approval: approvalItem };
  }

  /** 取该员工同名技能的当前最高等级，无记录则为 0 */
  private async resolveCurrentLevel(skillSlug: string): Promise<number> {
    const [row] = await this.db.execute<{level:number}>(sql`SELECT GREATEST(
      COALESCE((SELECT max(level) FROM mvp_employee_skill WHERE employee_slug=${currentEmployee().employeeSlug}
        AND skill_slug=${skillSlug} AND status='active'),0),
      COALESCE((SELECT max(current_level) FROM employee_skill WHERE employee_slug=${currentEmployee().employeeSlug}
        AND status='approved' AND (skill_slug=${skillSlug} OR (skill_slug IS NULL AND title=(SELECT name FROM skill WHERE slug=${skillSlug})))),0)
    )::int AS level`);
    return row?.level ?? 0;
  }

  private async nextCertificationSort(): Promise<number> {
    const rows = await this.db
      .select({ sort: employeeSkill.sort })
      .from(employeeSkill)
      .where(eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug));
    return (
      rows.reduce(
        (min: number, row: { sort: number }) => Math.min(min, row.sort),
        0,
      ) - 1
    );
  }

  private async nextApprovalSort(): Promise<number> {
    const rows = await this.db.select({ sort: approval.sort }).from(approval);
    return (
      rows.reduce((min: number, row: { sort: number }) => Math.min(min, row.sort), 0) - 1
    );
  }

  /** 已有待审批单则复用，否则新建（使用登录员工身份） */
  private async createApplicationApproval(
    certRow: typeof employeeSkill.$inferSelect,
  ): Promise<ApprovalItem> {
    const pending = await this.db
      .select()
      .from(approval)
      .where(and(eq(approval.linkedSlug, certRow.slug), eq(approval.status, 'pending')))
      .limit(1);
    if (pending[0]) return toApprovalItem(pending[0]);

    const sort = await this.nextApprovalSort();
    const inserted = await this.db
      .insert(approval)
      .values({
        slug: `approval-${randomUUID()}`,
        linkedSlug: certRow.slug,
        kind: 'application',
        applicant: currentEmployee().name,
        avatar: Array.from(currentEmployee().name)[0],
        department: currentEmployee().org,
        title: certRow.title,
        currentLevel: certRow.currentLevel ?? 0,
        targetLevel: certRow.targetLevel ?? 0,
        sourceLabel: certRow.sourceLabel ?? '',
        submittedAt: null,
        due: null,
        status: 'pending',
        detail: null,
        employeeResponse: null,
        sort,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new InternalServerErrorException('审批单创建失败');
    return toApprovalItem(row, { evidence: certRow.evidence, anchor: certRow.anchor ?? null });
  }

  private async updateCertification(
    slug: string,
    patch: Partial<typeof employeeSkill.$inferInsert>,
  ): Promise<CertificationItem> {
    const updated = await this.db
      .update(employeeSkill)
      .set(patch)
      .where(and(eq(employeeSkill.slug, slug), eq(employeeSkill.employeeSlug, currentEmployee().employeeSlug)))
      .returning();
    const row = updated[0];
    if (!row) throw new NotFoundException(`认证记录不存在：${slug}`);
    return toCertificationItem(row);
  }
}
