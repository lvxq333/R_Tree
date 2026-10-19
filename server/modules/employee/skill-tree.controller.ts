import { Controller, Get } from '@nestjs/common';
import type { SkillTreeResponse } from '@shared/api.interface';
import { EmployeeService } from './employee.service';

@Controller('api')
export class SkillTreeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('skill-tree')
  async getSkillTree(): Promise<SkillTreeResponse> {
    return this.employeeService.getSkillTree();
  }
}
