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
const password=process.env.DEMO_ACCOUNT_PASSWORD || `Demo-${randomBytes(15).toString('base64url')}`;
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
          VALUES(${`demo-title-${String(item.number).padStart(3,'0')}`},${item.slug},${level.id},now(),${`demo-seed-${item.number}`},'active')
          ON CONFLICT(slug) DO UPDATE SET title_level_id=EXCLUDED.title_level_id`;
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
    for(const person of employees) {
      const isHr=person.personnel_role==='hr';
      const track=isHr?'hr':(['software','platform','ai'].includes(person.preferred_track)
        ?person.preferred_track:person.title_track);
      if(!track) throw new Error(`员工 ${person.slug} 缺少职业序列，请先修复主数据`);
      const grade=person.job_grade ?? person.title_grade ?? 'T1';
      const stage=Math.max(1,Math.min(4,Number(grade.slice(1))||1));
      const chosen=requirements.filter(row=>row.sequence_slug===track &&
        (isHr?row.code==='H1':/^T[1-4]$/.test(row.code) && Number(row.code.slice(1))<=stage));
      const activeSlugs=new Set((await tx`SELECT DISTINCT skill_slug FROM mvp_employee_skill WHERE employee_slug=${person.slug} AND status='active'`).map(row=>row.skill_slug));
      if(chosen.every(row=>activeSlugs.has(row.skill_slug))) continue; // 对照本岗位要求，不拿跨序列技能充当该岗位技能。
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
    console.log(`已为演示员工补充 ${addedSkills} 条岗位技能（原有认证保持不变）`);
  });
  const [counts]=await db`SELECT count(*)::int total,count(*) FILTER(WHERE is_demo)::int demo FROM employee`;
  console.log(`员工总数 ${counts.total}，演示员工 ${counts.demo}`);
  if(createdAccounts.length) console.log(`新建演示账号：${createdAccounts.join(' / ')}；密码：${password}`);
  else console.log('演示账号已存在；本次未重置密码');
} finally { await db.end(); }
