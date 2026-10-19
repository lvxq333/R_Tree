import { Controller, Get, Query } from '@nestjs/common';
import type { GrowthEventsResponse, GrowthRange } from '@shared/api.interface';
import { GrowthService } from './growth.service';

@Controller('api/growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('events')
  async getEvents(@Query('range') range?: string): Promise<GrowthEventsResponse> {
    const normalized: GrowthRange =
      range === '6m' || range === '12m' || range === 'all' ? range : 'all';
    return this.growthService.getEvents(normalized);
  }
}
