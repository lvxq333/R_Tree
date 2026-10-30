import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { seedMockFacts } from './seed-facts.mjs';

const require = createRequire(import.meta.url);
const { employeeScope } = require('../dist/server/modules/auth/employee-context.js');
const { FactsService, factHash } = require('../dist/server/modules/facts/facts.service.js');
const schema = `test_facts_${randomUUID().replaceAll('-','')}`;
const admin = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
let client;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  client = postgres(process.env.DATABASE_URL, { max: 3, onnotice: () => {}, connection: { search_path: `${schema},public` } });
  for (const table of ['employee','employee_project','performance_record','employee_skill']) {
    await client.unsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    await client.unsafe(`INSERT INTO "${schema}"."${table}" SELECT * FROM public."${table}"`);
  }
  await client`CREATE TABLE mvp_fact_employee(employee_id uuid PRIMARY KEY REFERENCES employee(id),basic_info jsonb NOT NULL,registered_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())`;
  await client`INSERT INTO employee(slug,name) VALUES('zhang-san','隔离测试员工') ON CONFLICT(slug) DO NOTHING`;
  const [actor] = await client`SELECT id,slug,name FROM employee WHERE slug='zhang-san'`;
  employeeScope.enterWith({employeeId:actor.id,employeeSlug:actor.slug,name:actor.name,accessRole:'employee'});
  // Existing demo current employee has no project row. Add a fixture only to the isolated copy.
  await client`INSERT INTO employee_project(employee_slug,title,time_range)
    SELECT slug,'隔离测试项目','2026.10' FROM employee WHERE slug='zhang-san'`;
  const migrations = await Promise.all(['001-facts-center.sql','002-mock-fact-sources.sql','014-employee-fact-center.sql','015-employee-directory.sql'].map(name =>
    readFile(new URL(`../server/database/migrations/${name}`,import.meta.url),'utf8')));
  for (let replay=0;replay<2;replay++) for(const migration of migrations) await client.unsafe(migration);
  const seeded = await seedMockFacts(client);
  assert.ok(seeded >= 6);
  assert.equal(await seedMockFacts(client),0,'seed replay must not overwrite or duplicate sources');
  const service = new FactsService(drizzle(client));
  const peer = new FactsService(drizzle(client));
  await Promise.all([service.refresh(), service.refresh(), peer.refresh()]);
  const [{expected}] = await client`SELECT (SELECT count(*) FROM employee_project)+(SELECT count(*) FROM performance_record)+
    (SELECT COALESCE(sum(jsonb_array_length(evidence)),0) FROM employee_skill)+(SELECT count(*) FROM mvp_mock_fact_source) AS expected`;
  const [{count}] = await client`SELECT count(*) FROM mvp_fact`;
  assert.equal(Number(count),Number(expected));
  const [{events}] = await client`SELECT count(*) AS events FROM mvp_fact_change`;
  assert.equal(Number(events),Number(count),'concurrent/repeated sync must not duplicate changes');
  const [{ employees:wideEmployees, facts:wideFacts }] = await client`
    SELECT count(*)::int AS employees,sum(fact_count)::int AS facts FROM mvp_employee_wide`;
  const [{ employeeCount }] = await client`SELECT count(*)::int AS "employeeCount" FROM employee`;
  assert.equal(wideEmployees,employeeCount,'wide table must have one row per employee');
  assert.equal(wideFacts,Number(count),'wide table facts must match active facts');
  const [manual] = await client`INSERT INTO mvp_manual_fact_source(employee_id,kind,title,occurred_at,content)
    VALUES(${actor.id},'project','人工事实测试',now(),' {"detail":"已核验的项目记录"}'::jsonb) RETURNING id`;
  await service.refresh();
  const [manualFact] = await client`SELECT id,version FROM mvp_fact WHERE source_table='mvp_manual_fact_source' AND source_key=${manual.id}`;
  assert.equal(manualFact.version,1);
  const [wideAfterManual] = await client`SELECT fact_count FROM mvp_employee_wide WHERE employee_id=${actor.id}`;
  assert.equal(wideAfterManual.fact_count, (await service.status()).activeCount);
  await client`UPDATE mvp_manual_fact_source SET title='人工事实测试修订' WHERE id=${manual.id}`;
  await service.refresh();
  const [revised] = await client`SELECT version,title FROM mvp_fact WHERE id=${manualFact.id}`;
  assert.equal(revised.version,2);
  assert.equal(revised.title,'人工事实测试修订');
  await client`UPDATE mvp_manual_fact_source SET revoked_at=now() WHERE id=${manual.id}`;
  await service.refresh();
  const [revoked] = await client`SELECT status,version FROM mvp_fact WHERE id=${manualFact.id}`;
  assert.equal(revoked.status,'deleted');
  assert.equal(revoked.version,3);
  const status = await service.status();
  assert.equal(status.healthy,true);
  assert.ok(['not-configured','available'].includes(status.assessment));
  let after='', all=[];
  do {
    const page = await service.list(after,2);
    all.push(...page.items);
    after = page.nextAfter;
  } while (after);
  assert.equal(all.length,status.activeCount);
  assert.ok(all.every(row => row.employeeId===status.employeeId));
  assert.equal(new Set(all.map(row=>row.id)).size,all.length);
  const mocks=all.filter(row=>row.provenance==='simulated');
  assert.equal(mocks.length,6);
  assert.ok(mocks.every(row=>row.title.startsWith('[模拟]') && row.content.isSimulated===true),JSON.stringify(mocks[0]));
  assert.equal((await service.list('',100,'git_commit')).items.length,3);
  assert.equal((await service.list('',100,'okr')).items.length,2);
  assert.equal((await service.list('',100,'employee_transfer')).items.length,1);
  const mock=mocks.find(row=>row.kind==='git_commit');
  const [{cursor:mockCursor}]=await client`SELECT COALESCE(max(cursor),0)::text AS cursor FROM mvp_fact_change WHERE employee_id=${actor.id}`;
  await client`UPDATE mvp_mock_fact_source SET title=title || '修订' WHERE source_key=${mock.sourceKey}`;
  await service.refresh();
  assert.equal((await service.detail(mock.id)).version,2);
  const mockChanges=await service.changes(mockCursor,100);
  assert.equal(mockChanges.items.length,1);
  assert.equal(mockChanges.items[0].fact.provenance,'simulated');
  assert.equal(await seedMockFacts(client),0);
  await service.refresh();
  assert.equal((await service.detail(mock.id)).version,2,'seed replay must preserve edited mock source');
  const project = all.find(row => row.kind==='project');
  assert.ok(project,'current employee must have project test fixture');
  const [{last}] = await client`SELECT COALESCE(max(cursor),0)::text AS last FROM mvp_fact_change`;
  // Modify isolated source only; deliberately leave legacy _updated_at unchanged.
  await client`UPDATE employee_project SET title=title || ' [测试更新]' WHERE id=${project.sourceKey}`;
  await service.refresh();
  let detail = await service.detail(project.id);
  assert.equal(detail.version,2);
  assert.match(detail.title,/测试更新/);
  let changes = await service.changes(last,100);
  assert.equal(changes.items.length,1);
  assert.equal(changes.items[0].operation,'updated');
  assert.equal(changes.items[0].fact.version,2);
  await client`DELETE FROM employee_project WHERE id=${project.sourceKey}`;
  await service.refresh();
  changes = await service.changes(changes.nextCursor,100);
  assert.equal(changes.items.length,1);
  assert.equal(changes.items[0].operation,'deleted');
  detail = await service.detail(project.id);
  assert.equal(detail.status,'deleted');
  assert.equal(detail.version,3);
  assert.equal((await service.changes('0',100,project.id)).items.length,3);
  const [foreign] = await client`SELECT id FROM mvp_fact WHERE employee_id<>${status.employeeId} LIMIT 1`;
  await assert.rejects(service.detail(foreign.id),/事实不存在/);
  assert.ok(!(await service.changes('0',100)).items.some(row=>row.fact.id===foreign.id));
  const before = await service.status();
  const [row] = await client`SELECT id FROM employee_project LIMIT 1`;
  await client`UPDATE employee_project SET employee_slug='missing-test-employee' WHERE id=${row.id}`;
  await assert.rejects(service.refresh(),/不存在（孤儿数据）/);
  const failed = await service.status();
  assert.equal(failed.healthy,false);
  assert.equal(failed.lastCheckedAt,before.lastCheckedAt,'failed import must not advance checkpoint');
  assert.equal(failed.activeCount,before.activeCount);
  assert.equal(factHash({a:1,b:{c:2,d:3}}),factHash({b:{d:3,c:2},a:1}));
  console.log(JSON.stringify({result:'passed',initialFacts:Number(count),currentEmployeeFacts:status.activeCount,
    checks:['migration replay','concurrent import','idempotency','pagination','source change without audit timestamp',
      'version history','deletion tombstone','employee isolation','failed import rollback','canonical hash']}));
} finally {
  await client?.end();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
