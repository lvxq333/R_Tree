import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/server/app.module.js');
const { buildIdp } = require('../dist/server/modules/idp/idp-plan.js');
const schema = `test_idp_${randomUUID().replaceAll('-','')}`;
const admin = postgres(process.env.DATABASE_URL,{max:1,onnotice:()=>{}});
let db, app;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);url.searchParams.set('search_path',schema);
  db = postgres(url.toString(),{max:1,onnotice:()=>{}});
  const tables = await admin`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  for(const {tablename:name} of tables) {
    assert.match(name,/^[a-z_]+$/);
    await db.unsafe(`CREATE TABLE "${schema}"."${name}" (LIKE public."${name}" INCLUDING ALL)`);
    if(!name.startsWith('app_') && !name.startsWith('idp_'))
      await db.unsafe(`INSERT INTO "${schema}"."${name}" OVERRIDING SYSTEM VALUE SELECT * FROM public."${name}"`);
  }
  await db.unsafe(await readFile(new URL('../server/database/migrations/012-idp-workspace.sql',import.meta.url),'utf8'));
  const people = await db`SELECT id,slug FROM employee ORDER BY slug LIMIT 2`;
  assert.equal(people.length,2);
  const password = process.argv.includes('--preview') ? 'IdpPreviewForLocalTest2026!' : randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  const passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
  for (const [index,person] of people.entries()) await db`INSERT INTO app_account(employee_id,username,password_hash) VALUES(${person.id},${'idp-test-'+index},${passwordHash})`;
  process.env.DATABASE_URL=url.toString();
  app=await NestFactory.create(AppModule,{logger:false});app.useStaticAssets(fileURLToPath(new URL('../dist/client/',import.meta.url)));await app.listen(0,'127.0.0.1');
  const port=app.getHttpServer().address().port;process.env.SERVER_PORT=String(port);
  const base=`http://127.0.0.1:${port}`;
  async function call(path,cookie,method='GET',body) {
    const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const login=await Promise.all([0,1].map(index=>call('/api/auth/login',null,'POST',{username:'idp-test-'+index,password})));
  login.forEach(result=>assert.equal(result.status,201));
  const mine=login[0].cookie,other=login[1].cookie;
  assert.equal((await call('/api/idp')).status,401);
  assert.deepEqual((await call('/api/idp',mine)).data.phases,[]);
  const options=await call('/api/idp/options',mine);assert.equal(options.status,200);assert.ok(options.data.defaultTarget);
  const target=options.data.defaultTarget;
  const input={...target,startMonth:'2026-10',months:24};
  assert.equal((await call('/api/idp/draft',mine,'POST',{...input,startMonth:'2026-13'})).status,400);
  assert.equal((await call('/api/idp/draft',mine,'POST',{...input,months:1})).status,400);
  const generated=await call('/api/idp/draft',mine,'POST',input);assert.equal(generated.status,201,JSON.stringify(generated.data));
  assert.equal(generated.data.phases.length,4);assert.match(generated.data.positioning.horizon,/2028-10/);
  assert.ok(generated.data.phases.every(phase=>phase.actions.length>0));
  const count=await db`SELECT count(*)::int count FROM idp_plan`;assert.equal(count[0].count,0,'生成草案不得写入正式计划');
  const draftId=generated.data.meta.draftId;
  assert.equal((await call('/api/idp/confirm',other,'POST',{draftId})).status,404,'不能保存他人的草案');
  let saved=await call('/api/idp/confirm',mine,'POST',{draftId});assert.equal(saved.status,201,JSON.stringify(saved.data));
  assert.equal(saved.data.meta.revision,1);assert.equal(saved.data.milestones[0].state,'done');
  assert.equal((await call('/api/idp/confirm',mine,'POST',{draftId})).status,404,'重复确认不重复生成版本');
  assert.equal((await call('/api/idp',mine)).data.meta.revision,1);
  assert.deepEqual((await call('/api/idp',other)).data.phases,[]);
  const action=saved.data.phases[0].actions[0];
  const endpoint='/api/idp/actions/'+encodeURIComponent(action.id);
  const patch={revision:1,status:'done',resultNote:'已完成目标锚点检查并整理学习笔记',evidenceSlugs:[]};
  assert.equal((await call(endpoint,mine,'PATCH',{...patch,resultNote:''})).status,400);
  assert.equal((await call(endpoint,other,'PATCH',patch)).status,404,'跨员工行动不可修改');
  const evidenceSlug='idp-own-'+randomUUID().slice(0,8),foreignSlug='idp-other-'+randomUUID().slice(0,8);
  for (const [slug,owner] of [[evidenceSlug,people[0].slug],[foreignSlug,people[1].slug]]) await db`INSERT INTO mvp_evidence(slug,owner_employee_slug,kind,title,external_url) VALUES(${slug},${owner},'external-link','隔离测试成果链接','https://example.com/result')`;
  assert.equal((await call(endpoint,mine,'PATCH',{...patch,evidenceSlugs:[foreignSlug]})).status,400,'拒绝关联他人证据');
  assert.equal((await call('/api/idp',mine)).data.meta.revision,1,'校验失败不得修改版本');
  assert.equal((await call(endpoint,mine,'PATCH',{...patch,evidenceLink:'javascript:alert(1)'})).status,400);
  saved=await call(endpoint,mine,'PATCH',{...patch,evidenceSlugs:[evidenceSlug]});assert.equal(saved.status,200);assert.equal(saved.data.meta.revision,2);
  assert.equal((await call(endpoint,mine,'PATCH',patch)).status,409,'过期版本必须拒绝');
  const nextDraft=await call('/api/idp/draft',mine,'POST',input);assert.equal(nextDraft.status,201);
  const retained=nextDraft.data.phases.flatMap(phase=>phase.actions).find(item=>item.id===action.id);
  assert.equal(retained.status,'done');assert.deepEqual(retained.evidenceSlugs,[evidenceSlug]);
  assert.equal((await call('/api/idp',mine)).data.meta.revision,2,'预览不覆盖现有计划');
  const aligned=await call('/api/idp/alignments',mine,'POST',{revision:2,date:'2026-10-22',participant:'测试导师',note:'确认下季度实践范围，先完成质量检查单'});
  assert.equal(aligned.status,201);assert.equal(aligned.data.alignments.length,1);
  assert.equal((await call('/api/idp/confirm',mine,'POST',{draftId:nextDraft.data.meta.draftId})).status,409,'生成草案后有新进度不能覆盖');
  const history=await call('/api/idp/history',mine);assert.deepEqual(history.data.map(item=>item.revision),[3,2,1]);
  assert.equal((await call('/api/idp/history/1',mine)).data.meta.revision,1);
  assert.equal((await call('/api/idp/history/1',other)).status,404);
  const review=await call('/api/idp/review',mine);assert.equal(review.status,200);assert.equal(review.data.changed,false);
  // Changed live requirements must trigger adjustment without rewriting saved work.
  await db`UPDATE mvp_employee_skill SET level=5 WHERE employee_slug=${people[0].slug}`;
  const finalDraft=await call('/api/idp/draft',mine,'POST',input);assert.equal(finalDraft.status,201);
  const finalSave=await call('/api/idp/confirm',mine,'POST',{draftId:finalDraft.data.meta.draftId});assert.equal(finalSave.status,201);
  assert.ok(finalSave.data.phases.flatMap(phase=>phase.actions).some(item=>item.id===action.id && item.status==='done'));
  assert.equal(finalSave.data.alignments.length,1);
  const linked=await call(endpoint,mine,'PATCH',{...patch,revision:finalSave.data.meta.revision,evidenceSlugs:[evidenceSlug],evidenceLink:'https://example.com/idp-outcome'});
  assert.equal(linked.status,200,JSON.stringify(linked.data));
  assert.ok(linked.data.phases.flatMap(phase=>phase.actions).find(item=>item.id===action.id).evidence.some(item=>item.url==='https://example.com/idp-outcome'));
  assert.ok((await call('/api/idp/options',mine)).data.evidence.length>=2);
  // Distinct goal levels must not inherit a completed action as completion of a harder requirement.
  const detail={trackSlug:'software',levelCode:'T4',levelName:'资深工程师',met:0,total:1,requirements:[{skillSlug:'design',skillName:'设计',currentLevel:1,requiredLevel:5,met:false}],gapItems:[{skillSlug:'design',skillName:'设计',currentLevel:1,requiredLevel:5,gapLevels:4,competencyNames:[],resources:[]}]};
  const prior={...generated.data,phases:[{actions:[{...action,id:'software:T3:career:design:L3:learn',status:'done'}]}]};
  const harder=buildIdp({...input,track:'software',level:'T4'},options.data.overview,detail,[],'工程师',prior);
  assert.equal(harder.phases[0].actions[0].status,'todo');
  assert.ok(harder.phases[3].actions.some(item=>item.carriedOver && item.status==='done'));
  const shortened=buildIdp({...input,track:'software',level:'T4',months:12},options.data.overview,detail,[],'工程师',harder);
  assert.equal(shortened.phases[0].actions[0].window,'第 1—2 个月');
  const custom=harder.phases[0].actions[0];custom.window='第 1 个月内';custom.customWindow=true;
  const customized=buildIdp({...input,track:'software',level:'T4',months:12},options.data.overview,detail,[],'工程师',harder);
  assert.equal(customized.phases[0].actions[0].window,'第 1 个月内');
  console.log('IDP 隔离集成验证通过：四阶段生成、预览/保存隔离、刷新持久化、状态/证据/员工权限、并发版本冲突、历史、对齐、旧成果保留与更高要求重排。');
  if(process.argv.includes('--preview')) {
    console.log(`隔离页面检查：${base}/#idp（仅测试账号 idp-test-0）`);
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }
} finally {
  if(app)await app.close();if(db)await db.end();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();
}
