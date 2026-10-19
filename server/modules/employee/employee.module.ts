import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { SkillTreeController } from './skill-tree.controller';
import { EmployeeService } from './employee.service';
import { ProfileService } from './profile.service';

@Module({
  controllers: [EmployeeController, SkillTreeController],
  providers: [EmployeeService, ProfileService],
})
export class EmployeeModule {}
