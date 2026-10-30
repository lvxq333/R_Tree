import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import postgres from 'postgres';
const require=createRequire(import.meta.url);
const {NestFactory}=require('@nestjs/core'),{json}=require('express'),XLSX=require('xlsx');
const {AppModule}=require('../dist/server/app.module.js');
const {validatePosition}=require('../dist/shared/position-validation.js');
const {parsePositionFile}=require('../dist/server/modules/positions/position-import.js');
const schema='test_positions_'+randomUUID().replaceAll('-','');
const admin=postgres(process.env.DATABASE_URL,{max:1,onnotice:()=>{}});
let db,app;
const fullStandard=(description='完整测试技能')=>({description,revision:'',levels:[1,2,3,4,5].map(level=>({level,anchor:`L${level} 能独立完成相应任务\n并提供可验证结果`,evidence:`L${level} 代码、测试和成果证明`}))});
const inputFor=(family,name,skill)=>({family,name,grades:[1,2,3,4].map(n=>({code:family+n,name:`${name}职级${n}`,requirements:[{skillName:skill,requiredLevel:n,isRequired:true,standard:fullStandard()},{skillName:skill+'推荐',requiredLevel:5,isRequired:false,standard:fullStandard('推荐技能说明')}]}))});
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const url=new URL(process.env.DATABASE_URL);url.searchParams.set('search_path',schema);
  db=postgres(url.toString(),{max:1,onnotice:()=>{}});
  const tables=await admin`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  for(const {tablename:name} of tables){assert.match(name,/^[a-z_]+$/);await db.unsafe(`CREATE TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);if(!name.startsWith('app_'))await db.unsafe(`INSERT INTO "${name}" OVERRIDING SYSTEM VALUE SELECT * FROM public."${name}"`);}
  for(const file of ['020-position-management.sql','021-skill-standards.sql','022-position-requirements.sql']) {
    const migration=await readFile(new URL('../server/database/migrations/'+file,import.meta.url),'utf8');
    await db.unsafe(migration);await db.unsafe(migration);
  }
  const people=await db`SELECT id,slug,personnel_role,job_grade FROM employee WHERE status='active'`;
  const actors=[people.find(p=>p.personnel_role==='hr'),people.find(p=>p.job_grade==='T4'&&p.personnel_role!=='hr'),people.find(p=>p.job_grade!=='T4'&&p.personnel_role!=='hr')];
  assert.ok(actors.every(Boolean));
  const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  for(const [i,p] of actors.entries())await db`INSERT INTO app_account(employee_id,username,password_hash) VALUES(${p.id},${'position-test-'+i},${`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`})`;
  process.env.DATABASE_URL=url.toString();process.env.ASSESSMENT_MODE='mock';process.env.AI_MODE='mock';
  app=await NestFactory.create(AppModule,{logger:false});app.use(json({limit:'8mb'}));app.useStaticAssets(fileURLToPath(new URL('../dist/client/',import.meta.url)));await app.listen(0,'127.0.0.1');
  process.env.SERVER_PORT=String(app.getHttpServer().address().port);const base='http://127.0.0.1:'+process.env.SERVER_PORT;
  async function call(path,cookie,method='GET',body) {
    const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=res.headers.get('content-type')?.includes('spreadsheet')?Buffer.from(await res.arrayBuffer()):await res.json();
    return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
  }
  const cookies=[];for(let i=0;i<3;i++){const login=await call('/api/auth/login',null,'POST',{username:'position-test-'+i,password});assert.equal(login.status,201);cookies.push(login.cookie);}
  const [hr,expert,employee]=cookies;
  assert.equal((await call('/api/positions')).status,401);
  assert.equal((await call('/api/positions/export')).status,401);
  for(const [method,path,body] of [['GET','/api/positions'],['GET','/api/positions/export'],['POST','/api/positions',{}],['PATCH','/api/positions/no',{}],['POST','/api/positions/import/preview',{}],['POST','/api/positions/import/confirm',{}]])assert.equal((await call(path,employee,method,body)).status,403);
  assert.equal((await call('/api/positions',expert)).status,200);
  const input=inputFor('T','集成测试岗位','测试技能甲');
  // 每个必填字段，包含隐藏的T4/L5，空白和false均独立验证。
  const mutations=[i=>{i.name=' \n ';},i=>{delete i.family;},i=>{i.grades[3].name='';},i=>{delete i.grades[2].requirements[0].isRequired;},i=>{i.grades[0].requirements[0].skillName='';},i=>{i.grades[0].requirements[0].requiredLevel=0;},i=>{i.grades[3].requirements[0].standard.levels[4].evidence='\n';},i=>{i.grades[2].requirements[0].standard.levels[3].anchor='';},i=>{i.grades[1].requirements[0].standard.description=' ';},i=>{i.grades[0].requirements=[];}];
  for(const mutate of mutations){const invalid=structuredClone(input);mutate(invalid);assert.ok(validatePosition(invalid).length);const result=await call('/api/positions',hr,'POST',invalid);assert.equal(result.status,400,JSON.stringify(result.data));assert.ok(JSON.parse(result.data.error.details).issues.length);}
  assert.equal((await db`SELECT slug FROM mvp_title_track WHERE name=${input.name}`).length,0,'校验失败不写入');
  const slugs={};
  for(const family of ['T','P','M','F']) {
    const body=family==='T'?input:inputFor(family,`测试${family}方向`,`测试${family}技能`);
    const result=await call('/api/positions',expert,'POST',body);assert.equal(result.status,201,JSON.stringify(result.data));slugs[family]=result.data.slug;
  }
  let catalog=(await call('/api/positions',hr)).data;
  for(const family of ['T','P','M','F'])assert.deepEqual(catalog.directions.find(d=>d.slug===slugs[family]).grades.map(g=>g.code),[1,2,3,4].map(n=>family+n));
  let direction=catalog.directions.find(d=>d.slug===slugs.T);
  assert.equal(direction.grades[0].requirements[1].isRequired,false);
  const duplicate=await call('/api/positions',hr,'POST',input);assert.equal(duplicate.status,409);
  const updated=structuredClone(direction);updated.grades[0].name='更新的职级名称';
  assert.equal((await call('/api/positions/'+slugs.T,hr,'PATCH',updated)).status,200);
  assert.equal((await call('/api/positions/'+slugs.T,hr,'PATCH',updated)).status,409,'过期页面不能覆盖');
  const [skill]=await db`SELECT slug FROM skill WHERE name='测试技能甲'`;
  await db`INSERT INTO mvp_employee_skill(slug,employee_slug,skill_slug,level,status,certified_at) VALUES(${randomUUID()},${actors[2].slug},${skill.slug},4,'active',now()) ON CONFLICT DO NOTHING`;
  const gap=await call('/api/judging/gap?track='+slugs.T+'&level=T1',employee);assert.equal(gap.status,200);assert.equal(gap.data.total,1);assert.equal(gap.data.met,1);assert.equal(gap.data.state,'ready');assert.equal(gap.data.requirements.length,2);assert.equal(gap.data.gapItems.length,0,'推荐技能不阻塞资格也不进入必需缺口');
  assert.equal(gap.data.requirements.find(r=>r.isRequired===false).met,false);
  const idp=await call('/api/idp/draft',employee,'POST',{track:slugs.T,level:'T1',startMonth:'2026-10',months:24});assert.equal(idp.status,201,JSON.stringify(idp.data));
  // 全量导出：七列、单表、合并、冻结、换行和所有序列；不受前端筛选影响。
  const exported=await call('/api/positions/export',hr);assert.equal(exported.status,200,JSON.stringify(exported.data));assert.ok(exported.headers.get('content-disposition').includes('filename*='));
  const book=XLSX.read(exported.data,{type:'buffer'});assert.equal(book.SheetNames.length,1);
  const sheet=book.Sheets[book.SheetNames[0]],table=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  assert.deepEqual(table[0],['序列','方向','职级','技能名称','技能等级','技能描述','是否必须']);
  assert.ok(sheet['!merges'].some(m=>m.s.c===0));assert.ok(sheet['!merges'].some(m=>m.s.c===1));assert.ok(sheet['!merges'].some(m=>m.s.c===2));
  for(const family of ['技术T','产品P','管理M','行政F'])assert.ok(table.some(row=>row[0]===family));
  assert.ok(table.some(row=>row[3]==='测试技能甲推荐'&&row[6]==='否'));assert.ok(table.some(row=>row[5]===input.grades[0].requirements[0].standard.levels[0].anchor));
  const zip=XLSX.CFB.read(exported.data,{type:'buffer'}),xml=path=>Buffer.from(XLSX.CFB.find(zip,'/'+path).content).toString();
  assert.match(xml('xl/worksheets/sheet1.xml'),/state="frozen"/);assert.match(xml('xl/styles.xml'),/wrapText="1"/);
  const parsedExport=parsePositionFile('岗位.xlsx',exported.data.toString('base64'));assert.ok(parsedExport.rows.some(r=>r.family==='P'&&r.grade==='P2'));assert.ok(!parsedExport.errors.some(e=>e.includes('测试P方向')));
  // 五种格式都支持七列，复用已有完整标准；合并范围只在Excel中展开。
  const headers=table[0],data=[headers,['技术T','集成测试岗位','T1','测试技能甲','L2',input.grades[1].requirements[0].standard.levels[1].anchor,'是']];
  for(const type of ['xlsx','xls','csv','tsv','md']) {
    let buffer;
    if(type==='md')buffer=Buffer.from(data.map((r,i)=>'|'+r.map(c=>c.replaceAll('\n',' ')).join('|')+'|'+(i===0?'\n|---|---|---|---|---|---|---|':'')).join('\n'));
    else if(type==='tsv')buffer=Buffer.from(data.map(r=>r.map(c=>c.replaceAll('\n',' ')).join('\t')).join('\n'));
    else{const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(data),'岗位标准');buffer=XLSX.write(workbook,{type:'buffer',bookType:type});}
    const preview=await call('/api/positions/import/preview',hr,'POST',{filename:'岗位.'+type,content:buffer.toString('base64')});assert.equal(preview.status,201,JSON.stringify(preview.data));assert.equal(preview.data.rows.length,1,type);assert.deepEqual(preview.data.errors,[],JSON.stringify(preview.data));
  }
  // 七列导入不能绕过新技能五级初始化。
  const incomplete='序列,方向,职级,技能名称,技能等级,技能描述,是否必须\nT,不完整方向,T1,未配置的新技能,L1,只有一级描述,是';
  const badPreview=await call('/api/positions/import/preview',hr,'POST',{filename:'bad.csv',content:Buffer.from(incomplete).toString('base64')});assert.ok(badPreview.data.errors.length);
  catalog=(await call('/api/positions',hr)).data;
  const rows=[1,2,3,4].map(n=>({family:'P',direction:'完整导入方向',grade:'P'+n,skillName:'完整导入新技能',requiredLevel:n,isRequired:true,standard:fullStandard()}));
  assert.equal((await call('/api/positions/import/confirm',hr,'POST',{rows,revision:'stale'})).status,409);
  assert.equal((await call('/api/positions/import/confirm',hr,'POST',{rows,revision:catalog.revision})).status,201);
  catalog=(await call('/api/positions',hr)).data;
  const beforeCount=(await db`SELECT count(*)::int AS count FROM mvp_title_track`)[0].count;
  const invalidRows=[...rows.map(r=>({...r,direction:'事务回滚方向'})),{...rows[0],direction:'缺失字段方向',isRequired:undefined}];
  assert.equal((await call('/api/positions/import/confirm',hr,'POST',{rows:invalidRows,revision:catalog.revision})).status,400);
  assert.equal((await db`SELECT count(*)::int AS count FROM mvp_title_track`)[0].count,beforeCount,'整批原子保存');
  // 完整技能进入员工目录，申请快照在标准变化后保持原文。
  const tree=(await call('/api/skill-tree',employee)).data;assert.ok(tree.categories.flatMap(c=>c.children.flatMap(ch=>ch.skills)).some(s=>s.slug===skill.slug));
  const standard=(await call('/api/skills/'+skill.slug+'/standard',employee)).data;assert.deepEqual(standard.configuredLevels,[1,2,3,4,5]);
  const application={skill:'测试技能甲',skillSlug:skill.slug,level:5,evidenceType:'项目成果',evidenceTitle:'工具接入PR',evidenceLink:'本地测试成果说明',note:'独立完成工具接入与异常重试',standardHash:standard.hash};
  const applied=await call('/api/certifications/self-application',employee,'POST',application);assert.equal(applied.status,201,JSON.stringify(applied.data));
  direction=catalog.directions.find(d=>d.slug===slugs.T);for(const g of direction.grades)for(const r of g.requirements)if(r.skillName==='测试技能甲')r.standard.levels[4].anchor+=' 新增超时验证。';
  assert.equal((await call('/api/positions/'+slugs.T,hr,'PATCH',direction)).status,200);
  const oldRecord=(await call('/api/certifications/'+applied.data.certification.id,employee)).data;assert.equal(oldRecord.anchor,applied.data.certification.anchor);
  assert.notEqual((await call('/api/skills/'+skill.slug+'/standard',employee)).data.hash,standard.hash);
  // 动态职业路线：覆盖管理人员新增方向，默认选择员工岗位，浏览不写回偏好及Gap池。
  await db`UPDATE employee SET preferred_track=${slugs.P},job_grade='P2',role='测试P方向' WHERE slug=${actors[2].slug}`;
  const career=(await call('/api/career',employee)).data;
  assert.equal(career.preferredTrack,slugs.P);
  const productRoute=career.sequences.find(s=>s.key===slugs.P);
  assert.equal(productRoute.family,'P');assert.deepEqual(productRoute.nodes.map(n=>n.code),['P1','P2','P3','P4']);
  assert.equal(productRoute.nodes[1].meta,'当前岗位');assert.equal(productRoute.nodes[2].isNext,true);
  assert.ok(productRoute.nodes[0].skills.some(s=>s.isRequired===false));
  for(const family of ['T','P','M','F'])assert.ok(career.sequences.some(s=>s.key===slugs[family]&&s.family===family));
  assert.equal(career.sequences.find(s=>s.key===slugs.T).nodes[3].skills.find(s=>s.name==='测试技能甲').source,'cert');
  assert.ok((await call('/api/career',hr)).data.sequences.some(s=>s.family==='P'),'HR同样可浏览全部岗位路线');
  for(const row of [
    {source:'okr',title:'服务稳定性与SLO设计',description:'专业技能 / 稳定性工程 · O2目标推导',filled:1,target:3,priority:'p0'},
    {source:'okr',title:'服务稳定性与SLO设计',description:'重复目标',filled:1,target:2,priority:'p1'},
    {source:'current',title:'自动化测试与质量门禁',description:'专业技能 / 工程质量 · 当前岗位未达标',filled:1,target:2,priority:'p0'},
  ])await db`INSERT INTO skill_gap(employee_slug,source,title,description,filled,target,priority) VALUES(${actors[2].slug},${row.source},${row.title},${row.description},${row.filled},${row.target},${row.priority})`;
  const requiredSkill=career.sequences.find(s=>s.key===slugs.T).nodes[0].skills.find(s=>s.name==='测试技能甲');
  assert.equal(requiredSkill.certifiedLevel,4);
  const unapproved=productRoute.nodes[1].skills.find(s=>s.name==='测试P技能');
  assert.equal(unapproved.certifiedLevel,undefined);assert.equal(unapproved.current,0,'岗位职级不冒充技能认证');
  const [productSkill]=await db`SELECT slug FROM skill WHERE name='测试P技能'`;
  await db`INSERT INTO mvp_employee_skill(slug,employee_slug,skill_slug,level,status,certified_at) VALUES(${randomUUID()},${actors[2].slug},${productSkill.slug},1,'active',now())`;
  const withCertificate=(await call('/api/career',employee)).data.sequences.find(s=>s.key===slugs.P).nodes[1].skills.find(s=>s.name==='测试P技能');
  assert.equal(withCertificate.certifiedLevel,1);assert.equal(withCertificate.current,1);assert.equal(withCertificate.target,2);
  await db`UPDATE mvp_employee_skill SET review_due_at=now()-interval '1 day' WHERE employee_slug=${actors[2].slug} AND skill_slug=${productSkill.slug}`;
  assert.equal((await call('/api/career',employee)).data.sequences.find(s=>s.key===slugs.P).nodes[1].skills.find(s=>s.name==='测试P技能').certifiedLevel,undefined,'过期记录不显示为有效等级');
  const gapsResponse=await call('/api/gaps',employee);assert.equal(gapsResponse.status,200);const gapsBefore=gapsResponse.data;
  assert.ok(gapsBefore.items.length);assert.ok(gapsBefore.items.every(item=>!Object.hasOwn(item,'competencies')),'Gap契约不再包含子能力');
  assert.equal(gapsBefore.items.filter(item=>item.source==='okr').length,0,'不读取预置OKR差距');
  assert.ok(!gapsBefore.items.some(item=>['服务稳定性与SLO设计','自动化测试与质量门禁'].includes(item.title)),'不读取预置岗位差距');
  assert.deepEqual(gapsBefore.items.map(({source,title,filled,target})=>({source,title,filled,target})).sort((a,b)=>a.source.localeCompare(b.source)),[
    {source:'career',title:'测试P技能',filled:0,target:3},
    {source:'current',title:'测试P技能',filled:0,target:2},
  ],'Gap与岗位路线、有效技能认证逐项一致；过期技能按0计算且不包含推荐技能');
  assert.ok(gapsBefore.items.every(item=>item.description.includes('测试P方向')),'仅对应员工实际路线');
  const suggestions=await call('/api/gaps/actions',employee);assert.equal(suggestions.status,200);
  assert.equal(suggestions.data.items.length,1,'同技能的行动按最高目标合并');
  assert.ok(suggestions.data.items[0].detail.includes('当前 L0，目标 L3'));
  await db`UPDATE mvp_employee_skill SET review_due_at=null,level=2 WHERE employee_slug=${actors[2].slug} AND skill_slug=${productSkill.slug}`;
  let live=(await call('/api/gaps',employee)).data.items;
  assert.equal(live.length,1);assert.equal(live[0].source,'career');assert.equal(live[0].filled,2);assert.equal(live[0].target,3,'认证更新后重新计算差距');
  await db`UPDATE employee SET job_grade='P4' WHERE slug=${actors[2].slug}`;
  live=(await call('/api/gaps',employee)).data.items;
  assert.equal(live.length,1);assert.equal(live[0].source,'current');assert.equal(live[0].target,4,'最高职级仍核对当前岗位要求');
  await db`UPDATE mvp_employee_skill SET level=4 WHERE employee_slug=${actors[2].slug} AND skill_slug=${productSkill.slug}`;
  assert.deepEqual((await call('/api/gaps',employee)).data.items,[],'当前岗位完全达标且无下一站时差距为空');
  assert.deepEqual((await call('/api/gaps/actions',employee)).data.items,[],'没有差距就不生成行动');
  await db`UPDATE employee SET job_grade='P2' WHERE slug=${actors[2].slug}`;
  await db`UPDATE mvp_employee_skill SET level=1,review_due_at=now()-interval '1 day' WHERE employee_slug=${actors[2].slug} AND skill_slug=${productSkill.slug}`;
  // 独立空白员工验证：无路线、技能、职称，管理权限不应凭空生成Gap。
  const blankSlug='gap-blank-'+randomUUID();
  const [blank]=await db`INSERT INTO employee(slug,name,status,personnel_role) VALUES(${blankSlug},'空白验证员工','active','hr') RETURNING id`;
  await db`INSERT INTO app_account(employee_id,username,password_hash,access_role) VALUES(${blank.id},${blankSlug},${`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`},'manager')`;
  const blankLogin=await call('/api/auth/login',null,'POST',{username:blankSlug,password});assert.equal(blankLogin.status,201);
  assert.deepEqual((await call('/api/gaps',blankLogin.cookie)).data.items,[],'空白员工不继承默认路线或HR模拟差距');
  assert.deepEqual((await call('/api/gaps/actions',blankLogin.cookie)).data.items,[]);
  await db`UPDATE employee SET preferred_track=${slugs.P},role='测试P方向',job_grade='P1' WHERE slug=${blankSlug}`;
  const blankGaps=(await call('/api/gaps',blankLogin.cookie)).data.items;
  assert.equal(blankGaps.length,2);assert.ok(blankGaps.every(g=>g.filled===0&&g.title==='测试P技能'),'空白技能员工绑定路线后从L0计算');
  const priorityOrder={p0:0,p1:1,p2:2};
  assert.ok(gapsBefore.items.every((item,index)=>!index||priorityOrder[gapsBefore.items[index-1].priority]<=priorityOrder[item.priority]),'全部来源统一排序');
  await call('/api/career?direction='+slugs.M,employee);
  assert.deepEqual((await call('/api/gaps',employee)).data,gapsBefore,'浏览其他路线不得改变Gap池');
  assert.equal((await db`SELECT preferred_track FROM employee WHERE slug=${actors[2].slug}`)[0].preferred_track,slugs.P);
  // 删除方向采用归档：员工关联、职级要求和历史记录原样保留；列表/导出/路线同步移除。
  catalog=(await call('/api/positions',hr)).data;
  const removing=catalog.directions.find(d=>d.slug===slugs.M);
  assert.equal((await call('/api/positions/'+slugs.M+'?revision='+encodeURIComponent(removing.revision),employee,'DELETE')).status,403);
  assert.equal((await call('/api/positions/'+slugs.M+'?revision=stale',hr,'DELETE')).status,409);
  await db`UPDATE employee SET preferred_track=${slugs.M},job_grade='M1' WHERE slug=${actors[1].slug}`;
  const countBefore=(await db`SELECT count(*)::int AS count FROM mvp_title_requirement r JOIN mvp_title_level l ON l.id=r.title_level_id WHERE l.track_slug=${slugs.M}`)[0].count;
  assert.equal((await call('/api/positions/'+slugs.M+'?revision='+encodeURIComponent(removing.revision),hr,'DELETE')).status,200);
  assert.equal((await db`SELECT count(*)::int AS count FROM mvp_title_requirement r JOIN mvp_title_level l ON l.id=r.title_level_id WHERE l.track_slug=${slugs.M}`)[0].count,countBefore);
  assert.equal((await db`SELECT preferred_track FROM employee WHERE slug=${actors[1].slug}`)[0].preferred_track,slugs.M,'删除方向保留员工原关联');
  assert.ok(!(await call('/api/positions',hr)).data.directions.some(d=>d.slug===slugs.M));
  assert.ok(!(await call('/api/career',employee)).data.sequences.some(d=>d.key===slugs.M));
  const afterArchive=XLSX.read((await call('/api/positions/export',hr)).data,{type:'buffer'});
  assert.ok(!XLSX.utils.sheet_to_json(afterArchive.Sheets[afterArchive.SheetNames[0]],{header:1}).some(row=>row[1]===removing.name));
  console.log('岗位标准通过：重复迁移、三角色权限、全部字段校验、五级完整性、四序列职级编码、必需/推荐判定、并发保护、原子导入、五格式解析、单表合并导出、冻结与换行、员工技能目录、申请快照与IDP联动、动态职业路线、岗位默认匹配、Gap池隔离、方向删除与历史保留。');
  if(process.argv.includes('--preview')) {
    console.log(JSON.stringify({testOnly:true,url:base+'/#positions',username:'position-test-0',password}));
    await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
  }
} finally {
  if(app)await app.close();if(db)await db.end();await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();
}
