import { SkillStandardsModule } from '../skill-standards/skill-standards';
import { Module } from '@nestjs/common';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { DeepSeekService } from './deepseek.service';
import { CandidateDiscoveryService } from './candidate-discovery.service';
import { ValidationController } from './validation.controller';
import { FactCenterAdminController } from './fact-center-admin.controller';
import { ManagerDashboardController } from './manager-dashboard.controller';

@Module({ imports:[SkillStandardsModule], controllers: [FactsController,AssessmentController,ValidationController,FactCenterAdminController,ManagerDashboardController], providers: [FactsService,AssessmentService,DeepSeekService,CandidateDiscoveryService], exports: [FactsService] })
export class FactsModule {}
