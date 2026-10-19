import { Controller, Get, Param } from '@nestjs/common';
import type { EmployeeListItem, EmployeeProfile } from '@shared/api.interface';
import { EmployeeService } from './employee.service';
import { ProfileService } from './profile.service';

@Controller('api/employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly profileService: ProfileService,
  ) {}

  @Get()
  async listEmployees(): Promise<EmployeeListItem[]> {
    return this.employeeService.listEmployees();
  }

  @Get(':slug')
  async getProfile(@Param('slug') slug: string): Promise<EmployeeProfile> {
    return this.profileService.getProfile(slug);
  }
}
