import { Module } from '@nestjs/common';
import { IdpController } from './idp.controller';
import { IdpService } from './idp.service';
import { JudgingModule } from '../judging/judging.module';
import { GrowthModule } from '../growth/growth.module';

@Module({
  imports: [JudgingModule, GrowthModule],
  controllers: [IdpController],
  providers: [IdpService],
})
export class IdpModule {}
