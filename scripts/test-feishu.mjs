import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
const require = createRequire(import.meta.url);
const { FeishuService } = require('../dist/server/modules/feishu/feishu.service.js');
const { TeamService } = require('../dist/server/modules/team/team.service.js');
const { AuthService } = require('../dist/server/modules/auth/auth.service.js');
const { assertTrustedOrigin } = require('../dist/server/platform/trusted-origin.js');
const schema = `test_feishu_${randomUUID().replaceAll('-', '')}`;
const admin = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const originalFetch = globalThis.fetch;
let db;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('search_path', schema);
  db = postgres(url.toString(), { max: 5, onnotice: () => {} });
  for (const name of ['employee','app_account','app_external_identity','app_session','app_oauth_flow',
      'mvp_notification','team_project','team_role','team_assignment','team_history','mvp_org_relation',
      'employee_skill','approval','approval_reminder']) {
    await db.unsafe(`CREATE TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);
  }
  await db`INSERT INTO employee SELECT * FROM public.employee WHERE status='active' ORDER BY slug LIMIT 3`;
  const people = await db`SELECT id,slug,name FROM employee ORDER BY slug`;
  const [first, second] = people;
  await db`UPDATE employee SET personnel_role='employee',job_grade='T1'`;
  const [account] = await db`INSERT INTO app_account(employee_id,username,password_hash) VALUES(${first.id},'test-account','unused') RETURNING id`;
  const [other] = await db`INSERT INTO app_account(employee_id,username,password_hash) VALUES(${second.id},'other-account','unused') RETURNING id`;
  await db`INSERT INTO app_external_identity(provider,subject,account_id) VALUES('feishu','cli_test:tenant:ou_test',${account.id})`;
  // Historical records must not be delivered at migration time.
  await db`INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body) VALUES('old',${first.slug},'system-error','old','old')`;
  const migration = await readFile(new URL('../server/database/migrations/030-feishu-integration.sql', import.meta.url), 'utf8');
  const connection = await db.reserve();
  try { await connection.unsafe(migration); await connection.unsafe(migration); }
  finally { connection.release(); }
  assert.equal((await db`SELECT count(*)::int AS n FROM app_feishu_delivery`)[0].n, 0);
  Object.assign(process.env, { FEISHU_MODE:'real', FEISHU_BRIDGE_URL:'http://127.0.0.1:8010', FEISHU_BRIDGE_TOKEN:'never-real',
    FEISHU_BRIDGE_PUBLIC_URL:'http://127.0.0.1:18010', FEISHU_APP_ID:'cli_test', FEISHU_TENANT_KEY:'tenant',
    DEPLOYMENT_MODE:'server', LOCAL_DEMO:'false', SERVER_PORT:'3001', AUTH_APP_URL:'http://127.0.0.1:18011/' });
  assert.doesNotThrow(() => assertTrustedOrigin({headers:{host:'127.0.0.1:18011',origin:'http://127.0.0.1:18011'}}));
  assert.throws(() => assertTrustedOrigin({headers:{host:'127.0.0.1:18011',origin:'https://attacker.test'}}));
  assert.throws(() => assertTrustedOrigin({headers:{host:'223.109.239.36:10983'}}));
  const service = new FeishuService(drizzle(db));
  const user = { employeeSlug:first.slug, accountId:account.id, feishuLinked:true };
  const calls = [];
  service.bridge = async (path, body) => {
    if (path.startsWith('/v1/events')) return {events:[]};
    calls.push(body);
    return {id:`bridge-${body.business_ref}`,status:'sent'};
  };
  await service.sendTest(user);
  await service.tick();
  let [test] = await db`SELECT * FROM mvp_notification WHERE kind='integration-test'`;
  assert.equal((await service.status(user)).deliveries[0].state,'sent');
  assert.equal((await service.status({...user,employeeSlug:second.slug})).deliveries.length,0);
  assert.deepEqual(calls[0].actions,[{key:'ack',label:'确认收到'}]);
  const ack = {id:1,type:'notification.action',notification_id:`bridge-${test.slug}`,business_ref:test.slug,action:'ack',
    actor:{app_id:'cli_test',tenant_key:'tenant',open_id:'ou_test'}};
  await db`UPDATE app_feishu_delivery SET bridge_id=NULL,state='retry' WHERE notification_slug=${test.slug}`;
  await service.consume(ack); await service.consume(ack);
  assert.equal((await db`SELECT bridge_id FROM app_feishu_delivery WHERE notification_slug=${test.slug}`)[0].bridge_id,ack.notification_id);
  assert.equal((await db`SELECT count(*)::int AS n FROM app_feishu_inbox WHERE event_id=1`)[0].n,1);
  assert.match((await service.status(user)).deliveries[0].result,/真实飞书卡片/);
  // Unbound recipients are visible as blocked, never as delivered.
  await db`INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body) VALUES('unbound',${second.slug},'system-error','test','test')`;
  await service.tick();
  assert.equal((await db`SELECT state FROM app_feishu_delivery WHERE notification_slug='unbound'`)[0].state,'waiting_binding');
  assert.equal(calls.length,1);
  // Real team business transition, with actor verification, repeat protection and source attribution.
  await db`INSERT INTO team_project(slug,title,status,creator_slug,creator_name) VALUES('project','真实卡片事务测试','confirming',${second.slug},${second.name})`;
  await db`INSERT INTO team_role(slug,project_slug,title,headcount) VALUES('role','project','测试角色',1)`;
  await db`INSERT INTO team_assignment(role_slug,candidate_slug) VALUES('role',${first.slug})`;
  await db`INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body,payload)
    VALUES('invite',${first.slug},'team-invite','组队邀请','test','{"roleSlug":"role","projectSlug":"project"}')`;
  await service.tick();
  const invite = {...ack,id:2,notification_id:'bridge-invite',business_ref:'invite',action:'accept'};
  await service.consume({...invite,id:3,actor:{...invite.actor,open_id:'ou_attacker'}});
  assert.equal((await db`SELECT response FROM team_assignment WHERE role_slug='role'`)[0].response,'pending');
  await service.consume(invite); await service.consume(invite);
  assert.equal((await db`SELECT response,response_source FROM team_assignment WHERE role_slug='role'`)[0].response_source,'feishu');
  assert.equal((await db`SELECT status FROM team_project WHERE slug='project'`)[0].status,'confirmed');
  assert.equal((await db`SELECT count(*)::int AS n FROM team_history WHERE event='response'`)[0].n,1);
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification WHERE payload->>'event'='team-response'`)[0].n,1);
  const team = new TeamService(drizzle(db));
  await assert.rejects(team.mockResponse({},{}),/模拟响应/);
  // Withdrawal prevents actions even if the old card remains visible in Feishu.
  await db`UPDATE mvp_notification SET payload=payload||'{"withdrawnAt":"now"}' WHERE slug='invite'`;
  await service.consume({...invite,id:4,action:'reject'});
  assert.match((await db`SELECT result FROM app_feishu_inbox WHERE event_id=4`)[0].result,/未执行/);
  assert.equal((await db`SELECT status FROM team_project WHERE slug='project'`)[0].status,'confirmed');
  // Retry uses an identical persisted request, preventing duplicate notification sends.
  await db`INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body) VALUES('retry',${first.slug},'system-error','retry','retry')`;
  const attempts=[];
  service.bridge = async (path, body) => {
    if (path.startsWith('/v1/events')) return {events:[]};
    attempts.push(body);
    if (attempts.length===1) throw new Error('simulated network interruption');
    return {id:'bridge-retry',status:'sent'};
  };
  await service.tick();
  await db`UPDATE app_feishu_delivery SET next_attempt_at=now() WHERE notification_slug='retry'`;
  await service.tick();
  assert.deepEqual(attempts[0],attempts[1]);
  // Binding is tied to the originating local session; a bridge ticket cannot switch its account.
  const auth = new AuthService(drizzle(db));
  const flow = await auth.startFeishu(other.id);
  assert.equal(new URL(flow.url).searchParams.get('client_id'),'skilltree');
  await assert.rejects(auth.finishFeishu('ticket',flow.state,flow.state,account.id),/账号发生变化/);
  const freshFlow=await auth.startFeishu(other.id);
  globalThis.fetch=async () => new Response(JSON.stringify({app_id:'cli_test',tenant_key:'tenant',open_id:'ou_other'}),{status:200,headers:{'Content-Type':'application/json'}});
  await auth.finishFeishu('ticket',freshFlow.state,freshFlow.state,other.id);
  assert.equal((await db`SELECT subject FROM app_external_identity WHERE account_id=${other.id}`)[0].subject,'cli_test:tenant:ou_other');
  // Notifications and reminders work for both new and pre-existing approval records.
  await db`UPDATE employee SET personnel_role='hr' WHERE slug=${second.slug}`;
  await db`INSERT INTO employee_skill(slug,employee_slug,title) VALUES('cert',${first.slug},'测试技能')`;
  await db`INSERT INTO approval(slug,linked_slug,title,status) VALUES('approval','cert','测试申请','pending')`;
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification WHERE kind='approval-pending' AND payload->>'approvalSlug'='approval'`)[0].n,1);
  await db`INSERT INTO approval_reminder(slug,approval_slug,requester_name) VALUES('reminder','approval','测试申请人')`;
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification WHERE payload->>'reminderSlug'='reminder'`)[0].n,1);
  await db`UPDATE approval SET status='approved' WHERE slug='approval'`;
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification WHERE kind='approval-result' AND recipient_employee_slug=${first.slug}`)[0].n,1);
  console.log(JSON.stringify({result:'passed',checks:['no historical delivery','transactional outbox','unbound recipient blocked',
    'own delivery visibility','real team transition','actor isolation','event deduplication','withdrawal enforcement',
    'stable retry key','crash recovery','approval notifications and reminders','mock disabled','SSH origin restrictions','session-bound identity link']}));
} finally {
  globalThis.fetch=originalFetch;
  await db?.end();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
