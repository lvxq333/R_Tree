import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type { ManagerDashboardResponse } from '@shared/api.interface';
import { currentEmployee } from '../auth/employee-context';

type PersonRow = { slug: string; name: string; role: string | null; job_grade: string | null;
  preferred_track: string | null; next_checkin: string | null };
type RequirementRow = { employee_slug: string; skill_slug: string; skill_name: string;
  required_level: number; current_level: number };
type PlanRow = { employee_slug: string; document: unknown };
type ExpiryRow = { employee_slug: string; skill_name: string; review_due_at: Date };
type PlanDocument = { positioning?: { targetRole?: string }; phases?: { actions?: { status?: string }[] }[] };
const GRADES = ['T1', 'T2', 'T3', 'T4'];

@Controller('api/fact-center/manager-overview')
export class ManagerDashboardController {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  @Get()
  async overview(@Query('role') role = '', @Query('grade') grade = ''): Promise<ManagerDashboardResponse> {
    if (role.length > 128 || (grade && !GRADES.includes(grade))) throw new BadRequestException('筛选条件无效');
    const user = currentEmployee();
    const access = user.personnelRole === 'hr' ? sql`true` : sql`(
      e.department=${user.department} OR EXISTS (
        SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${user.employeeSlug}
          AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))`;
    const people = await this.db.execute<PersonRow>(sql`
      SELECT e.slug,e.name,e.role,e.job_grade,e.preferred_track,e.next_checkin
      FROM employee e WHERE ${access} AND e.status='active'
      ORDER BY e.name,e.slug`);
    const filters = { roles: [...new Set(people.map(person => person.role).filter((value): value is string => Boolean(value)))].sort(),
      grades: GRADES };
    const selected = people.filter(person => (!role || person.role === role) && (!grade || person.job_grade === grade));
    if (!selected.length) return { filters,scope:{ employeeCount:0,standardEmployeeCount:0,requirementCount:0,metCount:0,
      p0GapCount:0,planCount:0,completedActionCount:0,actionCount:0 },heat:[],risks:[],members:[],calculatedAt:new Date().toISOString() };
    const slugs = sql.join(selected.map(person => sql`${person.slug}`), sql`, `);
    const [requirements, plans, expiries] = await Promise.all([
      this.db.execute<RequirementRow>(sql`
        SELECT e.slug AS employee_slug,r.skill_slug,COALESCE(k.name,r.skill_slug) AS skill_name,
          r.required_level,COALESCE(cert.level,0)::int AS current_level
        FROM employee e
        JOIN mvp_title_level l ON l.track_slug=e.preferred_track AND l.level_code=e.job_grade
          AND l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
        JOIN mvp_title_requirement r ON r.title_level_id=l.id
        LEFT JOIN skill k ON k.slug=r.skill_slug
        LEFT JOIN LATERAL (SELECT max(s.level)::int AS level FROM mvp_employee_skill s
          WHERE s.employee_slug=e.slug AND s.skill_slug=r.skill_slug AND s.status='active'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now())) cert ON true
        WHERE e.slug IN (${slugs})`),
      this.db.execute<PlanRow>(sql`SELECT employee_slug,document FROM idp_plan WHERE employee_slug IN (${slugs}) AND document IS NOT NULL`),
      this.db.execute<ExpiryRow>(sql`SELECT s.employee_slug,COALESCE(k.name,s.skill_slug) AS skill_name,s.review_due_at
        FROM mvp_employee_skill s LEFT JOIN skill k ON k.slug=s.skill_slug
        WHERE s.employee_slug IN (${slugs}) AND s.status='active' AND s.review_due_at BETWEEN now() AND now()+interval '30 days'
        ORDER BY s.review_due_at LIMIT 20`),
    ]);
    const byPerson = new Map(selected.map(person => [person.slug, [] as RequirementRow[]]));
    const bySkill = new Map<string,{ name:string; grades:Map<string,{demand:number;met:number}> }>();
    const p0BySkill = new Map<string,{name:string;count:number;employeeSlug:string}>();
    for (const requirement of requirements) {
      byPerson.get(requirement.employee_slug)?.push(requirement);
      const person = selected.find(item => item.slug===requirement.employee_slug);
      if (!person?.job_grade) continue;
      const skill = bySkill.get(requirement.skill_slug) ?? {name:requirement.skill_name,grades:new Map()};
      const cell = skill.grades.get(person.job_grade) ?? {demand:0,met:0};
      cell.demand++;if(requirement.current_level>=requirement.required_level)cell.met++;
      skill.grades.set(person.job_grade,cell);bySkill.set(requirement.skill_slug,skill);
      if(requirement.required_level-requirement.current_level>=3) {
        const gap=p0BySkill.get(requirement.skill_slug)??{name:requirement.skill_name,count:0,employeeSlug:requirement.employee_slug};
        gap.count++;p0BySkill.set(requirement.skill_slug,gap);
      }
    }
    const planByPerson = new Map(plans.map(row => [row.employee_slug,row.document as PlanDocument]));
    let completedActionCount=0,actionCount=0;
    const members = selected.map(person => {
      const document=planByPerson.get(person.slug);
      const actions=document?.phases?.flatMap(phase => phase.actions ?? []) ?? [];
      const done=actions.filter(action => action.status==='done').length;
      completedActionCount+=done;actionCount+=actions.length;
      return { employeeSlug:person.slug,name:person.name,role:person.role??'未填写岗位',grade:person.job_grade,
        target:document?.positioning?.targetRole || '尚未制定计划',
        p0Gaps:(byPerson.get(person.slug)??[]).filter(row=>row.required_level-row.current_level>=3).length,
        progress:actions.length ? Math.round(done/actions.length*100) : null,nextCheckin:person.next_checkin };
    });
    const standardEmployeeCount=[...byPerson.values()].filter(rows=>rows.length>0).length;
    const p0GapCount=[...p0BySkill.values()].reduce((sum,row)=>sum+row.count,0);
    const risks:ManagerDashboardResponse['risks']=[...p0BySkill.values()].sort((a,b)=>b.count-a.count).slice(0,2).map(row=>({
      kind:'gap',severity:'high',title:`${row.name}存在较大等级缺口`,detail:`${row.count} 人距岗位要求至少 3 级`,
      employeeSlug:row.employeeSlug }));
    if(expiries.length) risks.push({kind:'expiry',severity:'medium',title:'技能认证即将到复核日',
      detail:`${new Set(expiries.map(row=>row.employee_slug)).size} 人、${expiries.length} 项认证将在 30 天内到期`,
      employeeSlug:expiries[0].employee_slug});
    if(standardEmployeeCount<selected.length) risks.push({kind:'standard',severity:'medium',title:'部分员工缺少适用职级标准',
      detail:`${selected.length-standardEmployeeCount} 人尚无对应发展序列与职级要求，未计入满足率`});
    return {filters,scope:{employeeCount:selected.length,standardEmployeeCount,requirementCount:requirements.length,
      metCount:requirements.filter(row=>row.current_level>=row.required_level).length,p0GapCount,
      planCount:plans.length,completedActionCount,actionCount},
      heat:[...bySkill.entries()].map(([skillSlug,value])=>({skillSlug,name:value.name,
        grades:GRADES.map(valueGrade=>({grade:valueGrade,...(value.grades.get(valueGrade)??{demand:0,met:0})}))}))
        .sort((a,b)=>b.grades.reduce((n,c)=>n+c.demand-c.met,0)-a.grades.reduce((n,c)=>n+c.demand-c.met,0)),
      risks,members,calculatedAt:new Date().toISOString()};
  }
}
