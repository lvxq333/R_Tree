import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { JudgingCandidatesResponse, JudgingGapDetail, JudgingOverview } from '@shared/api.interface';
import { JudgingService } from './judging.service';

@Controller('api/judging')
export class JudgingController {
  constructor(private readonly judging: JudgingService) {}

  /** 三条序列全部层级的判定总览 */
  @Get('overview')
  overview(): Promise<JudgingOverview> {
    return this.judging.getOverview();
  }

  /** 单个目标的 Gap 明细，含子能力与可提交材料方向 */
  @Get('gap')
  gap(@Query('track') track?: string, @Query('level') level?: string): Promise<JudgingGapDetail> {
    if (!track || !level) throw new BadRequestException('需要 track 与 level 参数');
    return this.judging.getGap(track, level);
  }

  /** 两类候选；默认过滤冷却期内的 */
  @Get('candidates')
  candidates(@Query('includeDismissed') includeDismissed?: string): Promise<JudgingCandidatesResponse> {
    return this.judging.getCandidates(includeDismissed === 'true');
  }

  /** 把当前候选落成通知，同 key 未读不重复写 */
  @Post('candidates/sync')
  sync(): Promise<{ created: number; skipped: number }> {
    return this.judging.syncCandidates();
  }

  /** 忽略候选，7 天内不再推送 */
  @Post('candidates/dismiss')
  dismiss(@Body() body: { key?: string }): Promise<{ key: string; cooldownUntil: string }> {
    if (!body?.key) throw new BadRequestException('需要候选标识 key');
    return this.judging.dismiss(body.key);
  }
}
