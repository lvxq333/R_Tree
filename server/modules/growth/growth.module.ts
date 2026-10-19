import { Module } from '@nestjs/common';
import { GrowthController } from './growth.controller';
import { CareerController } from './career.controller';
import { GapController } from './gap.controller';
import { GrowthService } from './growth.service';

@Module({
  controllers: [GrowthController, CareerController, GapController],
  providers: [GrowthService],
})
export class GrowthModule {}
