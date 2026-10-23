import { currentEmployee } from '../auth/employee-context';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import dayjs from 'dayjs';
import { approval, employeeSkill, employee } from '@server/database/schema';
import type {
  ApprovalAction,
  ApprovalItem,
  CertificationItem,
  ManagerReviewInput,
} from '@shared/api.interface';
import {
  toApprovalItem,
  toCertificationItem,
  type CertificationMutationResult,
} from './certification.service';

export interface ApprovalDecideInput {
  action: ApprovalAction;
  comment: string;
}

export interface ApprovalDecisionResult {
  approval: ApprovalItem;
  certification: CertificationItem | null;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listApprovals(): Promise<ApprovalItem[]> {
    const user=currentEmployee();
    const ownSkills = this.db.select({ slug: employeeSkill.slug }).from(employeeSkill).where(eq(employeeSkill.employeeSlug, user.employeeSlug));
    const rows = await this.db.select().from(approval)
      .where(user.personnelRole === 'hr' ? undefined : user.personnelRole === 'employee' ? inArray(approval.linkedSlug, ownSkills)
        : inArray(approval.linkedSlug,this.db.select({slug:employeeSkill.slug}).from(employeeSkill)
          .where(inArray(employeeSkill.employeeSlug,this.db.select({slug:employee.slug}).from(employee)
            .where(sql`${employee.org}=${user.department} OR EXISTS(SELECT 1 FROM mvp_org_relation r
              WHERE r.employee_slug=${employee.slug} AND r.target_slug=${user.employeeSlug}
                AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL)`)))))
      .orderBy(asc(approval.sort));
    return rows.map((row: typeof approval.$inferSelect) => toApprovalItem(row));
  }

  /** 管理者发起评审：生成待审批认证 + 关联降级复核审批单 */
  async managerReview(input: ManagerReviewInput): Promise<CertificationMutationResult> {
    if (currentEmployee().personnelRole !== 'hr') throw new ForbiddenException('只有 HR 可以发起管理评审');
    if (!input.personName) throw new BadRequestException('personName 不能为空');
    if (!input.skill) throw new BadRequestException('skill 不能为空');
    if (typeof input.currentLevel !== 'number' || typeof input.targetLevel !== 'number') {
      throw new BadRequestException('currentLevel / targetLevel 必须为数字');
    }
    const people = await this.db.select().from(employee).where(eq(employee.name, input.personName)).limit(2);
    if (people.length !== 1) throw new BadRequestException('员工不存在或姓名不唯一，请核对员工信息');
    const targetEmployee = people[0];
    const detail = `${input.reason}。管理者说明：${input.evidence}`;
    const certSlug = `manager-${randomUUID()}`;
    const certSort = await this.nextSort(
      this.db
        .select({ sort: employeeSkill.sort })
        .from(employeeSkill)
        .where(eq(employeeSkill.employeeSlug, targetEmployee.slug)),
    );
    const certInserted = await this.db
      .insert(employeeSkill)
      .values({
        slug: certSlug,
        employeeSlug: targetEmployee.slug,
        title: input.skill,
        category: '专业技能 / 管理者评审',
        source: 'performance',
        sourceShort: '绩效',
        sourceLabel: '管理者发起评审',
        currentLevel: input.currentLevel,
        targetLevel: input.targetLevel,
        confidence: 75,
        status: 'pending',
        statusLabel: '审批中',
        explanation: detail,
        anchor: '',
        evidence: [{ type: '说明', title: input.reason, detail: input.evidence }],
        deadline: '',
        sort: certSort,
      })
      .returning();
    const certRow = certInserted[0];
    if (!certRow) throw new InternalServerErrorException('认证记录创建失败');

    const approvalSort = await this.nextSort(
      this.db.select({ sort: approval.sort }).from(approval),
    );
    const approvalInserted = await this.db
      .insert(approval)
      .values({
        slug: `manager-review-${Date.now()}`,
        linkedSlug: certSlug,
        kind: 'downgrade',
        applicant: input.personName,
        avatar: input.personName.slice(0, 1),
        department: '管理者发起',
        title: input.skill,
        currentLevel: input.currentLevel,
        targetLevel: input.targetLevel,
        sourceLabel: '管理者发起评审',
        submittedAt: '刚刚',
        due: '09-23',
        status: 'pending',
        detail,
        employeeResponse: '等待员工补充说明',
        sort: approvalSort,
      })
      .returning();
    const approvalRow = approvalInserted[0];
    if (!approvalRow) throw new InternalServerErrorException('审批单创建失败');
    this.logger.log(
      `manager review created: ${JSON.stringify({ certSlug, applicant: input.personName })}`,
    );
    return {
      certification: toCertificationItem(certRow),
      approval: toApprovalItem(approvalRow),
    };
  }

  /** 审批流转：更新审批单并同步联动认证，返回二者最新状态 */
  async decideApproval(
    slug: string,
    input: ApprovalDecideInput,
  ): Promise<ApprovalDecisionResult> {
    const rows = await this.db
      .select()
      .from(approval)
      .where(eq(approval.slug, slug))
      .limit(1);
    const approvalRow = rows[0];
    if (!approvalRow) throw new NotFoundException(`审批单不存在：${slug}`);
    if (approvalRow.status !== 'pending') throw new BadRequestException('该审批单已处理，请刷新列表');
    if (currentEmployee().personnelRole === 'expert') {
      const [target]=await this.db.execute<{allowed:boolean}>(sql`SELECT EXISTS(
        SELECT 1 FROM employee_skill s JOIN employee e ON e.slug=s.employee_slug
        WHERE s.slug=${approvalRow.linkedSlug} AND (e.department=${currentEmployee().department} OR EXISTS(
          SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${currentEmployee().employeeSlug}
            AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))) AS allowed`);
      if (!target?.allowed) throw new ForbiddenException('只能处理本部门或指派复核的审批');
    }
    const action = input.action;
    const comment: string = input.comment ?? '';
    if ((action === 'return' || action === 'reject') && !comment) {
      throw new BadRequestException('退回或驳回申请时，请先填写审批意见');
    }

    let certRow: typeof employeeSkill.$inferSelect | undefined;
    if (approvalRow.linkedSlug) {
      const certRows = await this.db
        .select()
        .from(employeeSkill)
        .where(eq(employeeSkill.slug, approvalRow.linkedSlug))
        .limit(1);
      certRow = certRows[0];
    }

    const approvalPatch: Partial<typeof approval.$inferInsert> = {
      status: this.approvalStatusFor(action),
    };
    if (comment) approvalPatch.detail = comment;

    const certPatch: Partial<typeof employeeSkill.$inferInsert> = {};
    if (certRow) {
      this.applyCertificationPatch(certPatch, certRow, approvalRow, action);
    }

    const resolvedSkill = action === 'approve' && certRow
      ? (await this.db.execute<{slug:string}>(sql`SELECT slug FROM skill WHERE slug=${certRow.skillSlug}
          OR ( ${certRow.skillSlug}::text IS NULL AND name=${certRow.title}) LIMIT 1`))[0]
      : undefined;
    if (action === 'approve' && certRow && !resolvedSkill) throw new BadRequestException('技能不在当前技能库中，不能点亮');

    const { updatedApprovalRow, certification } = await this.db.transaction(async tx => {
      const [updatedApprovalRow] = await tx.update(approval).set(approvalPatch)
        .where(eq(approval.slug, slug)).returning();
      if (!updatedApprovalRow) throw new NotFoundException(`审批单不存在：${slug}`);
      let certification: CertificationItem | null = null;
      if (certRow) {
        const [updated] = await tx.update(employeeSkill).set({ ...certPatch,
          ...(resolvedSkill && !certRow.skillSlug ? { skillSlug: resolvedSkill.slug } : {}) })
          .where(eq(employeeSkill.slug, certRow.slug)).returning();
        if (!updated) throw new NotFoundException(`认证记录不存在：${certRow.slug}`);
        certification = toCertificationItem(updated);
        if (action === 'approve' && resolvedSkill) {
          await tx.execute(sql`INSERT INTO mvp_employee_skill
            (slug,employee_slug,skill_slug,level,certified_at,source_application_slug,status,source)
            VALUES (${`approved-${randomUUID()}`},${certRow.employeeSlug},${resolvedSkill.slug},
              ${updated.currentLevel ?? 0},now(),NULL,'active','application')
            ON CONFLICT (employee_slug,skill_slug,level) DO NOTHING`);
        }
      }
      return { updatedApprovalRow, certification };
    });
    this.logger.log(
      `approval decided: ${JSON.stringify({ slug, action, linked: approvalRow.linkedSlug })}`,
    );
    return { approval: toApprovalItem(updatedApprovalRow), certification };
  }

  private approvalStatusFor(action: ApprovalAction): string {
    switch (action) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'return':
        return 'returned';
      case 'maintain':
        return 'maintained';
      case 'extend':
        return 'extended';
      case 'downgrade':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  private applyCertificationPatch(
    certPatch: Partial<typeof employeeSkill.$inferInsert>,
    certRow: typeof employeeSkill.$inferSelect,
    approvalRow: typeof approval.$inferSelect,
    action: ApprovalAction,
  ): void {
    const today = dayjs().format('YYYY-MM-DD');
    switch (action) {
      case 'approve': {
        const target: number = approvalRow.targetLevel ?? certRow.targetLevel ?? 0;
        certPatch.status = 'approved';
        certPatch.statusLabel = '已点亮';
        certPatch.currentLevel = target;
        certPatch.approvedAt = today;
        certPatch.sourceLabel = approvalRow.sourceLabel
          ? `${approvalRow.sourceLabel} · 已审批生效`
          : '人工审批 · 已审批生效';
        certPatch.explanation = `该技能已通过人工审批并正式点亮，最近一次认证生效于 ${today}。`;
        break;
      }
      case 'reject':
        certPatch.status = 'ready';
        certPatch.statusLabel = '待我确认';
        break;
      case 'return':
        certPatch.status = 'returned';
        certPatch.statusLabel = '待补充';
        break;
      case 'maintain': {
        const current: number = approvalRow.currentLevel ?? certRow.currentLevel ?? 0;
        certPatch.status = 'approved';
        certPatch.statusLabel = '已维持';
        certPatch.targetLevel = current;
        certPatch.confidence = Math.min(100, (certRow.confidence ?? 0) + 10);
        certPatch.explanation = `经人工复核，现有证据仍支持 L${current}，当前等级保持不变。`;
        break;
      }
      case 'extend':
        certPatch.status = 'review';
        certPatch.statusLabel = '观察期延长';
        certPatch.deadline = this.extendQuarter(certRow.deadline);
        certPatch.explanation = '管理者已延长 3 个月观察期，期间当前正式等级保持有效。';
        break;
      case 'downgrade': {
        const target: number = approvalRow.targetLevel ?? certRow.currentLevel ?? 0;
        certPatch.status = 'approved';
        certPatch.currentLevel = target;
        certPatch.statusLabel = '已降级';
        certPatch.explanation = `经人工复核，该技能自 ${today} 起调整为 L${target}。原 L${certRow.currentLevel ?? 0} 记录与本次复核意见均已保留。`;
        break;
      }
      default:
        break;
    }
  }

  private extendQuarter(deadline: string | null): string {
    const base = deadline ? dayjs(deadline) : dayjs();
    const safeBase = base.isValid() ? base : dayjs();
    return safeBase.add(3, 'month').format('YYYY-MM-DD');
  }

  /** 取现有最小 sort 再减一，让新记录排在列表最前 */
  private async nextSort(
    query: Promise<{ sort: number }[]>,
  ): Promise<number> {
    const rows = await query;
    return (
      rows.reduce((min: number, row: { sort: number }) => Math.min(min, row.sort), 0) - 1
    );
  }
}
