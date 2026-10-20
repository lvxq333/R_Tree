import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { SkillTreeController } from './skill-tree.controller';
import { EmployeeService } from './employee.service';
import { ProfileService } from './profile.service';
import { EmployeeWorkspaceService } from './employee-workspace.service';
import { FactsModule } from '../facts/facts.module';

@Module({
  imports: [FactsModule],
  controllers: [EmployeeController, SkillTreeController],
  providers: [EmployeeService, ProfileService, EmployeeWorkspaceService],
})
export class EmployeeModule {}
