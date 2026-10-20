import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { seedMockFacts } from './seed-facts.mjs';

const require=createRequire(import.meta.url);
const {employeeScope}=require('../dist/server/modules/auth/employee-context.js');
const {AssessmentService,validateAssessment,cleanMaterial}=require('../dist/server/modules/facts/assessment.service.js');
const {FactsService}=require('../dist/server/modules/facts/facts.service.js');
const {DeepSeekService}=require('../dist/server/modules/facts/deepseek.service.js');
const {BadGatewayException}=require('@nestjs/common');
const admin=postgres(process.env.DATABASE_URL,{max:1,onnotice:()=>{}});
const schema=`test_assessment_${randomUUID().replaceAll('-','')}`;
let client;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  client=postgres(process.env.DATABASE_URL,{max:3,onnotice:()=>{},connection:{search_path:`${schema},public`}});
  for (const table of ['employee','employee_skill','employee_project','performance_record']) {
    await client.unsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    await client.unsafe(`INSERT INTO "${schema}"."${table}" SELECT * FROM public."${table}"`);
  }
  await client`CREATE TABLE mvp_fact_employee(employee_id uuid PRIMARY KEY REFERENCES employee(id),basic_info jsonb NOT NULL,registered_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())`;
  const [actor] = await client`SELECT id,slug,name FROM employee WHERE is_current_user=true`;
  employeeScope.enterWith({employeeId:actor.id,employeeSlug:actor.slug,name:actor.name,accessRole:'employee'});
  for (const name of ['001-facts-center.sql','002-mock-fact-sources.sql','003-skill-assessment.sql']) {
    await client.unsafe(await readFile(new URL(`../server/database/migrations/${name}`,import.meta.url),'utf8'));
  }
  await seedMockFacts(client);
  const db=drizzle(client),facts=new FactsService(db);
  await facts.refresh();
  let calls=0,fail=false;
  const fakeAi={configuration:()=>({model:'test-model'}),complete:async (_prompt,input)=>{
    calls++;
    if(fail)throw new BadGatewayException('模型账户余额不足');
    return {abilities:input.standard.abilities.map((a,i)=>({abilityId:a.id,supportedLevel:i===1?2:null,reason:i===1?'测试引用支持该子能力':'证据不足',
      citations:i===1?[{factId:input.materials[0].id,version:input.materials[0].version,quote:input.materials[0].title}]:[],
      gaps:i===1?[]:['缺少相关材料'],questions:['请补充实践过程']}))};
  }};
  const service=new AssessmentService(db,facts,fakeAi);
  await service.initializeStandards();
  await service.initializeStandards();
  const [person]=await client`SELECT id,slug FROM employee WHERE is_current_user=true`;
  const [cert]=await client`SELECT slug FROM employee_skill WHERE employee_slug=${person.slug} AND skill_slug='programming' LIMIT 1`;
  const workspace=await service.workspace(cert.slug,person.id);
  assert.equal(workspace.standard.abilities.length,4);
  assert.ok(workspace.standard.abilities.every(a=>a.anchors.length===5));
  assert.ok(!JSON.stringify(workspace.materials).includes('[模拟]'));
  assert.ok(!JSON.stringify(workspace.materials).includes('isSimulated'));
  const [certificationFact]=await client`SELECT id FROM mvp_fact WHERE employee_id=${person.id} AND content->'evidence'->>'type'='认证' LIMIT 1`;
  assert.ok(!workspace.materials.some(f=>f.id===certificationFact.id));
  const material=workspace.materials.find(f=>f.kind==='git_commit'&&f.recommended);
  assert.ok(material);
  const input={targetLevel:2,factIds:[material.id],selfMaterial:''};
  const [first,repeated]=await Promise.all([service.create(cert.slug,input,person.id),service.create(cert.slug,input,person.id)]);
  assert.equal(first.id,repeated.id);
  await service.processNext();
  const complete=await service.get(cert.slug,first.id,person.id);
  assert.equal(complete.status,'completed');assert.equal(complete.result.supportedCount,1);assert.equal(complete.result.gapCount,3);
  assert.equal(complete.stale,false);
  assert.equal((await service.create(cert.slug,input,person.id)).id,first.id);
  await service.processNext();assert.equal(calls,1);
  const [record]=await client`SELECT input_snapshot FROM mvp_skill_assessment WHERE id=${first.id}`;
  assert.equal(record.input_snapshot.facts[0].provenance,'simulated','internal provenance must remain auditable');
  assert.equal(record.input_snapshot.standard.hash,workspace.standard.hash);
  const [foreign]=await client`SELECT id,employee_id FROM mvp_fact WHERE employee_id<>${person.id} LIMIT 1`;
  await assert.rejects(service.workspace(cert.slug,foreign.employee_id),/不存在|无权/);
  await assert.rejects(service.create(cert.slug,{...input,factIds:[foreign.id]},person.id),/不可用/);
  await assert.rejects(service.create(cert.slug,{...input,factIds:[certificationFact.id]},person.id),/不可用/);
  await assert.rejects(service.create(cert.slug,{...input,targetLevel:6},person.id),/L1~L5/);
  const originalMode=process.env.AI_MODE;
  process.env.AI_MODE='mock';
  assert.throws(()=>new DeepSeekService().configuration(),/不使用模拟/);
  if(originalMode===undefined)delete process.env.AI_MODE;else process.env.AI_MODE=originalMode;
  const valid={abilities:workspace.standard.abilities.map(a=>({abilityId:a.id,supportedLevel:null,reason:'证据不足',citations:[],gaps:[],questions:[]}))};
  assert.equal(validateAssessment(valid,workspace.standard,[],2).gapCount,4);
  const bad=structuredClone(valid);bad.abilities[0].supportedLevel=3;
  assert.throws(()=>validateAssessment(bad,workspace.standard,[],2),/缺少证据/);
  bad.abilities[0].citations=[{factId:'unknown',version:1,quote:'编造引用'}];
  assert.throws(()=>validateAssessment(bad,workspace.standard,[],2),/原文核对/);
  bad.abilities[0].supportedLevel=6;assert.throws(()=>validateAssessment(bad,workspace.standard,[],2),/格式无效/);
  assert.deepEqual(cleanMaterial({isSimulated:true,title:'[模拟] 材料',sourceRef:'mock://git/test',x:1}),{title:'材料',x:1});
  await client`UPDATE mvp_mock_fact_source SET title=title||'更新' WHERE source_key=${record.input_snapshot.facts[0].sourceKey}`;
  await facts.refresh();
  assert.equal((await service.get(cert.slug,first.id,person.id)).stale,true);
  const next=await service.create(cert.slug,input,person.id);assert.notEqual(next.id,first.id);
  fail=true;await service.processNext();
  const failed=await service.get(cert.slug,next.id,person.id);
  assert.equal(failed.status,'failed');assert.equal(failed.error,'模型账户余额不足');assert.equal(failed.result,null);
  const retry=await service.create(cert.slug,input,person.id);assert.notEqual(retry.id,next.id);
  if(process.argv.includes('--real')) {
    const realService=new AssessmentService(db,facts,new DeepSeekService());
    const samples=await client`SELECT slug,skill_slug FROM employee_skill WHERE employee_slug=${person.slug}
      AND skill_slug IN ('programming','testing','k8s','collaboration') ORDER BY skill_slug`;
    for(const sample of samples) {
      const view=await realService.workspace(sample.slug,person.id);
      const facts=view.materials.filter(m=>m.recommended).slice(0,6).map(m=>m.id);
      assert.ok(facts.length>0);
      const task=await realService.create(sample.slug,{targetLevel:2,factIds:facts,selfMaterial:''},person.id);
      let result=task;
      for(let round=0;round<4 && ['queued','running'].includes(result.status);round++) {
        await realService.processNext();
        result=await realService.get(sample.slug,task.id,person.id);
      }
      assert.equal(result.status,'completed',result.error??'真实评估未完成');
      assert.equal(result.result.abilities.length,4);
      console.log(JSON.stringify({realModel:'passed',skill:sample.skill_slug,materials:facts.length,supported:result.result.supportedCount,gap:result.result.gapCount}));
    }
  }
  console.log(JSON.stringify({result:'passed',checks:['immutable versioned standards','partial child coverage','scope isolation','exclude circular evidence',
    'simulated provenance hidden in UI and preserved internally','concurrent idempotency','successful cache','source-version invalidation','strict citation validation',
    'no mock fallback','provider failure surfaced','retry retains history']}));
}finally{
  await client?.end();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
