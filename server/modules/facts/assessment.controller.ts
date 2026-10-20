import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@server/platform/local-platform';
import type { CreateAssessmentInput } from '@shared/api.interface';
import { AssessmentService } from './assessment.service';

function actor(request:Request):string {
  const id=(request as Request & {authUser?:{employeeId:string}}).authUser?.employeeId;
  if (!id) throw new UnauthorizedException('请先登录');
  return id;
}

@Controller('api/skill-assessments')
@NeedLogin()
export class AssessmentController {
  constructor(private readonly assessments:AssessmentService) {}
  @Get(':slug/workspace') workspace(@Param('slug') slug:string,@Req() request:Request) { return this.assessments.workspace(slug,actor(request)); }
  @Get(':slug/latest') latest(@Param('slug') slug:string,@Req() request:Request) { return this.assessments.latest(slug,actor(request)); }
  @Get(':slug/jobs/:id') get(@Param('slug') slug:string,@Param('id') id:string,@Req() request:Request) { return this.assessments.get(slug,id,actor(request)); }
  @Post(':slug') create(@Param('slug') slug:string,@Body() input:CreateAssessmentInput,@Req() request:Request) { return this.assessments.create(slug,input,actor(request)); }
}
