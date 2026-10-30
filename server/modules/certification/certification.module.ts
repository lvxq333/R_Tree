import { SkillStandardsModule } from '../skill-standards/skill-standards';
import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';

@Module({
  imports: [SkillStandardsModule],
  controllers: [CertificationController, ApprovalController],
  providers: [CertificationService, ApprovalService],
})
export class CertificationModule {}
