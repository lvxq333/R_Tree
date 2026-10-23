import { Controller, Get, Query } from '@nestjs/common';
import type { SkillRelationsResponse, SkillTreeResponse } from '@shared/api.interface';
import { EmployeeService } from './employee.service';

@Controller('api')
export class SkillTreeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('skill-tree')
  async getSkillTree(): Promise<SkillTreeResponse> {
    return this.employeeService.getSkillTree();
  }

  @Get('skill-relations')
  async getSkillRelations(@Query('skillSlugs') skillSlugs = ''): Promise<SkillRelationsResponse> {
    return this.employeeService.getSkillRelations(skillSlugs.split(',').filter(Boolean));
  }
}
