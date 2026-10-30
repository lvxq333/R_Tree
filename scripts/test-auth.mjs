import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

// 所有注册及修改都发生在独立 schema；不向用户实际员工库写测试员工。
const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/server/app.module.js');
const originalUrl = process.env.DATABASE_URL;
const originalPort = process.env.SERVER_PORT;
const schema = `test_auth_${randomUUID().replaceAll('-', '')}`;
const admin = postgres(originalUrl, { max: 1, onnotice: () => {} });
let db, app;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(originalUrl);
  url.searchParams.set('search_path', `${schema},public`);
  db = postgres(url.toString(), { max: 3, onnotice: () => {} });
  const tables = await admin`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  for (const { tablename: name } of tables) {
    assert.match(name, /^[a-z_]+$/);
    await db.unsafe(`CREATE TABLE "${schema}"."${name}" (LIKE public."${name}" INCLUDING ALL)`);
    if ((!name.startsWith('app_') && !name.startsWith('mvp_')) || name === 'mvp_mock_fact_source')
      await db.unsafe(`INSERT INTO "${schema}"."${name}" OVERRIDING SYSTEM VALUE SELECT * FROM public."${name}"`);
  }
  for (const name of ['003-auth.sql', '004-employee-accounts.sql'])
    await db.unsafe(await readFile(new URL(`../server/database/migrations/${name}`, import.meta.url), 'utf8'));
  const people = await db`SELECT id,slug,name FROM employee ORDER BY slug`;
  assert.ok(people.length >= 2);
  await db`INSERT INTO mvp_standard_version SELECT * FROM public.mvp_standard_version WHERE status='published'`;
  await db`INSERT INTO skill(slug,name) VALUES('auth-isolation-skill','接口隔离测试技能')`;
  // Explicit fixture: the employee directory may grow or contain people with no prior certificates.
  await db`INSERT INTO employee_skill(slug,employee_slug,title,status,source,evidence)
    VALUES('auth-isolation-fixture',${people[0].slug},'账号隔离测试材料','pending','project',
      '[{"type":"说明","title":"测试材料","detail":"仅用于独立 schema 的账号隔离验证"}]'::jsonb)`;
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  for (const [index, person] of people.slice(0, 2).entries())
    await db`INSERT INTO app_account(employee_id,username,password_hash) VALUES(${person.id},${`existing${index}`},${passwordHash})`;
  process.env.DATABASE_URL = url.toString();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  process.env.SERVER_PORT = String(port);
  const base = `http://127.0.0.1:${port}`;
  async function call(path, cookie, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  assert.equal((await call('/api/employees/current/workspace')).status, 401);
  assert.equal((await call('/api/auth/me')).data, null);
  const existing = await Promise.all([0, 1].map(index => call('/api/auth/login', null, 'POST', { username: `existing${index}`, password })));
  for (const [index, result] of existing.entries()) {
    assert.equal(result.status, 201);
    assert.equal(result.data.employeeId, people[index].id);
    assert.equal((await call('/api/auth/me', result.cookie)).data.employeeId, people[index].id);
  }
  const before = await db`SELECT count(*)::int AS count FROM employee`;
  const input = { username: 'fresh-employee', password, name: '注册测试员工', org: '测试部门', position: '工程师', hireDate: '2026-10-20' };
  const registered = await call('/api/auth/register', null, 'POST', { ...input, accessRole: 'manager', employeeId: people[0].id });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.accessRole, 'employee', '客户端不能指定管理者或绑定其他员工');
  const fresh = registered.data;
  assert.notEqual(fresh.employeeId, people[0].id);
  const [saved] = await db`SELECT e.name,e.org,e.role,f.basic_info FROM employee e JOIN mvp_fact_employee f ON f.employee_id=e.id WHERE e.id=${fresh.employeeId}`;
  assert.equal(saved.name, input.name);
  assert.equal(saved.basic_info.name, input.name);
  const workspace = await call('/api/employees/current/workspace', registered.cookie);
  assert.equal(workspace.status, 200);
  assert.equal(workspace.data.employee.id, fresh.employeeId);
  assert.equal(workspace.data.workFactCount, 0);
  assert.equal(workspace.data.metrics.certifiedSkillCount, 0);
  for (const [path, property] of [['/api/certifications', null], ['/api/approvals', null], ['/api/growth/events', 'events'], ['/api/gaps', 'items'], ['/api/facts/current', 'items'], ['/api/facts/changes', 'items']]) {
    const result = await call(path, registered.cookie);
    assert.equal(result.status, 200, path);
    assert.deepEqual(property ? result.data[property] : result.data, [], path);
  }
  const factStatus = await call('/api/facts/status', registered.cookie);
  assert.equal(factStatus.data.employeeId, fresh.employeeId);
  assert.equal(factStatus.data.employee.name, input.name);
  assert.equal(factStatus.data.activeCount, 0);
  assert.deepEqual((await call('/api/idp', registered.cookie)).data.phases, []);
  assert.equal((await call('/api/employees', registered.cookie)).data.length, 1);
  const duplicate = await call('/api/auth/register', null, 'POST', { ...input, username: input.username.toUpperCase() });
  assert.equal(duplicate.status, 409);
  assert.equal((await db`SELECT count(*)::int AS count FROM employee`)[0].count, before[0].count + 1, '重复账号必须回滚员工和事实中心登记');
  assert.equal((await call('/api/auth/register', null, 'POST', { ...input, username: 'invalid-password', password: '123' })).status, 400);
  const race = await Promise.all([1, 2].map(() => call('/api/auth/register', null, 'POST', { ...input, username: 'race-employee' })));
  assert.deepEqual(race.map(row => row.status).sort(), [201, 409]);
  assert.equal((await db`SELECT count(*)::int AS count FROM employee`)[0].count, before[0].count + 2);
  const foreignCerts = await call('/api/certifications', existing[0].cookie);
  assert.ok(foreignCerts.data.length);
  const cert = foreignCerts.data[0];
  assert.equal((await call(`/api/certifications/${cert.id}`, registered.cookie)).status, 404);
  assert.equal((await call(`/api/certifications/${cert.id}/decision`, registered.cookie, 'POST', { decision: 'dismiss' })).status, 404);
  assert.equal((await call(`/api/skill-assessments/${cert.id}/workspace`, registered.cookie)).status, 404);
  assert.equal((await call(`/api/employees/${people[0].slug}`, registered.cookie)).status, 403);
  assert.equal((await call('/api/team', registered.cookie)).status, 403);
  assert.equal((await call('/API/TEAM/', registered.cookie)).status, 403);
  assert.equal((await call('/API/APPROVALS/manager-review', registered.cookie, 'POST', {})).status, 403);
  assert.equal((await call('/api/approvals/manager-review', registered.cookie, 'POST', {})).status, 403);
  const foreignFacts = await call('/api/facts/current', existing[0].cookie);
  assert.ok(foreignFacts.data.items.length);
  assert.equal((await call(`/api/facts/${foreignFacts.data.items[0].id}`, registered.cookie)).status, 404);
  // 并发请求必须始终保留各自登录员工，不可被其他请求覆盖。
  await Promise.all(Array.from({ length: 15 }, async (_, index) => {
    const session = index % 3 === 2 ? registered : existing[index % 3];
    const result = await call('/api/employees/current/workspace', session.cookie);
    assert.equal(result.data.employee.id, session.data.employeeId);
    const facts = await call('/api/facts/current', session.cookie);
    assert.ok(facts.data.items.every(item => item.employeeId === session.data.employeeId));
  }));
  const own = await call('/api/certifications/self-application', registered.cookie, 'POST', {
    skillSlug: 'auth-isolation-skill', level: 2, evidenceTitle: '本人提交的资料', employeeSlug: people[0].slug,
  });
  assert.equal(own.status, 201);
  assert.equal(own.data.certification.currentLevel, 0);
  const [ownership] = await db`SELECT employee_slug FROM employee_skill WHERE slug=${own.data.certification.id}`;
  assert.equal(ownership.employee_slug, fresh.employeeSlug);
  assert.equal((await call('/api/approvals', registered.cookie)).data[0].applicant, input.name);
  assert.equal((await call(`/api/certifications/${own.data.certification.id}`, existing[0].cookie)).status, 404);
  await call('/api/auth/logout', registered.cookie, 'POST');
  assert.equal((await call('/api/employees/current/workspace', registered.cookie)).status, 401);
  const again = await call('/api/auth/login', null, 'POST', { username: input.username, password });
  assert.equal(again.data.employeeId, fresh.employeeId, '再次登录复用原员工档案');
  console.log(JSON.stringify({ result: 'passed', checks: ['existing employee identity', 'atomic employee registration', 'empty work facts', 'fact-center basic registry', 'duplicate rollback', 'concurrent duplicate registration', 'concurrent identity isolation', 'cross-employee read/write blocked', 'no client identity override', 'logout and re-login'] }));
} finally {
  await app?.close();
  await db?.end();
  process.env.DATABASE_URL = originalUrl;
  if (originalPort === undefined) delete process.env.SERVER_PORT; else process.env.SERVER_PORT = originalPort;
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
