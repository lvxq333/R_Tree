import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
const require = createRequire(import.meta.url);
const { TeamService } = require('../dist/server/modules/team/team.service.js');
const schema = `test_team_${randomUUID().replaceAll('-', '')}`;
const admin = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
let db;
try {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('search_path', schema);
  db = postgres(url.toString(), { max: 5, onnotice: () => {} });
  for (const name of ['employee', 'skill', 'mvp_employee_skill', 'team_project', 'team_role', 'team_assignment', 'mvp_notification']) {
    await db.unsafe(`CREATE TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);
    if (['employee', 'skill', 'mvp_employee_skill'].includes(name)) {
      await db.unsafe(`INSERT INTO "${name}" OVERRIDING SYSTEM VALUE SELECT * FROM public."${name}"`);
    }
  }
  const migration = await readFile(new URL('../server/database/migrations/027-team-role-members.sql', import.meta.url), 'utf8');
  const connection = await db.reserve();
  try {
    await connection.unsafe(migration);
    await connection.unsafe(migration); // migration is repeatable
  } finally { connection.release(); }
  await db.unsafe(await readFile(new URL('../server/database/migrations/028-team-response-source.sql', import.meta.url), 'utf8'));
  await db.unsafe(await readFile(new URL('../server/database/migrations/029-team-history.sql', import.meta.url), 'utf8'));
  process.env.LOCAL_DEMO = 'true';
  const service = new TeamService(drizzle(db));
  const [person] = await db`SELECT slug,name,department FROM employee WHERE status='active' LIMIT 1`;
  const actor = { employeeSlug: person.slug, name: person.name, department: person.department, personnelRole: 'hr' };
  const [pair] = await db`SELECT s.employee_slug AS first,t.employee_slug AS second,s.skill_slug
    FROM mvp_employee_skill s JOIN mvp_employee_skill t ON s.skill_slug=t.skill_slug AND s.employee_slug<>t.employee_slug
    JOIN employee e ON e.slug=s.employee_slug JOIN employee f ON f.slug=t.employee_slug
    WHERE s.status='active' AND t.status='active' AND s.certified_at<=now() AND t.certified_at<=now()
      AND (s.review_due_at IS NULL OR s.review_due_at>=now()) AND (t.review_due_at IS NULL OR t.review_due_at>=now())
      AND e.status='active' AND f.status='active' LIMIT 1`;
  assert.ok(pair);
  await db`UPDATE employee SET availability='100%'`;
  const others = await db`SELECT slug FROM employee WHERE status='active' AND slug NOT IN (${pair.first},${pair.second}) LIMIT 3`;
  const project = (await service.createProject(actor, { title: '多人角色回归', department: person.department })).project.id;
  const input = { title: '同一角色两人', headcount: 2, allocation: '50%', skills: [{ skillSlug: pair.skill_slug, level: 1, type: 'required' }], project };
  const role = (await service.createRole(actor, input)).id;
  let view = (await service.assign(actor, role, { candidateSlug: pair.first })).project;
  assert.deepEqual(view.assignments[role], [pair.first]);
  assert.equal(view.skillCoverage, 50, '空缺名额按零覆盖计算');
  await assert.rejects(service.changeStatus(actor, { project, action: 'confirm' }), /还有 1 个成员名额/);
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification`)[0].n, 0);
  view = (await service.assign(actor, role, { candidateSlug: pair.second })).project;
  assert.equal(view.assignments[role].length, 2);
  assert.equal(view.skillCoverage, 100);
  await service.assign(actor, role, { candidateSlug: pair.second });
  assert.equal((await service.buildResponse(actor, project)).project.assignments[role].length, 2, '重复点击不重复占名额');
  await assert.rejects(service.assign(actor, role, { candidateSlug: others[0].slug }), /人数已满/);
  await assert.rejects(service.updateRole(actor, role, { ...input, headcount: 1 }), /不能少于已选成员/);
  await assert.rejects(service.removeAssignment(actor, role), /指定要移除/);
  view = (await service.removeAssignment(actor, role, pair.second)).project;
  assert.deepEqual(view.assignments[role], [pair.first], '移除一人保留另一人');
  await service.assign(actor, role, { candidateSlug: pair.second });
  view = (await service.changeStatus(actor, { project, action: 'confirm' })).project;
  assert.equal(view.status, 'confirming');
  assert.equal((await db`SELECT count(*)::int AS n FROM mvp_notification`)[0].n, 2, '两人各收到邀请');
  const first = { ...actor, employeeSlug: pair.first, personnelRole: 'employee' };
  const second = { ...actor, employeeSlug: pair.second, personnelRole: 'employee' };
  assert.equal((await service.listInvites(first)).length, 1);
  assert.equal((await service.listInvites(second)).length, 1);
  await assert.rejects(service.respond({ ...first, employeeSlug: others[0].slug }, { roleSlug: role, action: 'accept' }), /未找到发给你的/);
  await service.respond(first, { roleSlug: role, action: 'accept' });
  view = (await service.buildResponse(actor, project)).project;
  assert.equal(view.status, 'confirming', '一人接受不能代表全员');
  assert.equal(view.responses[role][pair.first].state, 'accepted');
  assert.equal(view.responses[role][pair.second].state, 'pending');
  await service.respond(second, { roleSlug: role, action: 'reject', note: '档期冲突' });
  assert.equal((await service.buildResponse(actor, project)).project.status, 'adjusting');
  await assert.rejects(service.removeAssignment(actor, role, pair.first), /仅允许移除已拒绝/);
  view = (await service.assign(actor, role, { candidateSlug: others[0].slug })).project;
  assert.deepEqual(new Set(view.assignments[role]), new Set([pair.first, others[0].slug]));
  assert.equal(view.responses[role][pair.first].state, 'accepted', '替换拒绝者保留其他成员的响应');
  await service.changeStatus(actor, { project, action: 'confirm' });
  assert.equal((await service.buildResponse(actor, project)).project.responses[role][pair.first].state, 'accepted', '重新协调保留已接受的成员');
  await service.respond({ ...second, employeeSlug: others[0].slug }, { roleSlug: role, action: 'accept' });
  assert.equal((await service.buildResponse(actor, project)).project.status, 'confirmed');
  await service.changeStatus(actor, { project, action: 'reopen' });
  await service.clearAssignments(actor, project);
  await service.updateRole(actor, role, { ...input, headcount: 1 });
  const results = await Promise.allSettled([
    service.assign(actor, role, { candidateSlug: pair.first }),
    service.assign(actor, role, { candidateSlug: pair.second }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1, '并发抢最后名额仅一人成功');
  const assigned = (await service.buildResponse(actor, project)).project.assignments[role][0];
  const another = (await service.createRole(actor, { ...input, title: '另一角色', headcount: 1 })).id;
  await assert.rejects(service.assign(actor, another, { candidateSlug: assigned }), /不能承担多个角色/);
  await service.assign(actor, another, { candidateSlug: others[1].slug });
  await db`UPDATE employee SET availability='20%' WHERE slug=${others[1].slug}`;
  await assert.rejects(service.changeStatus(actor, { project, action: 'confirm' }), /待处理冲突/);
  await db`UPDATE employee SET availability='100%' WHERE slug=${others[1].slug}`;
  await service.changeStatus(actor, { project, action: 'confirm' });
  // Keyword search covers the whole population, including candidates outside the recommendation shortlist.
  const outsiders = await db`SELECT slug,name FROM employee WHERE status='active' ORDER BY name DESC,slug DESC LIMIT 1`;
  const searched = await service.searchCandidates(actor, role, outsiders[0].slug);
  assert.equal(searched.total, 1);
  assert.equal(searched.candidates[0].candidateSlug, outsiders[0].slug);
  assert.equal((await service.searchCandidates(actor, role, 'does-not-exist-unique')).total, 0);
  assert.equal((await service.searchCandidates(actor, role, '  ')).total, 0);
  await assert.rejects(service.searchCandidates({ ...actor, personnelRole: 'expert', employeeSlug: 'outsider', department: '其他部门' }, role, '数据'), /无权访问/);
  await service.changeStatus(actor, { project, action: 'reopen' });
  await service.changeStatus(actor, { project, action: 'confirm' });
  const mock = { project, roleSlug: role, candidateSlug: assigned, action: 'reject' };
  await assert.rejects(service.mockResponse({ ...actor, employeeSlug: 'not-creator', personnelRole: 'expert' }, mock), /仅组建者/);
  process.env.LOCAL_DEMO = 'false';
  await assert.rejects(service.mockResponse(actor, mock), /仅在本机演示/);
  process.env.LOCAL_DEMO = 'true';
  await assert.rejects(service.mockResponse(actor, { ...mock, note: '长'.repeat(256) }), /最多 255/);
  view = (await service.mockResponse(actor, mock)).project;
  assert.equal(view.status, 'adjusting');
  assert.equal(view.responses[role][assigned].source, 'mock');
  assert.equal(view.responses[role][assigned].note, null, '拒绝理由选填');
  const notification = view.responseNotifications.find((item) => item.candidateSlug === assigned && item.source === 'mock');
  assert.ok(notification);
  assert.equal(notification.action, 'rejected');
  assert.match(notification.body, /未填写理由/);
  const [persisted] = await db`SELECT recipient_employee_slug,sent_via_feishu FROM mvp_notification WHERE slug=${notification.id}`;
  assert.equal(persisted.recipient_employee_slug, actor.employeeSlug);
  assert.equal(persisted.sent_via_feishu, false, '模拟通知不能声称已真实发送');
  const memberHistory = await service.listInvites({ ...first, employeeSlug: assigned });
  assert.equal(memberHistory.find((item) => item.roleSlug === role).state, 'rejected', '员工再次进入能看到持久化拒绝状态');
  await assert.rejects(service.mockResponse(actor, { ...mock, action: 'accept' }), /已对该邀请/);
  const notificationCount = view.responseNotifications.length;
  await service.changeStatus(actor, { project, action: 'reopen' });
  assert.equal((await service.buildResponse(actor, project)).project.responseNotifications.length, notificationCount, '重开方案保留通知记录');
  await service.changeStatus(actor, { project, action: 'confirm' });
  view = (await service.mockResponse(actor, { ...mock, action: 'accept' })).project;
  assert.equal(view.status, 'confirming');
  view = (await service.mockResponse(actor, { ...mock, roleSlug: another, candidateSlug: others[1].slug, action: 'accept' })).project;
  assert.equal(view.status, 'confirmed', 'Mock 全员接受可自动组建完成');
  assert.ok(view.responseNotifications.some((item) => item.action === 'accepted' && item.body.includes('组建完成')));
  assert.ok(view.responseNotifications.some((item) => item.source === 'employee' && item.action === 'rejected' && item.body.includes('档期冲突')));
  // Rejected candidates stay excluded from recommendations after replacement and reopening, but remain searchable.
  let retained = (await service.buildResponse(actor, project)).project;
  assert.ok(retained.history.length > 10);
  const refusal = retained.history.find((item) => item.snapshot.members.some((member) => member.candidateSlug === pair.second && member.response === 'rejected' && member.note === '档期冲突'));
  assert.ok(refusal, '被替换者的拒绝理由应保留在快照中');
  assert.ok(retained.coordinationNotifications.some((item) => item.event === 'invite' && item.state === 'withdrawn'), '撤回通知不删除');
  assert.ok(retained.coordinationNotifications.some((item) => item.event === 'response' && item.body.includes('档期冲突')));
  for (const item of retained.roles) assert.ok(!item.recommendations.some((candidate) => candidate.candidateSlug === pair.second));
  const declinedSearch = await service.searchCandidates(actor, role, pair.second);
  assert.equal(declinedSearch.candidates[0].declinedPreviously, true);
  const preservedHistory = retained.history.find((item) => item.id === refusal.id);
  await service.changeStatus(actor, { project, action: 'reopen' });
  await service.clearAssignments(actor, project);
  retained = (await service.buildResponse(actor, project)).project;
  assert.deepEqual(retained.history.find((item) => item.id === refusal.id), preservedHistory, '历史快照不随当前成员清空而改变');
  assert.ok(!retained.roles[0].recommendations.some((candidate) => candidate.candidateSlug === pair.second));
  await service.assign(actor, role, { candidateSlug: pair.second });
  const manuallyReselected = (await service.buildResponse(actor, project)).project.roles.find((item) => item.id === role);
  assert.ok(manuallyReselected.members.some((item) => item.candidateSlug === pair.second), '手动重选拒绝者后当前团队仍显示该成员');
  assert.ok(!manuallyReselected.recommendations.some((item) => item.candidateSlug === pair.second), '系统推荐与已选成员分开保存');
  // Another project must obtain explicit acknowledgement before adding a recent participant.
  const otherProject = (await service.createProject(actor, { title: '近期投入确认测试', department: actor.department })).project.id;
  const otherRole = (await service.createRole(actor, { ...input, project: otherProject, headcount: 1 })).id;
  const recentSearch = await service.searchCandidates(actor, otherRole, pair.first);
  assert.ok(recentSearch.candidates[0].recentParticipations.some((item) => item.projectTitle === '多人角色回归'));
  await assert.rejects(service.assign(actor, otherRole, { candidateSlug: pair.first }), (error) => error.getResponse().code === 'TEAM_RECENT_PARTICIPATION');
  assert.deepEqual((await service.buildResponse(actor, otherProject)).project.assignments, {}, '取消确认不占名额');
  await service.assign(actor, otherRole, { candidateSlug: pair.first, recentParticipationAcknowledged: true });
  assert.equal((await service.buildResponse(actor, otherProject)).project.assignments[otherRole].length, 1);
  const hiddenActor = { ...actor, personnelRole: 'expert', department: '隔离部门', employeeSlug: 'restricted-creator' };
  const hiddenProject = (await service.createProject(hiddenActor, { title: '只能看自己的计划', department: actor.department })).project.id;
  const hiddenRole = (await service.createRole(hiddenActor, { ...input, project: hiddenProject, headcount: 1 })).id;
  const hiddenSearch = await service.searchCandidates(hiddenActor, hiddenRole, pair.first);
  assert.ok(hiddenSearch.candidates[0].recentParticipations.every((item) => item.projectTitle === '其他部门组队（详情受限）'));
  await db`UPDATE team_history SET created_at=now()-interval '91 days' WHERE project_slug=${otherProject}`;
  const outsideWindow = await service.searchCandidates(actor, role, pair.first);
  assert.ok(outsideWindow.candidates[0].recentParticipations.every((item) => item.projectTitle !== '近期投入确认测试'), '超过 90 天不再触发近期提示');
  const workspaceArchive = await service.archive(actor);
  assert.ok(workspaceArchive.projects.some((item) => item.slug === project), '新建方案后仍列出之前的组队方案');
  assert.ok(workspaceArchive.projects.some((item) => item.slug === otherProject));
  assert.ok(workspaceArchive.notifications.some((item) => item.projectSlug === project && item.projectTitle === '多人角色回归'), '通知包含所属方案名称与标识');
  assert.ok(workspaceArchive.notifications.some((item) => item.state === 'withdrawn'));
  const restrictedArchive = await service.archive(hiddenActor);
  assert.deepEqual(restrictedArchive.projects.map((item) => item.slug), [hiddenProject], '跨方案历史仍遵循原有数据范围');
  assert.equal(restrictedArchive.notifications.length, 0, '不可见方案的通知不泄露');
  const previousDetail = (await service.buildResponse(actor, project)).project;
  assert.ok(previousDetail.roles.length > 0);
  assert.ok(previousDetail.history.some((item) => item.snapshot.members.some((member) => member.note === '档期冲突')), '从目录进入旧方案仍可查看历史成员抉择');
  console.log('项目组队：历史快照与理由持久化、邀请与撤回通知留存、近期参与二次确认、跨部门信息遮蔽、拒绝推荐过滤及搜索可见，既有多人组队/Mock流程全部通过（独立 schema）');
} finally {
  if (db) await db.end();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
