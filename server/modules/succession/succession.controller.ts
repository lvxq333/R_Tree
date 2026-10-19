import { Controller, Get } from '@nestjs/common';
import { SuccessionService } from './succession.service';
import type { SuccessionResponse } from '@shared/api.interface';

@Controller('api/succession')
export class SuccessionController {
  constructor(private readonly successionService: SuccessionService) {}

  @Get()
  async getSuccession(): Promise<SuccessionResponse> {
    return this.successionService.getSuccession();
  }
}
