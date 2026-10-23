import 'dotenv/config';
import postgres from 'postgres';
import { randomBytes, scryptSync } from 'node:crypto';

const db=postgres(process.env.DATABASE_URL,{max:1});
const groups=[
  ['研发技术中心-Java组','software','Java开发工程师'],['研发技术中心-前端组','software','前端开发工程师'],
  ['研发技术中心-Python组','ai','Python开发工程师'],['研发技术中心-测试组','software','测试工程师'],
  ['研发技术中心-运维组','platform','运维工程师'],['数据技术中心-数据分析组','ai','数据分析师'],
  ['数据技术中心-数据工程组','platform','数据工程师'],['数据技术中心-数据治理组','platform','数据治理工程师'],
];
const family=['陈','林','周','黄','吴','李','王','赵','孙','郑','许','何','朱','高','马','胡','郭','刘','张','杨'];
const given=['晨','宁','嘉','宇','安','彤','涵','远','思','悦','明','博','欣','航','琳','文','琪','浩','敏','轩'];
const gradeFor=n=>n<6?'T1':n<13?'T2':n<20?'T3':'T4';
// 本地演示环境统一口令，避免每次重跑生成不可预期的随机密码
const password=process.env.DEMO_ACCOUNT_PASSWORD || '123456';
const salt=randomBytes(16).toString('hex');
const passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
const records=[];
const createdAccounts=[];
// 旧库中的 24 人来自原始演示样本；仅对这批样本和本脚本生成的 200 人补缺失认证。
const ORIGINAL_SAMPLE_SLUGS=[
  'chen-hao','chen-jing','gao-feng','he-jun','huang-ming','li-na','li-xue','lin-xiao',
  'lin-xiao-de','liu-wei','liu-yang','luo-yan','song-wei','sun-qiang','wang-fang',
  'wang-jun','wu-tao','xu-ting','yang-li','zhang-peng','zhang-wei','zhao-lei',
  'zheng-hua','zhou-min',
];
for(let g=0;g<groups.length;g++) for(let n=0;n<22;n++) {
  const number=g*22+n+1, [department,track,role]=groups[g];
  records.push({number,slug:`demo-employee-${String(number).padStart(3,'0')}`,
    name:`${family[(number+g)%family.length]}${given[(number*3)%given.length]}${given[(number*7+1)%given.length]}`,
    department,track,role,grade:gradeFor(n),personnelRole:'employee'});
}
for(let n=0;n<24;n++) {
  const number=177+n;
  records.push({number,slug:`demo-employee-${String(number).padStart(3,'0')}`,
    name:`${family[(number+2)%family.length]}${given[(number*3)%given.length]}${given[(number*7+1)%given.length]}`,
    department:n<12?'人力资源部-人才发展组':'人力资源部-员工关系组',track:null,
    role:n<12?'人才发展专员':'员工关系专员',grade:null,personnelRole:'hr'});
}
try {
  await db.begin(async tx=>{
    for(const item of records) {
      const [person]=await tx`INSERT INTO employee(slug,name,avatar_text,role,org,department,job_grade,personnel_role,
        work_location,preferred_track,hire_date,status,is_current_user,is_demo,summary)
        VALUES(${item.slug},${item.name},${Array.from(item.name)[0]},${item.role},${item.department},${item.department},
          ${item.grade},${item.personnelRole},'北京',${item.track},${`202${item.number%6}-0${item.number%9+1}-15`},
          'active',false,true,'演示员工；资料与经历均为模拟数据')
        ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,org=EXCLUDED.org,
          department=EXCLUDED.department,job_grade=EXCLUDED.job_grade,personnel_role=EXCLUDED.personnel_role,
          work_location=EXCLUDED.work_location,preferred_track=EXCLUDED.preferred_track,is_demo=true
        WHERE employee.is_demo=true RETURNING id`;
      if(!person) throw new Error(`员工标识冲突，已停止：${item.slug}`);
      await tx`INSERT INTO mvp_fact_employee(employee_id,basic_info)
        VALUES(${person.id},${JSON.stringify({slug:item.slug,name:item.name,org:item.department,
          department:item.department,role:item.role,jobGrade:item.grade,personnelRole:item.personnelRole,
          workLocation:'北京',preferredTrack:item.track,isDemo:true})}::jsonb)
        ON CONFLICT(employee_id) DO UPDATE SET basic_info=EXCLUDED.basic_info,updated_at=now()`;
      if(item.grade) {
        const [level]=await tx`SELECT id FROM mvp_title_level WHERE track_slug=${item.track}
          AND level_code=${item.grade} ORDER BY created_at DESC LIMIT 1`;
        if(!level) throw new Error(`缺少职级标准：${item.track}/${item.grade}`);
        await tx`INSERT INTO mvp_employee_title(slug,employee_slug,title_level_id,certified_at,source_application_slug,status)
          VALUES(${`demo-title-${String(item.number).padStart(3,'0')}`},${item.slug},${level.id},
            ${`202${item.number%6}-0${item.number%9+1}-15`}::date,${`demo-seed-${item.number}`},'active')
          ON CONFLICT(slug) DO UPDATE SET title_level_id=EXCLUDED.title_level_id,certified_at=EXCLUDED.certified_at`;
        if(item.grade!=='T4') {
          const groupIndex=Math.floor((item.number-1)/22);
          const expertNumber=groupIndex*22+21;
          await tx`INSERT INTO mvp_org_relation(slug,employee_slug,relation_type,target_slug,source)
            VALUES(${`demo-expert-relation-${item.number}`},${item.slug},'expert',
              ${`demo-employee-${String(expertNumber).padStart(3,'0')}`},'seed')
            ON CONFLICT(slug) DO UPDATE SET target_slug=EXCLUDED.target_slug`;
        }
      }
      const username=item.number===1?'demo.t1':item.number===21?'demo.expert':item.number===177?'demo.hr':null;
      if(username) {
        const rows=await tx`INSERT INTO app_account(employee_id,username,password_hash,access_role)
          VALUES(${person.id},${username},${passwordHash},'employee') ON CONFLICT(employee_id) DO NOTHING RETURNING username`;
        if(rows.length) createdAccounts.push(username);
      }
    }
    const originalRows=await tx`SELECT slug,department FROM employee WHERE slug IN ${tx(ORIGINAL_SAMPLE_SLUGS)}`;
    for(const row of originalRows) {
      const track=/Python|数据分析/.test(row.department)?'ai'
        :/运维|数据工程|数据治理/.test(row.department)?'platform':'software';
      await tx`UPDATE employee SET preferred_track=${track} WHERE slug=${row.slug}`;
      await tx`UPDATE mvp_fact_employee SET basic_info=jsonb_set(COALESCE(basic_info,'{}'::jsonb),'{preferredTrack}',to_jsonb(${track}::text),true),updated_at=now()
        WHERE employee_id=(SELECT id FROM employee WHERE slug=${row.slug})`;
      await tx`UPDATE mvp_employee_title t SET title_level_id=l.id
        FROM mvp_title_level old,mvp_title_level l
        WHERE t.employee_slug=${row.slug} AND t.source_application_slug='initial-seed'
          AND old.id=t.title_level_id AND l.track_slug=${track} AND l.level_code=old.level_code
          AND old.track_slug<>${track}`;
    }
    const employees=await tx`SELECT e.slug,e.department,e.role,e.job_grade,e.personnel_role,e.preferred_track,e.hire_date,
      (SELECT tl.track_slug FROM mvp_employee_title t JOIN mvp_title_level tl ON tl.id=t.title_level_id
       WHERE t.employee_slug=e.slug AND t.status='active' ORDER BY tl.level_order DESC LIMIT 1) AS title_track,
      (SELECT tl.level_code FROM mvp_employee_title t JOIN mvp_title_level tl ON tl.id=t.title_level_id
       WHERE t.employee_slug=e.slug AND t.status='active' ORDER BY tl.level_order DESC LIMIT 1) AS title_grade
      FROM employee e WHERE e.is_demo=true OR e.slug IN ${tx(ORIGINAL_SAMPLE_SLUGS)}`;
    const requirements=await tx`SELECT n.sequence_slug,n.code,s.skill_slug,s.required_level
      FROM career_node n JOIN career_node_skill s ON s.node_slug=n.slug
      WHERE n.sequence_slug IN ('software','platform','ai','hr') ORDER BY n.sort,s.sort`;
    const knownSkills=new Set((await tx`SELECT slug FROM skill`).map(row=>row.slug));
    let addedSkills=0;
    // 统一点亮轨迹规则（张伟为手工模板，保持不动；其余员工全系统同一套标准）：
    // 1. 职称认定在入职日生效，一次性点亮持有层及以下全部岗位要求；
    // 2. 本序列要求 + 岗位特色技能 + 增益技能（技术=其他两条序列低层要求，HR=人力资源增益技能）
    //    的认证记录从「入职+45 天」到「今天-15 天」按等级升序确定性铺开；
    // 3. 职称已覆盖的技能后续认证记为进阶，增益技能让点亮轨迹在认定后持续增长。
    for(const person of employees) {
      if(person.slug==='zhang-wei') continue;
      const isHr=person.personnel_role==='hr';
      const track=isHr?'hr':(['software','platform','ai'].includes(person.preferred_track)
        ?person.preferred_track:person.title_track);
      if(!track) throw new Error(`员工 ${person.slug} 缺少职业序列，请先修复主数据`);
      const grade=person.job_grade ?? person.title_grade ?? 'T1';
      const stage=Math.max(1,Math.min(4,Number(grade.slice(1))||1));
      const chosen=requirements.filter(row=>row.sequence_slug===track &&
        (isHr?row.code==='H1':/^T[1-4]$/.test(row.code) && Number(row.code.slice(1))<=stage));
      const specialty=isHr
        ? person.department.includes('人才发展') ? [['hr-recruiting',2],['hr-people-analytics',1]]
          : [['hr-compliance',2],['org-communication',2]]
        : person.department.includes('测试') ? [['testing',Math.min(4,stage+1)]]
          : person.department.includes('前端') ? [['product-collab',Math.min(4,stage+1)]]
          : person.department.includes('运维') ? [['slo-design',Math.min(4,stage+1)]]
          : person.department.includes('数据分析') ? [['data-analysis',Math.min(4,stage+1)]]
          : person.department.includes('数据工程') ? [['data-processing',Math.min(4,stage+1)]]
          : person.department.includes('数据治理') ? [['data-quality-gov',Math.min(4,stage+1)]]
          : person.department.includes('Python') ? [['machine-learning',Math.min(4,stage+1)]]
          : [['java-go-eng',Math.min(4,stage+1)]];
      const plan=new Map(chosen.map(row=>[row.skill_slug,row.required_level]));
      for(const [slug,level] of specialty) plan.set(slug,Math.max(plan.get(slug)??0,level));
      // 增益技能：职称认定之外的增长来源（对标张伟的跨序列认证）。
      if(isHr) {
        // 增益技能覆盖雷达四维：人力资源实务 / 组织管理 / 协作与影响 / 业务理解。
        const extra=person.department.includes('人才发展')
          ? [['hr-performance',2],['talent-dev',2],['org-design',1],['business-planning',1]]
          : [['org-design',2],['perf-mgmt',1],['org-governance',1],['requirements',1]];
        for(const [slug,level] of extra) plan.set(slug,Math.max(plan.get(slug)??0,level));
      } else {
        const seedNum=Number(person.slug.match(/(\d+)$/)?.[1] ?? 0)
          || [...person.slug].reduce((sum,char)=>sum+char.charCodeAt(0),0);
        const otherTracks=['software','platform','ai'].filter(item=>item!==track);
        const pool=requirements.filter(row=>otherTracks.includes(row.sequence_slug) && /^T[12]$/.test(row.code));
        const want=2+(seedNum%2);
        let picked=0;
        for(let k=0;k<pool.length && picked<want;k++) {
          const row=pool[(seedNum*3+k*7)%pool.length];
          if(plan.has(row.skill_slug)) continue;
          plan.set(row.skill_slug,row.required_level);
          picked++;
        }
      }
      for(const [slug,level] of plan) {
        if(!knownSkills.has(slug)) throw new Error(`缺少技能标准：${slug}`);
        const id=`directory-${person.slug}-${slug}-l${level}`;
        const rows=await tx`INSERT INTO mvp_employee_skill(slug,employee_slug,skill_slug,level,certified_at,source,status)
          VALUES(${id},${person.slug},${slug},${level},
            LEAST(now(),${person.hire_date}::date + interval '180 days'),'initial-seed','active')
          ON CONFLICT(employee_slug,skill_slug,level) DO NOTHING RETURNING id`;
        addedSkills+=rows.length;
      }
      if(!isHr && person.preferred_track!==track && person.slug.startsWith('demo-employee-'))
        await tx`UPDATE employee SET preferred_track=${track} WHERE slug=${person.slug}`;
    }
    // 统一铺开认证日期：按等级升序（基础技能在前、进阶在后）在线性时间轴上错开，
    // 附带确定性抖动并保证严格递增；职称认定日期不受影响（已在入职日生效）。
    let restaggered=0;
    for(const person of employees) {
      if(person.slug==='zhang-wei') continue;
      const rows=await tx`SELECT id FROM mvp_employee_skill
        WHERE employee_slug=${person.slug} AND status='active' ORDER BY level,skill_slug`;
      if(rows.length===0) continue;
      const hire=person.hire_date instanceof Date ? person.hire_date : new Date(person.hire_date);
      const start=hire.getTime()+45*86400_000;
      const end=Date.now()-15*86400_000;
      if(end-start < rows.length*86400_000) continue;
      const seedNum=Number(person.slug.match(/(\d+)$/)?.[1] ?? 0)
        || [...person.slug].reduce((sum,char)=>sum+char.charCodeAt(0),0);
      let previous=0;
      for(let i=0;i<rows.length;i++) {
        const base=start+(end-start)*(rows.length===1?1:i/(rows.length-1));
        const jitter=((seedNum*7+i*13)%9)-4;
        const at=Math.min(Math.max(base+jitter*86400_000,previous+86400_000),Date.now()-86400_000);
        previous=at;
        await tx`UPDATE mvp_employee_skill SET certified_at=${new Date(at).toISOString()} WHERE id=${rows[i].id}`;
        restaggered++;
      }
    }
    console.log(`已为演示员工补充 ${addedSkills} 条岗位技能；铺开 ${restaggered} 条认证日期（张伟保持手工模板）`);
  });
  const [counts]=await db`SELECT count(*)::int total,count(*) FILTER(WHERE is_demo)::int demo FROM employee`;
  console.log(`员工总数 ${counts.total}，演示员工 ${counts.demo}`);
  if(createdAccounts.length) console.log(`新建演示账号：${createdAccounts.join(' / ')}；密码：${password}`);
  else console.log('演示账号已存在；本次未重置密码');
} finally { await db.end(); }
