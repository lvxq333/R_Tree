import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import type {
  ApprovalItem,
  ApprovalRemindResult,
  ApprovalStats,
  ManagerReviewInput,
} from '@shared/api.interface';
import {
  ApprovalService,
  type ApprovalDecisionResult,
  type ApprovalDecideInput,
} from './approval.service';
import type { CertificationMutationResult } from './certification.service';

@Controller('api/approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  async listApprovals(): Promise<ApprovalItem[]> {
    return this.approvalService.listApprovals();
  }

  /** 员工工作台「我的申请」：本人提交的审批单及其真实催办状态 */
  @Get('mine')
  async listMyApprovals(): Promise<ApprovalItem[]> {
    return this.approvalService.listMyApprovals();
  }

  /** 催办：写入真实催办记录，限流与上限由服务端判定 */
  @NeedLogin()
  @Post(':slug/remind')
  async remindApproval(
    @Param('slug') slug: string,
    @Body() input: { note?: string },
  ): Promise<ApprovalRemindResult> {
    return this.approvalService.remindApproval(slug, input?.note);
  }

  @Get('stats')
  async getStats(): Promise<ApprovalStats> {
    return this.approvalService.getStats();
  }

  @NeedLogin()
  @Post('manager-review')
  async managerReview(
    @Body() input: ManagerReviewInput,
  ): Promise<CertificationMutationResult> {
    return this.approvalService.managerReview(input);
  }

  @NeedLogin()
  @Post(':slug/decide')
  async decideApproval(
    @Param('slug') slug: string,
    @Body() input: ApprovalDecideInput,
  ): Promise<ApprovalDecisionResult> {
    return this.approvalService.decideApproval(slug, input);
  }
}
