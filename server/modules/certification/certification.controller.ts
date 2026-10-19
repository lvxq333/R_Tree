import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import type {
  CertificationItem,
  SelfApplicationInput,
} from '@shared/api.interface';
import {
  CertificationService,
  type CertificationDecisionInput,
  type CertificationMutationResult,
} from './certification.service';

@Controller('api/certifications')
export class CertificationController {
  constructor(private readonly certificationService: CertificationService) {}

  @Get()
  async listCertifications(): Promise<CertificationItem[]> {
    return this.certificationService.listCertifications();
  }

  @Get(':slug')
  async getCertification(@Param('slug') slug: string): Promise<CertificationItem> {
    return this.certificationService.getCertification(slug);
  }

  @NeedLogin()
  @Post('self-application')
  async submitSelfApplication(
    @Body() input: SelfApplicationInput,
  ): Promise<CertificationMutationResult> {
    return this.certificationService.submitSelfApplication(input);
  }

  @NeedLogin()
  @Post(':slug/decision')
  async decideCertification(
    @Param('slug') slug: string,
    @Body() input: CertificationDecisionInput,
  ): Promise<CertificationMutationResult> {
    return this.certificationService.decideCertification(slug, input);
  }
}
