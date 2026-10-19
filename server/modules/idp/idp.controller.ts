import { Controller, Get } from '@nestjs/common';
import { IdpService } from './idp.service';
import type { IdpResponse } from '@shared/api.interface';

@Controller('api/idp')
export class IdpController {
  constructor(private readonly idpService: IdpService) {}

  @Get()
  async getIdp(): Promise<IdpResponse> {
    return this.idpService.getIdp();
  }
}
