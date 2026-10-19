import { Controller, Get } from '@nestjs/common';
import type { GapListResponse } from '@shared/api.interface';
import { GrowthService } from './growth.service';

@Controller('api')
export class GapController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('gaps')
  async getGaps(): Promise<GapListResponse> {
    return this.growthService.getGaps();
  }
}
