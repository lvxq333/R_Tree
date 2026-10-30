import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { DeepSeekService } from '../facts/deepseek.service';

@Module({
  controllers: [TalentController],
  providers: [TalentService, DeepSeekService],
})
export class TalentModule {}
