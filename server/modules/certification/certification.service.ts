import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { and, asc, eq } from 'drizzle-orm';
import { approval, employeeSkill } from '@server/database/schema';
import type {
  ApprovalItem,
  CertificationDecision,
  CertificationEvidence,
  CertificationItem,
  SelfApplicationInput,
} from '@shared/api.interface';

/** 演示员工（认证列表固定数据归属） */
export const DEMO_EMPLOYEE_SLUG = 'zhang-san';

const APPLICANT_NAME = '张三';
const APPLICANT_AVATAR = '张';
const APPLICANT_DEPARTMENT = '平台研发部 · T1-2';
const APPLICATION_DUE = '09-19';

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
): CertificationItem {
  return {
    id: row.slug,
    source: row.source ?? '',
    sourceShort: row.sourceShort ?? '',
    sourceLabel: row.sourceLabel ?? '',
    title: row.title,
    category: row.category ?? '',
    currentLevel: row.currentLevel ?? 0,
    targetLevel: row.targetLevel ?? 0,
    confidence: row.confidence ?? 0,
    status: row.status ?? '',
    statusLabel: row.statusLabel ?? '',
    explanation: row.explanation ?? '',
    anchor: row.anchor ?? '',
    evidence: normalizeEvidence(row.evidence),
    deadline: row.deadline ?? '',
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

export function toApprovalItem(row: typeof approval.$inferSelect): ApprovalItem {
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
    submittedAt: row.submittedAt ?? '',
    due: row.due ?? '',
    status: toApprovalStatus(row.status),
    detail: row.detail ?? null,
    employeeResponse: row.employeeResponse ?? null,
  };
}

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listCertifications(): Promise<CertificationItem[]> {
    const rows = await this.db
      .select()
      .from(employeeSkill)
      .where(eq(employeeSkill.employeeSlug, DEMO_EMPLOYEE_SLUG))
      .orderBy(asc(employeeSkill.sort));
    return rows.map((row: typeof employeeSkill.$inferSelect) => toCertificationItem(row));
  }

  async getCertification(slug: string): Promise<CertificationItem> {
    const rows = await this.db
      .select()
      .from(employeeSkill)
      .where(eq(employeeSkill.slug, slug))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException(`认证记录不存在：${slug}`);
    return toCertificationItem(row);
  }

  /** 员工主动申请：新建认证（审批中）+ 新建关联审批单 */
  async submitSelfApplication(
    input: SelfApplicationInput,
  ): Promise<CertificationMutationResult> {
    if (!input.skill) throw new BadRequestException('skill 不能为空');
    if (typeof input.level !== 'number' || input.level < 1) {
      throw new BadRequestException('level 必须为正整数');
    }
    const currentLevel: number = await this.resolveCurrentLevel(input.skill);
    const slug = `self-${Date.now()}`;
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
        employeeSlug: DEMO_EMPLOYEE_SLUG,
        title: input.skill,
        category: '专业技能 / 员工选择',
        source: 'manual',
        sourceShort: '自证',
        sourceLabel: '员工主动申请',
        currentLevel,
        targetLevel: input.level,
        confidence: 72,
        status: 'pending',
        statusLabel: '审批中',
        explanation,
        anchor: `达到 L${input.level} 对应的行为锚点，并能在真实工作或考核场景中提供可复核的成果。`,
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
      .where(eq(employeeSkill.slug, slug))
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
        .where(eq(employeeSkill.slug, slug))
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

  /** 取该员工同名技能的当前最高等级，无记录则为 1 */
  private async resolveCurrentLevel(skillTitle: string): Promise<number> {
    const rows = await this.db
      .select({ currentLevel: employeeSkill.currentLevel })
      .from(employeeSkill)
      .where(
        and(
          eq(employeeSkill.employeeSlug, DEMO_EMPLOYEE_SLUG),
          eq(employeeSkill.title, skillTitle),
        ),
      );
    return rows.reduce(
      (max: number, row: { currentLevel: number | null }) =>
        Math.max(max, row.currentLevel ?? 0),
      1,
    );
  }

  private async nextCertificationSort(): Promise<number> {
    const rows = await this.db
      .select({ sort: employeeSkill.sort })
      .from(employeeSkill)
      .where(eq(employeeSkill.employeeSlug, DEMO_EMPLOYEE_SLUG));
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

  /** 已有待审批单则复用，否则新建（applicant 张三） */
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
        slug: `approval-${certRow.slug}-${Date.now()}`,
        linkedSlug: certRow.slug,
        kind: 'application',
        applicant: APPLICANT_NAME,
        avatar: APPLICANT_AVATAR,
        department: APPLICANT_DEPARTMENT,
        title: certRow.title,
        currentLevel: certRow.currentLevel ?? 0,
        targetLevel: certRow.targetLevel ?? 0,
        sourceLabel: certRow.sourceLabel ?? '',
        submittedAt: '刚刚',
        due: APPLICATION_DUE,
        status: 'pending',
        detail: null,
        employeeResponse: null,
        sort,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new InternalServerErrorException('审批单创建失败');
    return toApprovalItem(row);
  }

  private async updateCertification(
    slug: string,
    patch: Partial<typeof employeeSkill.$inferInsert>,
  ): Promise<CertificationItem> {
    const updated = await this.db
      .update(employeeSkill)
      .set(patch)
      .where(eq(employeeSkill.slug, slug))
      .returning();
    const row = updated[0];
    if (!row) throw new NotFoundException(`认证记录不存在：${slug}`);
    return toCertificationItem(row);
  }
}
