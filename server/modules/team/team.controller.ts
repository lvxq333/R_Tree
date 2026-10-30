import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@server/platform/local-platform';
import { TeamService, type TeamActor } from './team.service';
import type { AuthUser } from '@shared/api.interface';
import type {
  TeamInviteItem,
  TeamResponse,
  TeamRole,
} from '@shared/api.interface';

function actorOf(request: Request): TeamActor {
  const user = (request as Request & { authUser?: AuthUser }).authUser;
  if (!user) throw new Error('unauthorized');
  return {
    employeeSlug: user.employeeSlug,
    name: user.name,
    department: user.department,
    personnelRole: user.personnelRole,
  };
}

@Controller('api/team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @NeedLogin()
  @Get()
  async getTeam(@Req() request: Request): Promise<TeamResponse> {
    const project = typeof (request.query as { project?: string }).project === 'string'
      ? (request.query as { project: string }).project
      : undefined;
    return this.teamService.buildResponse(actorOf(request), project || undefined);
  }

  @NeedLogin()
  @Get('archive')
  async archive(@Req() request: Request) {
    return this.teamService.archive(actorOf(request));
  }

  @NeedLogin()
  @Get('departments')
  async listDepartments(): Promise<{ departments: string[] }> {
    return { departments: await this.teamService.listDepartments() };
  }

  @NeedLogin()
  @Post('projects')
  async createProject(@Req() request: Request, @Body() body: unknown): Promise<TeamResponse> {
    return this.teamService.createProject(actorOf(request), body);
  }

  /** 当前员工的组队邀请及响应状态（员工在首页响应） */
  @NeedLogin()
  @Get('invites')
  async listInvites(@Req() request: Request): Promise<{ invites: TeamInviteItem[] }> {
    return { invites: await this.teamService.listInvites(actorOf(request)) };
  }

  @NeedLogin()
  @Post('invites/respond')
  async respond(@Req() request: Request, @Body() body: unknown): Promise<{ invites: TeamInviteItem[] }> {
    return { invites: await this.teamService.respond(actorOf(request), body) };
  }

  @NeedLogin()
  @Post('mock-responses')
  async mockResponse(@Req() request: Request, @Body() body: unknown): Promise<TeamResponse> {
    return this.teamService.mockResponse(actorOf(request), body);
  }

  @NeedLogin()
  @Get('roles/:roleSlug/candidates')
  async searchCandidates(@Req() request: Request, @Param('roleSlug') roleSlug: string) {
    return this.teamService.searchCandidates(actorOf(request), roleSlug, request.query.q);
  }

  @NeedLogin()
  @Post('roles')
  async createRole(@Req() request: Request, @Body() body: unknown): Promise<TeamRole> {
    return this.teamService.createRole(actorOf(request), body);
  }

  @NeedLogin()
  @Put('roles/:roleSlug')
  async updateRole(
    @Req() request: Request,
    @Param('roleSlug') roleSlug: string,
    @Body() body: unknown,
  ): Promise<TeamRole> {
    return this.teamService.updateRole(actorOf(request), roleSlug, body);
  }

  @NeedLogin()
  @Post('status')
  async changeStatus(@Req() request: Request, @Body() body: unknown): Promise<TeamResponse> {
    return this.teamService.changeStatus(actorOf(request), body);
  }

  @NeedLogin()
  @Put('assignments/:roleSlug')
  async assign(
    @Req() request: Request,
    @Param('roleSlug') roleSlug: string,
    @Body() body: unknown,
  ): Promise<TeamResponse> {
    return this.teamService.assign(actorOf(request), roleSlug, body);
  }

  @NeedLogin()
  @Delete('assignments')
  async clearAssignments(@Req() request: Request): Promise<TeamResponse> {
    const project = typeof (request.query as { project?: string }).project === 'string'
      ? (request.query as { project: string }).project
      : undefined;
    return this.teamService.clearAssignments(actorOf(request), project);
  }

  @NeedLogin()
  @Delete('assignments/:roleSlug')
  async removeAssignment(
    @Req() request: Request,
    @Param('roleSlug') roleSlug: string,
  ): Promise<TeamResponse> {
    const candidate = typeof request.query.candidate === 'string' ? request.query.candidate : undefined;
    return this.teamService.removeAssignment(actorOf(request), roleSlug, candidate);
  }
}
