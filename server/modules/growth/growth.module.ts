import { Module } from '@nestjs/common';
import { GrowthController } from './growth.controller';
import { CareerController } from './career.controller';
import { GapController } from './gap.controller';
import { GrowthService } from './growth.service';
import { JudgingModule } from '../judging/judging.module';

@Module({
  imports: [JudgingModule],
  controllers: [GrowthController, CareerController, GapController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
