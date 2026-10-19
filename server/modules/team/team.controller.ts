import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import { TeamService } from './team.service';
import type { TeamResponse, TeamRole } from '@shared/api.interface';

@Controller('api/team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  async getTeam(): Promise<TeamResponse> {
    return this.teamService.getTeamResponse();
  }

  @NeedLogin()
  @Post('roles')
  async createRole(@Body() body: unknown): Promise<TeamRole> {
    return this.teamService.createRole(body);
  }

  @NeedLogin()
  @Put('assignments/:roleSlug')
  async assign(
    @Param('roleSlug') roleSlug: string,
    @Body() body: unknown,
  ): Promise<TeamResponse> {
    return this.teamService.assign(roleSlug, body);
  }

  @NeedLogin()
  @Delete('assignments')
  async clearAssignments(): Promise<TeamResponse> {
    return this.teamService.clearAssignments();
  }

  @NeedLogin()
  @Delete('assignments/:roleSlug')
  async removeAssignment(
    @Param('roleSlug') roleSlug: string,
  ): Promise<TeamResponse> {
    return this.teamService.removeAssignment(roleSlug);
  }
}
