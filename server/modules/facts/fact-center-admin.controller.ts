import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type { EmployeeWideRow, FactRecord, TeamSkillMapRow } from '@shared/api.interface';
import { FactsService } from './facts.service';
import { currentEmployee } from '../auth/employee-context';

type EditableEmployee = { name?: string; role?: string | null; org?: string | null; department?:string|null;
  jobGrade?:string|null;personnelRole?:string|null;workLocation?:string|null;preferredTrack?:string|null;
  status?: string | null; hireDate?: string | null; summary?: string | null };
type ManualFactInput = { kind?: string; title?: string; occurredAt?: string; detail?: string };
const slugPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function slug(value: string) { if (!slugPattern.test(value)) throw new BadRequestException('无效员工标识'); return value; }
function uuid(value: string) { if (!uuidPattern.test(value)) throw new BadRequestException('无效事实标识'); return value; }
function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new BadRequestException(`${label}格式无效或过长`);
  return value.trim();
}

@Controller('api/fact-center')
export class FactCenterAdminController {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase, private readonly facts: FactsService) {}

  @Get('skill-map')
  async skillMap(): Promise<TeamSkillMapRow[]> {
    const user=currentEmployee();
    const rows=await this.db.execute<{skill_slug:string;name:string;employee_count:number;max_level:number}>(sql`
      SELECT s.skill_slug,COALESCE(k.name,s.skill_slug) AS name,count(DISTINCT s.employee_slug)::int AS employee_count,
        max(s.level)::int AS max_level
      FROM mvp_employee_skill s JOIN employee e ON e.slug=s.employee_slug
      LEFT JOIN skill k ON k.slug=s.skill_slug
      WHERE s.status='active' AND (${user.personnelRole==='hr' ? sql`true` : sql`e.department=${user.department}
        OR EXISTS(SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${user.employeeSlug}
          AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL)`})
      GROUP BY s.skill_slug,k.name ORDER BY employee_count DESC,name LIMIT 20`);
    return rows.map(row=>({skillSlug:row.skill_slug,name:row.name,employeeCount:row.employee_count,maxLevel:row.max_level}));
  }

  @Get('employees')
  async employees(): Promise<EmployeeWideRow[]> {
    await this.facts.refresh();
    const rows = await this.db.execute<{
      employee_id:string;employee_slug:string;name:string;role:string|null;org:string|null;status:string|null;
      department:string|null;job_grade:string|null;personnel_role:string;work_location:string|null;preferred_track:string|null;is_demo:boolean;
      hire_date:string|null;summary:string|null;fact_count:number;project_count:number;performance_count:number;
      evidence_count:number;other_fact_count:number;latest_fact_at:Date|null;fact_titles:string[];refreshed_at:Date;
    }>(sql`SELECT w.* FROM mvp_employee_wide w WHERE ${currentEmployee().personnelRole==='hr' ? sql`true` : sql`
      w.department=${currentEmployee().department} OR EXISTS(
        SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=w.employee_slug
          AND r.target_slug=${currentEmployee().employeeSlug} AND r.relation_type IN ('expert','panel')
          AND r.effective_to IS NULL)`}
      ORDER BY name,employee_slug`);
    return rows.map(row => ({ employeeId:row.employee_id,employeeSlug:row.employee_slug,name:row.name,role:row.role,
      org:row.org,status:row.status,hireDate:row.hire_date,summary:row.summary,
      department:row.department,jobGrade:row.job_grade,personnelRole:row.personnel_role,
      workLocation:row.work_location,preferredTrack:row.preferred_track,isDemo:row.is_demo,factCount:row.fact_count,
      projectCount:row.project_count,performanceCount:row.performance_count,evidenceCount:row.evidence_count,
      otherFactCount:row.other_fact_count,latestFactAt:row.latest_fact_at ? new Date(row.latest_fact_at).toISOString() : null,
      factTitles:row.fact_titles,refreshedAt:new Date(row.refreshed_at).toISOString() }));
  }

  @Get('employees/:slug/facts')
  async employeeFacts(@Param('slug') employeeSlug: string): Promise<FactRecord[]> {
    slug(employeeSlug);
    await this.facts.refresh();
    const rows = await this.db.execute<{id:string;employee_id:string;source_table:string;source_key:string;kind:FactRecord['kind'];title:string;
      occurrence_label:string|null;content:Record<string,unknown>;version:number;status:FactRecord['status'];provenance:FactRecord['provenance'];updated_at:Date}>(sql`
      SELECT f.* FROM mvp_fact f JOIN employee e ON e.id=f.employee_id
      WHERE e.slug=${employeeSlug} AND f.status='active' ORDER BY f.updated_at DESC,f.id LIMIT 200`);
    return rows.map(row => ({ id:row.id,employeeId:row.employee_id,sourceTable:row.source_table,sourceKey:row.source_key,
      kind:row.kind,title:row.title,occurrenceLabel:row.occurrence_label,content:row.content,version:row.version,
      status:row.status,provenance:row.provenance,updatedAt:new Date(row.updated_at).toISOString() }));
  }

  @Patch('employees/:slug')
  async updateEmployee(@Param('slug') employeeSlug: string, @Body() body: EditableEmployee) {
    slug(employeeSlug);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('员工信息格式无效');
    const fields = Object.keys(body);
    const allowed = ['name','role','org','department','jobGrade','personnelRole','workLocation','preferredTrack','status','hireDate','summary'];
    if (!fields.length || fields.some(field => !allowed.includes(field))) throw new BadRequestException('仅支持修改员工基础信息');
    const patch: Record<string,string|null> = {};
    if ('name' in body) {
      const name = optionalText(body.name,64,'姓名');
      if (!name) throw new BadRequestException('姓名不能为空');
      patch.name = name;
    }
    for (const [key,max] of [['role',128],['org',255],['department',255],['workLocation',128],['preferredTrack',64],['status',32],['summary',2000]] as const) {
      if (key in body) patch[key] = optionalText(body[key],max,key);
    }
    if ('jobGrade' in body) {
      const grade=optionalText(body.jobGrade,16,'职级');
      if (grade && !['T1','T2','T3','T4'].includes(grade)) throw new BadRequestException('职级仅支持 T1–T4');
      patch.jobGrade=grade;
    }
    if ('personnelRole' in body) {
      if (!['employee','hr'].includes(body.personnelRole ?? '')) throw new BadRequestException('人员类型无效');
      patch.personnelRole=body.personnelRole!;
    }
    if ('hireDate' in body) {
      const date = optionalText(body.hireDate,16,'入职日期');
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) throw new BadRequestException('入职日期格式为 YYYY-MM-DD');
      patch.hireDate = date;
    }
    const [row] = await this.db.execute<{id:string}>(sql`UPDATE employee SET
      name=COALESCE(${patch.name ?? null},name),
      role=CASE WHEN ${'role' in patch} THEN ${patch.role ?? null} ELSE role END,
      org=CASE WHEN ${'org' in patch} THEN ${patch.org ?? null} ELSE org END,
      department=CASE WHEN ${'department' in patch} THEN ${patch.department ?? null} ELSE department END,
      job_grade=CASE WHEN ${'jobGrade' in patch} THEN ${patch.jobGrade ?? null} ELSE job_grade END,
      personnel_role=CASE WHEN ${'personnelRole' in patch} THEN ${patch.personnelRole ?? null} ELSE personnel_role END,
      work_location=CASE WHEN ${'workLocation' in patch} THEN ${patch.workLocation ?? null} ELSE work_location END,
      preferred_track=CASE WHEN ${'preferredTrack' in patch} THEN ${patch.preferredTrack ?? null} ELSE preferred_track END,
      status=CASE WHEN ${'status' in patch} THEN ${patch.status ?? null} ELSE status END,
      hire_date=CASE WHEN ${'hireDate' in patch} THEN ${patch.hireDate ?? null} ELSE hire_date END,
      summary=CASE WHEN ${'summary' in patch} THEN ${patch.summary ?? null} ELSE summary END,
      _updated_at=clock_timestamp() WHERE slug=${employeeSlug} RETURNING id`);
    if (!row) throw new NotFoundException('员工不存在');
    await this.facts.refresh();
    return { saved:true };
  }

  @Post('employees/:slug/facts')
  async addFact(@Param('slug') employeeSlug: string, @Body() body: ManualFactInput) {
    slug(employeeSlug);
    const input = this.validateFact(body);
    const [row] = await this.db.execute<{id:string}>(sql`
      INSERT INTO mvp_manual_fact_source(employee_id,kind,title,occurred_at,content)
      SELECT id,${input.kind},${input.title},${input.occurredAt}::timestamptz,${JSON.stringify({detail:input.detail})}::jsonb
      FROM employee WHERE slug=${employeeSlug} RETURNING id`);
    if (!row) throw new NotFoundException('员工不存在');
    await this.facts.refresh();
    return { id:row.id };
  }

  @Patch('facts/:id')
  async updateFact(@Param('id') id: string, @Body() body: ManualFactInput) {
    uuid(id);
    const input = this.validateFact(body);
    const [row] = await this.db.execute<{id:string}>(sql`UPDATE mvp_manual_fact_source SET kind=${input.kind},title=${input.title},
      occurred_at=${input.occurredAt}::timestamptz,content=${JSON.stringify({detail:input.detail})}::jsonb,updated_at=clock_timestamp()
      WHERE id=${id}::uuid AND revoked_at IS NULL RETURNING id`);
    if (!row) throw new NotFoundException('人工事实不存在或已撤销');
    await this.facts.refresh();
    return { saved:true };
  }

  @Post('facts/:id/revoke')
  async revokeFact(@Param('id') id: string) {
    uuid(id);
    const [row] = await this.db.execute<{id:string}>(sql`UPDATE mvp_manual_fact_source SET revoked_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=${id}::uuid AND revoked_at IS NULL RETURNING id`);
    if (!row) throw new NotFoundException('人工事实不存在或已撤销');
    await this.facts.refresh();
    return { revoked:true };
  }

  private validateFact(body: ManualFactInput) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('事实格式无效');
    if (!['project','performance','work_artifact'].includes(body.kind ?? '')) throw new BadRequestException('请选择事实类别');
    const title = optionalText(body.title,200,'标题');
    const detail = optionalText(body.detail,4000,'内容');
    if (!title || !detail) throw new BadRequestException('标题和内容不能为空');
    if (typeof body.occurredAt !== 'string' || Number.isNaN(Date.parse(body.occurredAt))) throw new BadRequestException('事实日期无效');
    return { kind:body.kind!,title,detail,occurredAt:new Date(body.occurredAt).toISOString() };
  }
}
