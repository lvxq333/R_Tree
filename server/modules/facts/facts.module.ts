import { Module } from '@nestjs/common';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { DeepSeekService } from './deepseek.service';
import { CandidateDiscoveryService } from './candidate-discovery.service';
import { ValidationController } from './validation.controller';

@Module({ controllers: [FactsController,AssessmentController,ValidationController], providers: [FactsService,AssessmentService,DeepSeekService,CandidateDiscoveryService], exports: [FactsService] })
export class FactsModule {}
