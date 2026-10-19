import { Controller, Get } from '@nestjs/common';
import type { CareerResponse } from '@shared/api.interface';
import { GrowthService } from './growth.service';

@Controller('api')
export class CareerController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('career')
  async getCareer(): Promise<CareerResponse> {
    return this.growthService.getCareer();
  }
}
