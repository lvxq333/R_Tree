import { Controller, Get, Param } from '@nestjs/common';
import type { EmployeeListItem, EmployeeProfile, EmployeeWorkspaceResponse } from '@shared/api.interface';
import { NeedLogin } from '@server/platform/local-platform';
import { EmployeeWorkspaceService } from './employee-workspace.service';
import { EmployeeService } from './employee.service';
import { ProfileService } from './profile.service';

@Controller('api/employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly profileService: ProfileService,
    private readonly workspaceService: EmployeeWorkspaceService,
  ) {}

  @Get()
  async listEmployees(): Promise<EmployeeListItem[]> {
    return this.employeeService.listEmployees();
  }

  @Get('current/workspace')
  @NeedLogin()
  async getCurrentWorkspace(): Promise<EmployeeWorkspaceResponse> {
    return this.workspaceService.getCurrent();
  }

  @Get(':slug')
  async getProfile(@Param('slug') slug: string): Promise<EmployeeProfile> {
    return this.profileService.getProfile(slug);
  }
}
