import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import type {
  ApprovalItem,
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
