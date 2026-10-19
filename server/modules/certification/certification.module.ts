import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';

@Module({
  controllers: [CertificationController, ApprovalController],
  providers: [CertificationService, ApprovalService],
})
export class CertificationModule {}
