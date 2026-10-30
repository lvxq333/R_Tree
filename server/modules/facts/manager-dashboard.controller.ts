import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type { HeatDetailResponse, ManagerDashboardResponse } from '@shared/api.interface';
import { currentEmployee } from '../auth/employee-context';

type PersonRow = { slug: string; name: string; role: string | null; job_grade: string | null;
  preferred_track: string | null; next_checkin: string | null };
type RequirementRow = { employee_slug: string; skill_slug: string; skill_name: string;
  required_level: number; current_level: number; past_level: number; requirement_grade: string | null };
type PlanRow = { employee_slug: string; document: unknown };
// 热力图行：技能 × 职级档位。threshold 为该职级标准对该技能要求的等级，met/pastMet 为达标人数（不分员工职称）
type HeatRow = { skill_slug: string; skill_name: string; grade: string; threshold: number;
  met: number; past_met: number; gained: number; lost: number };
type ExpiryRow = { employee_slug: string; skill_name: string; review_due_at: Date };
type HeatThresholdRow = { threshold: number | null; skill_name: string };
type HeatPersonRow = { slug: string; name: string; job_grade: string | null; department: string | null;
  role: string | null; level: number; past: number | null; met_at: Date | null };
type PlanDocument = { positioning?: { targetRole?: string }; phases?: { actions?: { status?: string }[] }[] };
const GRADES = ['T','P','M','F'].flatMap(f=>[1,2,3,4].map(n=>`${f}${n}`));
// 下一职级映射：P0 缺口口径与个人 Gap 池对齐，同时统计当前职级与职业下一节点的要求
const NEXT_GRADE: Record<string, string> = Object.fromEntries(['T','P','M','F'].flatMap(f=>[1,2,3].map(n=>[`${f}${n}`,`${f}${n+1}`])));

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
    // 热力图人群：只受岗位筛选影响；职级筛选决定「看哪一档」，不缩小达标人数的人群
    // （这样 T1 员工把技能练到 T2 门槛时，切到 T2 档能看到这笔新增，切到 T1 档则为 0）
    const heatScoped = people.filter(person => !role || person.role === role);
    const heatSlugs = heatScoped.length
      ? sql.join(heatScoped.map(person => sql`${person.slug}`), sql`, `) : sql`NULL`;
    const [requirements, nextRequirements, heatRows, plans, expiries] = await Promise.all([
      this.db.execute<RequirementRow>(sql`
        SELECT e.slug AS employee_slug,r.skill_slug,COALESCE(k.name,r.skill_slug) AS skill_name,
          r.required_level,COALESCE(cert.level,0)::int AS current_level,COALESCE(past.level,0)::int AS past_level,
          e.job_grade AS requirement_grade
        FROM employee e
        JOIN mvp_title_level l ON l.track_slug=e.preferred_track AND l.level_code=e.job_grade
          AND l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
        JOIN mvp_title_requirement r ON r.title_level_id=l.id AND r.is_required=true
        LEFT JOIN skill k ON k.slug=r.skill_slug
        LEFT JOIN LATERAL (SELECT max(s.level)::int AS level FROM mvp_employee_skill s
          WHERE s.employee_slug=e.slug AND s.skill_slug=r.skill_slug AND s.status='active'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now())) cert ON true
        LEFT JOIN LATERAL (SELECT max(s.level)::int AS level FROM mvp_employee_skill s
          WHERE s.employee_slug=e.slug AND s.skill_slug=r.skill_slug AND s.status='active'
            AND s.certified_at<=now()-interval '30 days'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now()-interval '30 days')) past ON true
        WHERE e.slug IN (${slugs})`),
      this.db.execute<RequirementRow>(sql`
        SELECT e.slug AS employee_slug,r.skill_slug,COALESCE(k.name,r.skill_slug) AS skill_name,
          r.required_level,COALESCE(cert.level,0)::int AS current_level,COALESCE(past.level,0)::int AS past_level,
          ng.next_grade AS requirement_grade
        FROM employee e
        JOIN (VALUES ${sql.join(Object.entries(NEXT_GRADE).map(([current, next]) => sql`(${current},${next})`), sql`, `)})
          AS ng(current_grade,next_grade) ON ng.current_grade=e.job_grade
        JOIN mvp_title_level l ON l.track_slug=e.preferred_track AND l.level_code=ng.next_grade
          AND l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
        JOIN mvp_title_requirement r ON r.title_level_id=l.id AND r.is_required=true
        LEFT JOIN skill k ON k.slug=r.skill_slug
        LEFT JOIN LATERAL (SELECT max(s.level)::int AS level FROM mvp_employee_skill s
          WHERE s.employee_slug=e.slug AND s.skill_slug=r.skill_slug AND s.status='active'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now())) cert ON true
        LEFT JOIN LATERAL (SELECT max(s.level)::int AS level FROM mvp_employee_skill s
          WHERE s.employee_slug=e.slug AND s.skill_slug=r.skill_slug AND s.status='active'
            AND s.certified_at<=now()-interval '30 days'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now()-interval '30 days')) past ON true
        WHERE e.slug IN (${slugs})`),
      // 热力图：按「技能等级门槛」统计达标人数，与员工自身职称无关
      // （T2 员工把某技能练到 T3 要求等级，同样计入 T3 列）
      this.db.execute<HeatRow>(sql`
        WITH ver AS (SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1),
        thr AS (
          SELECT r.skill_slug AS skill_slug,COALESCE(k.name,r.skill_slug) AS skill_name,
            l.level_code AS grade,max(r.required_level)::int AS threshold
          FROM mvp_title_level l
          JOIN mvp_title_requirement r ON r.title_level_id=l.id AND r.is_required=true
          LEFT JOIN skill k ON k.slug=r.skill_slug
          WHERE l.standard_version_slug=(SELECT slug FROM ver)
          GROUP BY 1,2,3),
        lv AS (
          SELECT s.employee_slug AS emp,s.skill_slug AS skill,
            max(s.level)::int AS cur,
            max(CASE WHEN s.certified_at<=now()-interval '30 days'
              AND (s.review_due_at IS NULL OR s.review_due_at>=now()-interval '30 days')
              THEN s.level::int END) AS past
          FROM mvp_employee_skill s
          WHERE s.employee_slug IN (${heatSlugs}) AND s.status='active'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now())
          GROUP BY 1,2)
        SELECT t.skill_slug,t.skill_name,t.grade,t.threshold,
          count(*) FILTER (WHERE COALESCE(lv.cur,0)>=t.threshold)::int AS met,
          count(*) FILTER (WHERE COALESCE(lv.past,0)>=t.threshold)::int AS past_met,
          count(*) FILTER (WHERE COALESCE(lv.cur,0)>=t.threshold AND COALESCE(lv.past,0)<t.threshold)::int AS gained,
          count(*) FILTER (WHERE COALESCE(lv.cur,0)<t.threshold AND COALESCE(lv.past,0)>=t.threshold)::int AS lost
        FROM thr t
        CROSS JOIN (SELECT e.slug FROM employee e WHERE e.slug IN (${heatSlugs})) emp
        LEFT JOIN lv ON lv.emp=emp.slug AND lv.skill=t.skill_slug
        GROUP BY 1,2,3,4`),
      this.db.execute<PlanRow>(sql`SELECT employee_slug,document FROM idp_plan WHERE employee_slug IN (${slugs}) AND document IS NOT NULL`),
      this.db.execute<ExpiryRow>(sql`SELECT s.employee_slug,COALESCE(k.name,s.skill_slug) AS skill_name,s.review_due_at
        FROM mvp_employee_skill s LEFT JOIN skill k ON k.slug=s.skill_slug
        WHERE s.employee_slug IN (${slugs}) AND s.status='active' AND s.review_due_at BETWEEN now() AND now()+interval '30 days'
        ORDER BY s.review_due_at LIMIT 20`),
    ]);
    const byPerson = new Map(selected.map(person => [person.slug, [] as RequirementRow[]]));
    // P0 口径 = 当前职级 + 职业下一节点的要求（与个人 Gap 池「职业下一节点」来源一致）
    const p0ByPerson = new Map(selected.map(person => [person.slug, [] as RequirementRow[]]));
    const p0BySkill = new Map<string,{name:string;employees:Set<string>;employeeSlug:string}>();
    // 热力图不在此聚合：它按技能等级门槛统计达标人数，由 heatRows 查询直接给出
    for (const requirement of [...requirements, ...nextRequirements]) {
      byPerson.get(requirement.employee_slug)?.push(requirement);
      p0ByPerson.get(requirement.employee_slug)?.push(requirement);
      if(requirement.required_level-requirement.current_level>=3) {
        const gap=p0BySkill.get(requirement.skill_slug)??{name:requirement.skill_name,employees:new Set<string>(),employeeSlug:requirement.employee_slug};
        gap.employees.add(requirement.employee_slug);p0BySkill.set(requirement.skill_slug,gap);
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
        p0Gaps:(p0ByPerson.get(person.slug)??[]).filter(row=>row.required_level-row.current_level>=3).length,
        progress:actions.length ? Math.round(done/actions.length*100) : null,nextCheckin:person.next_checkin };
    });
    const standardEmployeeCount=[...byPerson.values()].filter(rows=>rows.length>0).length;
    const p0GapCount=[...p0BySkill.values()].reduce((sum,row)=>sum+row.employees.size,0);
    // 风险卡附完整相关员工名单：点击「查看相关员工」展示列表而非直接跳单个画像
    const personBySlug = new Map(selected.map(person => [person.slug, person]));
    const toRiskEmployee = (slug: string, note: string) => {
      const person = personBySlug.get(slug);
      return { slug, name: person?.name ?? slug, grade: person?.job_grade ?? null, role: person?.role ?? null, note };
    };
    const risks:ManagerDashboardResponse['risks']=[...p0BySkill.entries()]
      .map(([skillSlug,row])=>{
        const employees=[...row.employees].map(slug=>{
          const worst=(p0ByPerson.get(slug)??[])
            .filter(item=>item.skill_slug===skillSlug && item.required_level-item.current_level>=3)
            .reduce((max,item)=>Math.max(max,item.required_level-item.current_level),0);
          return toRiskEmployee(slug, worst>3?`最大缺口 ${worst} 级`:'缺口 3 级');
        }).sort((a,b)=>Number(b.note.match(/\d+/)?.[0]??0)-Number(a.note.match(/\d+/)?.[0]??0) || a.name.localeCompare(b.name,'zh-Hans-CN'));
        return { name:row.name, count:row.employees.size, employeeSlug:row.employeeSlug, employees };
      })
      .sort((a,b)=>b.count-a.count).slice(0,2).map(row=>({
      kind:'gap' as const,severity:'high' as const,title:`${row.name}存在较大等级缺口`,detail:`${row.count} 人距当前或下一职级要求至少 3 级`,
      employeeSlug:row.employeeSlug,employees:row.employees }));
    if(expiries.length){
      const dueAt=(row:ExpiryRow)=>{const date=new Date(row.review_due_at);return `${date.getMonth()+1}月${date.getDate()}日`;};
      const dueTime=(row:ExpiryRow)=>new Date(row.review_due_at).getTime();
      const byEmployee=new Map<string,ExpiryRow[]>();
      for(const row of expiries){const list=byEmployee.get(row.employee_slug)??[];list.push(row);byEmployee.set(row.employee_slug,list);}
      risks.push({kind:'expiry',severity:'medium',title:'技能认证即将到复核日',
        detail:`${byEmployee.size} 人、${expiries.length} 项认证将在 30 天内到期`,
        employeeSlug:expiries[0].employee_slug,
        employees:[...byEmployee.entries()].sort((a,b)=>dueTime(a[1][0])-dueTime(b[1][0]))
          .map(([slug,rows])=>toRiskEmployee(slug, rows.length>1?`${rows[0].skill_name} 等 ${rows.length} 项 ${dueAt(rows[0])}到期`:`${rows[0].skill_name} ${dueAt(rows[0])}到期`))});
    }
    if(standardEmployeeCount<selected.length) risks.push({kind:'standard',severity:'medium',title:'部分员工缺少适用职级标准',
      detail:`${selected.length-standardEmployeeCount} 人尚无对应发展序列与职级要求，未计入满足率`,
      employees:selected.filter(person=>!(byPerson.get(person.slug)?.length)).map(person=>toRiskEmployee(person.slug,'未配置适用职级标准'))});
    // 热力图：每个技能 × 职级档位一个单元格；threshold 是该职级标准对该技能要求的等级
    const heatBySkill = new Map<string,{name:string;grades:Map<string,HeatRow>}>();
    for (const row of heatRows) {
      const entry = heatBySkill.get(row.skill_slug) ?? {name:row.skill_name,grades:new Map()};
      entry.grades.set(row.grade,row);heatBySkill.set(row.skill_slug,entry);
    }
    const heat = [...heatBySkill.entries()].map(([skillSlug,value])=>({skillSlug,name:value.name,
      grades:GRADES.map(grade=>{const cell=value.grades.get(grade);
        return {grade,threshold:cell?.threshold??null,met:cell?.met??0,pastMet:cell?.past_met??0,
          gained:cell?.gained??0,lost:cell?.lost??0};})}))
      .sort((a,b)=>{
        const change=(row:typeof a)=>row.grades.reduce((sum,cell)=>sum+Math.abs(cell.met-cell.pastMet),0);
        const supplied=(row:typeof a)=>row.grades.reduce((sum,cell)=>sum+cell.met,0);
        return change(b)-change(a)||supplied(b)-supplied(a)||a.name.localeCompare(b.name,'zh-Hans-CN');
      });
    return {filters,scope:{employeeCount:selected.length,standardEmployeeCount,requirementCount:requirements.length,
      metCount:requirements.filter(row=>row.current_level>=row.required_level).length,p0GapCount,
      planCount:plans.length,completedActionCount,actionCount},
      heat,
      risks,members,calculatedAt:new Date().toISOString()};
  }

  // 热力图单元格明细：某技能 × 某职级门槛下的达标成员（职级、部门、达标时间）
  // 权限与人群口径与 overview 一致：HR 全量，其他人限本部门 + 自己担任 expert/panel 的人；人群只受岗位筛选影响
  @Get('heat-detail')
  async heatDetail(@Query('skill') skill = '', @Query('grade') grade = '', @Query('role') role = ''): Promise<HeatDetailResponse> {
    if (!skill || skill.length > 128 || !GRADES.includes(grade) || role.length > 128) throw new BadRequestException('筛选条件无效');
    const user = currentEmployee();
    const access = user.personnelRole === 'hr' ? sql`true` : sql`(
      e.department=${user.department} OR EXISTS (
        SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${user.employeeSlug}
          AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))`;
    const people = await this.db.execute<PersonRow>(sql`
      SELECT e.slug,e.name,e.role,e.job_grade,e.preferred_track,e.next_checkin
      FROM employee e WHERE ${access} AND e.status='active'`);
    const heatScoped = people.filter(person => !role || person.role === role);
    const empty:HeatDetailResponse={skillSlug:skill,skillName:skill,grade,threshold:null,met:0,gained:0,employees:[]};
    if (!heatScoped.length) return empty;
    const slugs = sql.join(heatScoped.map(person => sql`${person.slug}`), sql`, `);
    // 门槛与技能名独立查询（该职级可能不要求此技能，此时 threshold 为 null）
    // 达标时间 = 最早一条达到门槛的有效认证时间；gained 口径与热力图一致（cur>=门槛 且 past<门槛）
    const [thresholdRows, personRows] = await Promise.all([
      this.db.execute<HeatThresholdRow>(sql`
        SELECT max(r.required_level)::int AS threshold,
          COALESCE((SELECT name FROM skill WHERE slug=${skill}),${skill}) AS skill_name
        FROM mvp_title_level l
        JOIN mvp_title_requirement r ON r.title_level_id=l.id AND r.is_required=true
        WHERE l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
            ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
          AND l.level_code=${grade} AND r.skill_slug=${skill}`),
      this.db.execute<HeatPersonRow>(sql`
        WITH thr AS (SELECT max(r.required_level)::int AS threshold
          FROM mvp_title_level l
          JOIN mvp_title_requirement r ON r.title_level_id=l.id AND r.is_required=true
          WHERE l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
              ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
            AND l.level_code=${grade} AND r.skill_slug=${skill}),
        lv AS (
          SELECT s.employee_slug AS emp,
            max(s.level)::int AS cur,
            max(CASE WHEN s.certified_at<=now()-interval '30 days'
              AND (s.review_due_at IS NULL OR s.review_due_at>=now()-interval '30 days')
              THEN s.level::int END) AS past
          FROM mvp_employee_skill s
          WHERE s.employee_slug IN (${slugs}) AND s.skill_slug=${skill} AND s.status='active'
            AND (s.review_due_at IS NULL OR s.review_due_at>=now())
          GROUP BY 1)
        SELECT e.slug,e.name,e.job_grade,e.department,e.role,lv.cur::int AS level,lv.past::int AS past,
          min(sk.certified_at) FILTER (WHERE sk.level>=thr.threshold) AS met_at
        FROM thr
        CROSS JOIN employee e
        JOIN lv ON lv.emp=e.slug
        LEFT JOIN mvp_employee_skill sk ON sk.employee_slug=e.slug AND sk.skill_slug=${skill}
          AND sk.status='active' AND (sk.review_due_at IS NULL OR sk.review_due_at>=now())
        WHERE e.slug IN (${slugs}) AND lv.cur>=thr.threshold
        GROUP BY e.slug,e.name,e.job_grade,e.department,e.role,lv.cur,lv.past`),
    ]);
    const threshold=thresholdRows[0]?.threshold??null;
    const skillName=thresholdRows[0]?.skill_name??skill;
    const employees=personRows.map(row=>{
      const level=row.level??0;
      return { slug:row.slug,name:row.name,grade:row.job_grade,department:row.department,role:row.role,
        level,certifiedAt:row.met_at?new Date(row.met_at).toISOString():null,
        gained:threshold!==null&&(row.past??0)<threshold&&level>=threshold };
    }).sort((a,b)=>Number(b.gained)-Number(a.gained)
      ||(b.certifiedAt??'').localeCompare(a.certifiedAt??'')
      ||a.name.localeCompare(b.name,'zh-Hans-CN'));
    return { skillSlug:skill,skillName,grade,threshold,
      met:employees.length,gained:employees.filter(row=>row.gained).length,employees };
  }
}
