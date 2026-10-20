import { Controller, Get } from '@nestjs/common';
import type { GapActionsResponse, GapListResponse } from '@shared/api.interface';
import { GrowthService } from './growth.service';

@Controller('api')
export class GapController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('gaps')
  async getGaps(): Promise<GapListResponse> {
    return this.growthService.getGaps();
  }

  @Get('gaps/actions')
  async getGapActions(): Promise<GapActionsResponse> {
    return this.growthService.getGapActions();
  }
}
