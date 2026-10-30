import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@server/platform/local-platform';
import {
  teamAssignment,
  teamProject,
  teamRole,
} from '@server/database/schema';
import type {
  CreateTeamRoleInput,
  TeamAssignmentResponseState,
  TeamCandidateOption,
  TeamCandidateSearchResponse,
  TeamArchiveResponse,
  TeamHistoryRecord,
  TeamRecentParticipation,
  TeamConflictItem,
  TeamInviteItem,
  TeamProjectView,
  TeamResponse,
  TeamRole,
  TeamRoleSkill,
  TeamRoleSkillInput,
  TeamStatus,
  TeamStatusInput,
} from '@shared/api.interface';

const MAX_RECOMMENDATIONS = 8;

/** 组队操作者（来自会话）：用于部门隔离与邀请响应身份校验 */
export interface TeamActor {
  employeeSlug: string;
  name: string;
  department: string;
  personnelRole: 'employee' | 'hr' | 'expert';
}

type ProjectRow = typeof teamProject.$inferSelect;
type RoleRow = typeof teamRole.$inferSelect;

type RawSkill = { skillSlug?: unknown; name?: unknown; level?: unknown; type?: unknown };

interface NormalizedSkill {
  skillSlug: string;
  name: string;
  level: number;
  type: 'required' | 'bonus';
}

interface PersonRow extends Record<string, unknown> {
  slug: string;
  name: string;
  avatar_text: string | null;
  avatar_tone: string | null;
  department: string | null;
  org: string | null;
  role: string | null;
  availability: string | null;
}

interface SkillRow extends Record<string, unknown> {
  employee_slug: string;
  skill_slug: string;
  name: string;
  level: number;
}

interface AssignmentRow extends Record<string, unknown> {
  role_slug: string;
  candidate_slug: string;
  response: string;
  responded_at: string | Date | null;
  reject_note: string | null;
  response_source: string;
}

function parseAvailabilityPercent(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(?:^|[^\d.])(100|\d{1,2})\s*[%％]/);
  return match ? Number(match[1]) : null;
}

function parseAllocationPercent(allocation: string): number {
  const match = allocation.match(/(\d{1,3})\s*%?/);
  return match ? Math.min(100, Number(match[1])) : 0;
}

/** 兼容两种历史格式：{skillSlug,level,type} 与 {name[,type]}（名字可带 “ L3” 后缀）。 */
function normalizeSkills(
  value: unknown,
  skillNames: Map<string, string>,
): NormalizedSkill[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const result: NormalizedSkill[] = [];
  for (const raw of value as RawSkill[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    const type = raw.type === 'bonus' ? 'bonus' : 'required';
    let slug = '';
    let level = 0;
    let name = '';
    if (typeof raw.skillSlug === 'string' && raw.skillSlug) {
      if (!skillNames.has(raw.skillSlug)) continue;
      slug = raw.skillSlug;
      name = skillNames.get(raw.skillSlug) ?? raw.skillSlug;
      level = Number.isInteger(raw.level) ? Math.min(5, Math.max(1, Number(raw.level))) : 1;
    } else if (typeof raw.name === 'string' && raw.name.trim()) {
      const text = raw.name.trim();
      const levelMatch = text.match(/\s*L([1-5])\s*$/i);
      level = levelMatch ? Number(levelMatch[1]) : 1;
      const baseName = levelMatch ? text.slice(0, levelMatch.index).trim() : text;
      const found = [...skillNames.entries()].find(([, catalogName]) => catalogName === baseName);
      if (!found) continue;
      slug = found[0];
      name = found[1];
    } else {
      continue;
    }
    if (used.has(slug)) continue;
    used.add(slug);
    result.push({ skillSlug: slug, name, level, type });
  }
  return result;
}

const STATUS_LABEL: Record<TeamStatus, string> = {
  draft: '草稿',
  confirming: '协调确认中',
  adjusting: '需调整',
  confirmed: '已确认',
};

@Injectable()
export class TeamService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  private async recordHistory(projectSlug: string, actor: TeamActor, event: string, description: string,
    candidateSlug: string | null = null, decision: string | null = null): Promise<void> {
    await this.db.execute(sql`INSERT INTO team_history(project_slug,event,actor_name,description,candidate_slug,decision,snapshot)
      SELECT p.slug,${event},${actor.name},${description},${candidateSlug},${decision},
        jsonb_build_object('title',p.title,'status',p.status,
          'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('title',r.title,'headcount',r.headcount,'allocation',r.allocation)) FROM team_role r WHERE r.project_slug=p.slug),'[]'::jsonb),
          'members',coalesce((SELECT jsonb_agg(jsonb_build_object('roleTitle',r.title,'candidateSlug',a.candidate_slug,'name',coalesce(e.name,a.candidate_slug),'response',a.response,'note',a.reject_note,'source',a.response_source)) FROM team_role r JOIN team_assignment a ON a.role_slug=r.slug LEFT JOIN employee e ON e.slug=a.candidate_slug WHERE r.project_slug=p.slug),'[]'::jsonb))
      FROM team_project p WHERE p.slug=${projectSlug}`);
  }

  private async declinedCandidates(projectSlug: string): Promise<Set<string>> {
    const rows = await this.db.execute<{ candidate: string }>(sql`
      SELECT candidate_slug AS candidate FROM team_history WHERE project_slug=${projectSlug} AND decision='rejected'
      UNION SELECT payload->>'candidateSlug' FROM mvp_notification WHERE kind='team-invite'
        AND payload->>'projectSlug'=${projectSlug} AND payload->>'action'='rejected'
      UNION SELECT a.candidate_slug FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug
        WHERE r.project_slug=${projectSlug} AND a.response='rejected'`);
    return new Set(rows.map((row) => row.candidate));
  }

  private async recentParticipation(actor: TeamActor, excludeProject: string): Promise<Map<string, TeamRecentParticipation[]>> {
    const rows = await this.db.execute<{
      candidate: string; title: string; role_title: string; status: TeamRecentParticipation['status'];
      response: TeamRecentParticipation['response']; created_at: Date | string;
    }>(sql`WITH recent AS (
      SELECT DISTINCT ON (member->>'candidateSlug',h.project_slug)
        member->>'candidateSlug' AS candidate,h.project_slug,member,
        h.snapshot->>'status' AS status,h.created_at,h.id
      FROM team_history h CROSS JOIN LATERAL jsonb_array_elements(h.snapshot->'members') member
      WHERE h.project_slug<>${excludeProject} AND h.created_at>=now()-interval '90 days'
      ORDER BY member->>'candidateSlug',h.project_slug,h.created_at DESC,h.id DESC
    ) SELECT recent.candidate,
      CASE WHEN ${this.visibleFilter(actor)} THEN p.title ELSE '其他部门组队（详情受限）' END AS title,
      CASE WHEN ${this.visibleFilter(actor)} THEN recent.member->>'roleTitle' ELSE '详情受限' END AS role_title,
      recent.status,recent.member->>'response' AS response,recent.created_at
      FROM recent JOIN team_project p ON p.slug=recent.project_slug
      WHERE recent.member->>'response'<>'rejected'
      ORDER BY recent.created_at DESC`);
    const result = new Map<string, TeamRecentParticipation[]>();
    for (const row of rows) {
      const list = result.get(row.candidate) ?? [];
      list.push({ projectTitle: row.title, roleTitle: row.role_title, status: this.parseStatus(row.status),
        response: this.parseResponseState(row.response), recordedAt: new Date(row.created_at).toISOString() });
      result.set(row.candidate, list);
    }
    return result;
  }

  /* ==================== 方案列表与创建 ==================== */

  /** 可见方案：HR 全部；管理者=本部门方案 + 本人创建的方案（跨部门完全不可见） */
  private visibleFilter(actor: TeamActor): SQL {
    if (actor.personnelRole === 'hr') return sql`TRUE`;
    return sql`(p.department = ${actor.department} OR p.creator_slug = ${actor.employeeSlug})`;
  }

  async listProjects(actor: TeamActor): Promise<TeamResponse['projects']> {
    const rows = await this.db.execute<{
      slug: string; title: string; status: string; department: string | null;
      creator_name: string | null; role_count: number; updated_at: string | Date;
    }>(sql`SELECT p.slug,p.title,p.status,p.department,p.creator_name,p._updated_at AS updated_at,
        (SELECT count(*) FROM team_role r WHERE r.project_slug=p.slug)::int AS role_count
      FROM team_project p WHERE ${this.visibleFilter(actor)}
      ORDER BY p._updated_at DESC`);
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      status: (this.parseStatus(row.status)) as TeamStatus,
      department: row.department ?? '',
      creatorName: row.creator_name ?? '',
      roleCount: Number(row.role_count ?? 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));
  }

  /** 跨方案历史目录与协调通知，始终按方案可见范围过滤。 */
  async archive(actor: TeamActor): Promise<TeamArchiveResponse> {
    const projects = await this.listProjects(actor);
    const rows = await this.db.execute<{
      slug: string; title: string; body: string; created_at: Date | string; name: string;
      project_slug: string; project_title: string; payload: { event?: string; withdrawnAt?: string; action?: string };
    }>(sql`SELECT n.slug,n.title,n.body,n.created_at,coalesce(e.name,n.recipient_employee_slug) AS name,
      p.slug AS project_slug,p.title AS project_title,n.payload
      FROM mvp_notification n JOIN team_project p ON p.slug=n.payload->>'projectSlug'
      LEFT JOIN employee e ON e.slug=n.recipient_employee_slug
      WHERE n.kind='team-invite' AND ${this.visibleFilter(actor)} ORDER BY n.created_at DESC,n.slug DESC`);
    return { projects, notifications: rows.map((row) => ({ id: row.slug, title: row.title, body: row.body,
      recipientName: row.name, projectSlug: row.project_slug, projectTitle: row.project_title,
      createdAt: new Date(row.created_at).toISOString(),
      event: row.payload.event === 'team-response' ? 'response' : 'invite',
      decision: row.payload.action === 'accepted' || row.payload.action === 'rejected' ? row.payload.action : null,
      state: row.payload.withdrawnAt ? 'withdrawn' : 'retained' })) };
  }

  async createProject(actor: TeamActor, body: unknown): Promise<TeamResponse> {
    if (actor.personnelRole === 'employee') throw new ForbiddenException('需要管理者工作台权限');
    if (typeof body !== 'object' || body === null) throw new BadRequestException('请求体必须为对象');
    const raw = body as { title?: unknown; department?: unknown; note?: unknown };
    if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 100) {
      throw new BadRequestException('方案名称需为 1~100 字');
    }
    if (typeof raw.department !== 'string' || !raw.department.trim() || raw.department.length > 128) {
      throw new BadRequestException('请选择方案归属部门');
    }
    const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 255) : null;

    const departments = await this.listDepartments();
    const department = raw.department.trim();
    if (!departments.includes(department)) throw new BadRequestException('归属部门无效，请从部门列表中选择');

    const slug = `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const inserted = await this.db
      .insert(teamProject)
      .values({
        slug,
        title: raw.title.trim(),
        department,
        note,
        creatorSlug: actor.employeeSlug,
        creatorName: actor.name,
        status: 'draft',
      })
      .returning({ id: teamProject.id });
    if (inserted.length === 0) throw new ConflictException('方案创建失败');
    await this.recordHistory(slug, actor, 'created', '创建组队方案');
    return this.buildResponse(actor, slug);
  }

  async listDepartments(): Promise<string[]> {
    const rows = await this.db.execute<{ department: string }>(
      sql`SELECT DISTINCT department FROM employee WHERE department IS NOT NULL AND department<>'' ORDER BY department`,
    );
    return rows.map((row) => row.department);
  }

  /* ==================== 角色 ==================== */

  async createRole(actor: TeamActor, body: unknown): Promise<TeamRole> {
    const input = await this.parseRoleInput(body);
    const projectSlug = this.parseProjectSlug(body);
    const project = await this.resolveProject(actor, projectSlug);
    this.assertEditable(project, '添加角色');

    const lastRows = await this.db
      .select({ sort: teamRole.sort })
      .from(teamRole)
      .where(eq(teamRole.projectSlug, project.slug))
      .orderBy(desc(teamRole.sort))
      .limit(1);
    const nextSort: number = (lastRows[0]?.sort ?? 0) + 1;
    const slug = `role-${project.slug}-${Date.now().toString(36)}`;

    const inserted = await this.db
      .insert(teamRole)
      .values({
        slug,
        projectSlug: project.slug,
        title: input.title,
        headcount: input.headcount,
        allocation: input.allocation,
        skills: input.skills.map((item) => ({ skillSlug: item.skillSlug, level: item.level, type: item.type })),
        candidateSlugs: [],
        sort: nextSort,
      })
      .returning({ id: teamRole.id });
    if (inserted.length === 0) throw new ConflictException('角色创建失败');

    await this.touchProject(project.slug);
    await this.recordHistory(project.slug, actor, 'role-created', `添加角色：${input.title}`);
    return (await this.buildResponse(actor, project.slug)).project.roles.find((role) => role.id === slug)!;
  }

  async updateRole(actor: TeamActor, roleSlug: string, body: unknown): Promise<TeamRole> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT p.slug FROM team_project p JOIN team_role r ON r.project_slug=p.slug WHERE r.slug=${roleSlug} FOR UPDATE OF p`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.updateRoleLocked(actor, roleSlug, body);
    });
  }

  private async updateRoleLocked(actor: TeamActor, roleSlug: string, body: unknown): Promise<TeamRole> {
    const input = await this.parseRoleInput(body);
    const [role] = await this.db.select().from(teamRole).where(eq(teamRole.slug, roleSlug)).limit(1);
    if (!role) throw new NotFoundException('未找到该角色');
    const project = await this.resolveProject(actor, role.projectSlug);
    this.assertEditable(project, '编辑角色需求');
    const members = await this.db.select().from(teamAssignment).where(eq(teamAssignment.roleSlug, roleSlug));
    if (members.length > input.headcount) throw new BadRequestException('需求人数不能少于已选成员数，请先移除多余成员');

    const updated = await this.db
      .update(teamRole)
      .set({
        title: input.title,
        headcount: input.headcount,
        allocation: input.allocation,
        skills: input.skills.map((item) => ({ skillSlug: item.skillSlug, level: item.level, type: item.type })),
        updatedAt: new Date(),
      })
      .where(eq(teamRole.slug, roleSlug))
      .returning({ id: teamRole.id });
    if (updated.length === 0) throw new NotFoundException('未找到该角色');
    await this.touchProject(project.slug);
    await this.recordHistory(project.slug, actor, 'role-updated', `调整角色需求：${input.title}`);
    return (await this.buildResponse(actor, project.slug)).project.roles.find((role) => role.id === roleSlug)!;
  }

  /* ==================== 指派 ==================== */

  async assign(actor: TeamActor, roleSlug: string, body: unknown): Promise<TeamResponse> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT p.slug FROM team_project p JOIN team_role r ON r.project_slug=p.slug WHERE r.slug=${roleSlug} FOR UPDATE OF p`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.assignLocked(actor, roleSlug, body);
    });
  }

  private async assignLocked(actor: TeamActor, roleSlug: string, body: unknown): Promise<TeamResponse> {
    const candidateSlug = this.parseCandidateSlug(body);

    const [role] = await this.db.select().from(teamRole).where(eq(teamRole.slug, roleSlug)).limit(1);
    if (!role) throw new NotFoundException('未找到该角色');
    const project = await this.resolveProject(actor, role.projectSlug);
    const current = await this.db.select().from(teamAssignment).where(eq(teamAssignment.roleSlug, roleSlug));
    if (project.status === 'adjusting') {
      if (current.length >= (role.headcount ?? 1) && !current.some((item) => item.response === 'rejected')) {
        throw new BadRequestException('该角色未被拒绝，调整成员请先重新打开组队');
      }
    } else {
      this.assertEditable(project, '选择成员');
    }
    if (current.some((item) => item.candidateSlug === candidateSlug)) {
      return this.buildResponse(actor, project.slug);
    }
    const [person] = await this.db.execute<{ slug: string }>(
      sql`SELECT slug FROM employee WHERE slug=${candidateSlug} AND status='active' LIMIT 1 FOR UPDATE`);
    if (!person) throw new BadRequestException('候选人不存在或已离职，请刷新后重试');
    const recent = (await this.recentParticipation(actor, project.slug)).get(candidateSlug) ?? [];
    if (recent.length && (body as { recentParticipationAcknowledged?: unknown }).recentParticipationAcknowledged !== true) {
      throw new ConflictException({ message: '该员工最近 90 天有其他组队记录，请查看并再次确认', code: 'TEAM_RECENT_PARTICIPATION', recentParticipations: recent });
    }
    const [other] = await this.db.execute<{ role_slug: string }>(sql`SELECT a.role_slug
      FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug
      WHERE r.project_slug=${project.slug} AND a.candidate_slug=${candidateSlug} AND a.role_slug<>${roleSlug}`);
    if (other) throw new BadRequestException('同一成员不能承担多个角色，请先移除原角色指派');
    if (current.length >= (role.headcount ?? 1)) {
      const rejected = project.status === 'adjusting' ? current.find((item) => item.response === 'rejected') : undefined;
      if (!rejected) throw new BadRequestException('该角色人数已满，请先移除需要替换的成员');
      await this.db.delete(teamAssignment).where(eq(teamAssignment.id, rejected.id));
    }
    await this.db.insert(teamAssignment).values({ roleSlug, candidateSlug });
    await this.recordHistory(project.slug, actor, 'assigned', `为「${role.title}」选择成员：${candidateSlug}`, candidateSlug);

    await this.touchProject(project.slug);
    return this.buildResponse(actor, project.slug);
  }

  async removeAssignment(actor: TeamActor, roleSlug: string, candidateSlug?: string): Promise<TeamResponse> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT p.slug FROM team_project p JOIN team_role r ON r.project_slug=p.slug WHERE r.slug=${roleSlug} FOR UPDATE OF p`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.removeAssignmentLocked(actor, roleSlug, candidateSlug);
    });
  }

  private async removeAssignmentLocked(actor: TeamActor, roleSlug: string, candidateSlug?: string): Promise<TeamResponse> {
    const [role] = await this.db.select().from(teamRole).where(eq(teamRole.slug, roleSlug)).limit(1);
    if (!role) throw new NotFoundException('未找到该角色');
    const project = await this.resolveProject(actor, role.projectSlug);
    const members = await this.db.select().from(teamAssignment).where(eq(teamAssignment.roleSlug, roleSlug));
    if (!candidateSlug && members.length > 1) throw new BadRequestException('请指定要移除的成员');
    const member = members.find((item) => !candidateSlug || item.candidateSlug === candidateSlug);
    if (!member) throw new NotFoundException('该成员未被指派到此角色');
    if (project.status === 'adjusting') {
      if (member.response !== 'rejected') throw new BadRequestException('仅允许移除已拒绝的成员，调整其他成员请先重新打开组队');
    } else {
      this.assertEditable(project, '解除指派');
    }
    await this.db.delete(teamAssignment).where(eq(teamAssignment.id, member.id));
    await this.recordHistory(project.slug, actor, 'removed', `从「${role.title}」移除成员：${member.candidateSlug}`, member.candidateSlug);
    await this.touchProject(project.slug);
    return this.buildResponse(actor, project.slug);
  }

  async clearAssignments(actor: TeamActor, projectSlug: string | undefined): Promise<TeamResponse> {
    return this.db.transaction(async (tx) => {
      const project = await this.resolveProject(actor, projectSlug);
      await tx.execute(sql`SELECT p.slug FROM team_project p WHERE p.slug=${project.slug} FOR UPDATE`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.clearAssignmentsLocked(actor, projectSlug);
    });
  }

  private async clearAssignmentsLocked(actor: TeamActor, projectSlug: string | undefined): Promise<TeamResponse> {
    const project = await this.resolveProject(actor, projectSlug);
    this.assertEditable(project, '清空指派');
    await this.recordHistory(project.slug, actor, 'before-clear', '清空前的团队成员快照');
    await this.db.execute(sql`DELETE FROM team_assignment a USING team_role r
      WHERE a.role_slug=r.slug AND r.project_slug=${project.slug}`);
    await this.recordHistory(project.slug, actor, 'cleared', '已清空当前指派，历史成员仍保留');
    await this.touchProject(project.slug);
    return this.buildResponse(actor, project.slug);
  }

  /* ==================== 状态流转 ==================== */

  async changeStatus(actor: TeamActor, body: unknown): Promise<TeamResponse> {
    return this.db.transaction(async (tx) => {
      const project = await this.resolveProject(actor, this.parseProjectSlug(body));
      await tx.execute(sql`SELECT p.slug FROM team_project p WHERE p.slug=${project.slug} FOR UPDATE`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.changeStatusLocked(actor, body);
    });
  }

  private async changeStatusLocked(actor: TeamActor, body: unknown): Promise<TeamResponse> {
    const input = this.parseStatusInput(body);
    const project = await this.resolveProject(actor, input.project);

    if (input.action === 'confirm') {
      if (project.status === 'confirming') throw new BadRequestException('方案已在协调确认中');
      if (project.status === 'confirmed') throw new BadRequestException('方案已全员确认，如需调整请先重新打开组队');
      await this.assertConfirmable(actor, project.slug);
      // 保留已接受的响应，仅向待响应成员生成站内邀请。
      await this.db.execute(sql`UPDATE team_assignment a SET response='pending', responded_at=NULL, reject_note=NULL, response_source='employee', _updated_at=now()
        FROM team_role r WHERE a.role_slug=r.slug AND r.project_slug=${project.slug} AND a.response<>'accepted'`);
      await this.db.execute(sql`UPDATE mvp_notification SET payload=payload||jsonb_build_object('withdrawnAt',now()),read_at=coalesce(read_at,now())
        WHERE kind='team-invite' AND read_at IS NULL AND payload->>'projectSlug'=${project.slug}
          AND coalesce(payload->>'event','')<>'team-response'`);
      const notifyRows = await this.db.execute<{ role_slug: string; role_title: string; candidate_slug: string; project_title: string; creator_name: string | null }>(
        sql`SELECT r.slug AS role_slug, r.title AS role_title, a.candidate_slug, p.title AS project_title, p.creator_name
          FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug JOIN team_project p ON p.slug=r.project_slug
          WHERE r.project_slug=${project.slug} AND a.response='pending'`);
      for (const row of notifyRows) {
        await this.db.execute(sql`INSERT INTO mvp_notification
          (slug, recipient_employee_slug, kind, title, body, link, payload, sent_via_feishu)
          VALUES (${`ti-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`},
            ${row.candidate_slug}, 'team-invite',
            ${`组队邀请：${row.project_title}`},
            ${`${row.creator_name ?? '项目发起人'} 邀请你担任「${row.role_title}」，请在首页接受或拒绝。`},
            NULL,
            ${JSON.stringify({ projectSlug: project.slug, roleSlug: row.role_slug, roleTitle: row.role_title, projectTitle: row.project_title, creatorName: row.creator_name ?? '' })}::jsonb,
            false)`);
      }
      await this.db
        .update(teamProject)
        .set({ status: 'confirming', updatedAt: new Date() })
        .where(eq(teamProject.slug, project.slug));
    } else {
      await this.recordHistory(project.slug, actor, 'before-reopen', '重新打开前的方案与成员响应快照');
      // reopen：回到草稿，撤回未读邀请并清空响应
      await this.db.execute(sql`UPDATE mvp_notification SET payload=payload||jsonb_build_object('withdrawnAt',now()),read_at=coalesce(read_at,now())
        WHERE kind='team-invite' AND read_at IS NULL AND payload->>'projectSlug'=${project.slug}
          AND coalesce(payload->>'event','')<>'team-response'`);
      await this.db.execute(sql`UPDATE team_assignment a SET response='pending', responded_at=NULL, reject_note=NULL, response_source='employee', _updated_at=now()
        FROM team_role r WHERE a.role_slug=r.slug AND r.project_slug=${project.slug}`);
      await this.db
        .update(teamProject)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(teamProject.slug, project.slug));
    }

    await this.recordHistory(project.slug, actor, input.action === 'confirm' ? 'coordinating' : 'reopened',
      input.action === 'confirm' ? '发起协调并保留通知记录' : '重新打开为草稿');
    return this.buildResponse(actor, project.slug);
  }

  /** 校验方案可进入协调确认：角色≥1、全部指派、无硬冲突、无未处理拒绝 */
  private async assertConfirmable(actor: TeamActor, projectSlug: string): Promise<void> {
    const roles = await this.db
      .select({ slug: teamRole.slug, headcount: teamRole.headcount })
      .from(teamRole)
      .where(eq(teamRole.projectSlug, projectSlug));
    if (roles.length === 0) throw new BadRequestException('请先添加项目角色，再进入协调确认');
    const assignments = await this.db.execute<AssignmentRow>(sql`SELECT a.role_slug,a.candidate_slug,a.response,a.responded_at,a.reject_note,a.response_source
      FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug WHERE r.project_slug=${projectSlug}`);
    const missing = roles.reduce((sum, role) => sum + Math.max(0,
      (role.headcount ?? 1) - assignments.filter((item) => item.role_slug === role.slug).length), 0);
    if (missing > 0) throw new BadRequestException(`还有 ${missing} 个成员名额未配置，无法进入协调确认`);
    if (roles.some((role) => assignments.filter((item) => item.role_slug === role.slug).length > (role.headcount ?? 1))) {
      throw new BadRequestException('已选成员超过角色需求人数，请先调整');
    }
    const rejected = assignments.filter((row) => row.response === 'rejected');
    if (rejected.length > 0) {
      throw new BadRequestException(`还有 ${rejected.length} 位成员拒绝了邀请，请先为对应角色重新选择人员`);
    }
    const seen = new Set<string>();
    for (const assignment of assignments) {
      if (seen.has(assignment.candidate_slug)) throw new BadRequestException('同一成员被选入多个角色，请先调整后再确认');
      seen.add(assignment.candidate_slug);
    }
    const view = await this.buildResponse(actor, projectSlug);
    if (view.project.conflicts.length) throw new BadRequestException('存在待处理冲突，调整后才能进入协调确认');
  }

  /* ==================== 员工响应 ==================== */

  async listInvites(actor: TeamActor): Promise<TeamInviteItem[]> {
    const rows = await this.db.execute<{
      role_slug: string; role_title: string; project_slug: string; project_title: string;
      creator_name: string | null; created_at: string | Date; response: string; reject_note: string | null; response_source: string;
    }>(sql`SELECT r.slug AS role_slug, r.title AS role_title, p.slug AS project_slug, p.title AS project_title,
        p.creator_name, a._created_at AS created_at,a.response,a.reject_note,a.response_source
      FROM team_assignment a
      JOIN team_role r ON r.slug=a.role_slug
      JOIN team_project p ON p.slug=r.project_slug
      WHERE a.candidate_slug=${actor.employeeSlug}
        AND p.status IN ('confirming','adjusting','confirmed')
      ORDER BY a._created_at DESC LIMIT 20`);
    return rows.map((row) => ({
      id: `${row.project_slug}:${row.role_slug}`,
      projectSlug: row.project_slug,
      projectTitle: row.project_title,
      roleSlug: row.role_slug,
      roleTitle: row.role_title,
      creatorName: row.creator_name ?? '',
      createdAt: new Date(row.created_at).toISOString(),
      state: this.parseResponseState(row.response),
      note: row.reject_note,
      source: row.response_source === 'mock' ? 'mock' : row.response_source === 'feishu' ? 'feishu' : 'employee',
    }));
  }

  async respond(actor: TeamActor, body: unknown, source: 'employee' | 'feishu' = 'employee'): Promise<TeamInviteItem[]> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT p.slug FROM team_project p JOIN team_role r ON r.project_slug=p.slug WHERE r.slug=${String((body as { roleSlug?: unknown } | null)?.roleSlug ?? '')} FOR UPDATE OF p`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      return service.respondLocked(actor, body, source);
    });
  }

  async mockResponse(actor: TeamActor, body: unknown): Promise<TeamResponse> {
    if ((process.env.LOCAL_DEMO !== 'true' || process.env.FEISHU_MODE === 'real')) throw new ForbiddenException('模拟响应仅在本机演示环境可用');
    if (typeof body !== 'object' || !body) throw new BadRequestException('请求体必须为对象');
    const raw = body as { project?: unknown; roleSlug?: unknown; candidateSlug?: unknown };
    if (typeof raw.project !== 'string' || typeof raw.roleSlug !== 'string' || typeof raw.candidateSlug !== 'string') {
      throw new BadRequestException('请指定方案、角色和成员');
    }
    const { project: projectSlug, roleSlug, candidateSlug } = raw;
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT slug FROM team_project WHERE slug=${projectSlug} FOR UPDATE`);
      const service = new TeamService(tx as unknown as PostgresJsDatabase);
      const project = await service.resolveProject(actor, projectSlug);
      if (actor.personnelRole !== 'hr' && project.creatorSlug !== actor.employeeSlug) {
        throw new ForbiddenException('仅组建者或 HR 可模拟成员响应');
      }
      const [role] = await tx.select().from(teamRole).where(eq(teamRole.slug, roleSlug));
      if (!role || role.projectSlug !== projectSlug) throw new BadRequestException('角色不属于该方案');
      await service.respondLocked({ ...actor, employeeSlug: candidateSlug }, body, 'mock');
      return service.buildResponse(actor, projectSlug);
    });
  }

  private async respondLocked(actor: TeamActor, body: unknown, source: 'mock' | 'employee' | 'feishu' = 'employee'): Promise<TeamInviteItem[]> {
    if (typeof body !== 'object' || body === null) throw new BadRequestException('请求体必须为对象');
    const raw = body as { roleSlug?: unknown; project?: unknown; action?: unknown; note?: unknown };
    if (typeof raw.roleSlug !== 'string' || !raw.roleSlug) throw new BadRequestException('roleSlug 必填');
    if (raw.action !== 'accept' && raw.action !== 'reject') throw new BadRequestException('action 需为 accept 或 reject');
    if (raw.note !== undefined && (typeof raw.note !== 'string' || raw.note.length > 255)) throw new BadRequestException('拒绝理由最多 255 字');
    const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : null;

    const [assignment] = await this.db
      .select()
      .from(teamAssignment)
      .where(and(eq(teamAssignment.roleSlug, raw.roleSlug), eq(teamAssignment.candidateSlug, actor.employeeSlug)))
      .limit(1);
    if (!assignment || assignment.candidateSlug !== actor.employeeSlug) {
      throw new ForbiddenException('未找到发给你的组队邀请');
    }
    const [role] = await this.db.select().from(teamRole).where(eq(teamRole.slug, raw.roleSlug)).limit(1);
    if (!role) throw new NotFoundException('未找到该角色');
    const [project] = await this.db.select().from(teamProject).where(eq(teamProject.slug, role.projectSlug)).limit(1);
    if (!project || (project.status !== 'confirming' && project.status !== 'adjusting')) {
      throw new BadRequestException('该方案当前不在协调确认流程中');
    }
    if (assignment.response !== 'pending') {
      throw new BadRequestException('你已对该邀请作出过响应');
    }

    await this.db
      .update(teamAssignment)
      .set({
        response: raw.action === 'accept' ? 'accepted' : 'rejected',
        respondedAt: new Date(),
        rejectNote: raw.action === 'reject' ? note : null,
        responseSource: source,
        updatedAt: new Date(),
      })
      .where(and(eq(teamAssignment.roleSlug, raw.roleSlug), eq(teamAssignment.candidateSlug, actor.employeeSlug)));

    // 依响应结果推进方案状态：任一拒绝→adjusting；全部接受→confirmed
    const states = await this.db.execute<{ response: string }>(sql`SELECT a.response
      FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug WHERE r.project_slug=${project.slug}`);
    const hasRejected = states.some((row) => row.response === 'rejected');
    const [{ required }] = await this.db.execute<{ required: number }>(sql`SELECT coalesce(sum(headcount),0)::int AS required FROM team_role WHERE project_slug=${project.slug}`);
    const allAccepted = states.length === required && required > 0 && states.every((row) => row.response === 'accepted');
    const nextStatus: TeamStatus = hasRejected ? 'adjusting' : allAccepted ? 'confirmed' : 'confirming';
    await this.db.update(teamProject)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(teamProject.slug, project.slug));
    // 在事务内生成组建者通知；真实通道异步发送，并按实际结果记录送达状态。
    if (project.creatorSlug) {
      const [person] = await this.db.execute<{ name: string }>(sql`SELECT name FROM employee WHERE slug=${actor.employeeSlug}`);
      const decision = raw.action === 'accept' ? '已接受' : '已拒绝';
      const body = `${person?.name ?? actor.employeeSlug} ${decision}「${project.title}」的「${role.title}」邀请。`
        + (raw.action === 'reject' ? `拒绝理由：${note ?? '未填写理由'}。` : '')
        + (nextStatus === 'confirmed' ? '全员已接受，组建完成。' : '');
      await this.db.execute(sql`INSERT INTO mvp_notification
        (slug,recipient_employee_slug,kind,title,body,link,payload,sent_via_feishu)
        VALUES (${`tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`},
          ${project.creatorSlug},'team-invite',${`成员${decision}：${project.title}`},${body},NULL,
          ${JSON.stringify({ event: 'team-response', projectSlug: project.slug, roleSlug: role.slug,
            candidateSlug: actor.employeeSlug, action: raw.action === 'accept' ? 'accepted' : 'rejected', source, channel: source === 'mock' ? 'feishu-mock' : 'in-app' })}::jsonb,false)`);
    }
    const [respondent] = await this.db.execute<{ name: string }>(sql`SELECT name FROM employee WHERE slug=${actor.employeeSlug}`);
    await this.recordHistory(project.slug, { ...actor, name: respondent?.name ?? actor.name }, 'response',
      `${source === 'mock' ? 'Mock：' : ''}${raw.action === 'accept' ? '接受' : '拒绝'}「${role.title}」邀请${note && raw.action === 'reject' ? `，理由：${note}` : ''}${nextStatus === 'confirmed' ? '；全员接受，组建完成' : ''}`,
      actor.employeeSlug, raw.action === 'accept' ? 'accepted' : 'rejected');
    return this.listInvites(actor);
  }

  /* ==================== 视图组装 ==================== */

  /** 组装完整视图：方案列表 + 角色 + 服务端真实计算的候选推荐 + 冲突与覆盖 + 响应状态 */
  async buildResponse(actor: TeamActor, projectSlug?: string): Promise<TeamResponse> {
    const project = await this.resolveProject(actor, projectSlug);
    const [roles, assignments, population, projects] = await Promise.all([
      this.db
        .select()
        .from(teamRole)
        .where(eq(teamRole.projectSlug, project.slug))
        .orderBy(asc(teamRole.sort)),
      this.db.execute<AssignmentRow>(sql`SELECT a.role_slug,a.candidate_slug,a.response,a.responded_at,a.reject_note,a.response_source
        FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug WHERE r.project_slug=${project.slug}`),
      this.loadPopulation(),
      this.listProjects(actor),
    ]);

    const assignmentMap: TeamProjectView['assignments'] = {};
    const responseMap: TeamProjectView['responses'] = {};
    const candidateRoles = new Map<string, string[]>();
    for (const row of assignments) {
      (assignmentMap[row.role_slug] ??= []).push(row.candidate_slug);
      (responseMap[row.role_slug] ??= {})[row.candidate_slug] = {
        state: this.parseResponseState(row.response),
        respondedAt: row.responded_at ? new Date(row.responded_at).toISOString() : null,
        note: row.reject_note,
        source: row.response_source === 'mock' ? 'mock' : row.response_source === 'feishu' ? 'feishu' : 'employee',
      };
      const list = candidateRoles.get(row.candidate_slug) ?? [];
      list.push(row.role_slug);
      candidateRoles.set(row.candidate_slug, list);
    }

    const declined = await this.declinedCandidates(project.slug);
    const recent = await this.recentParticipation(actor, project.slug);
    const roleViews: TeamRole[] = [];
    for (const row of roles) {
      const skills = normalizeSkills(row.skills, population.skillNames);
      const recommendations = this.recommendForRole(
        skills,
        row.slug,
        row.allocation ?? '',
        assignmentMap[row.slug] ?? [],
        candidateRoles,
        population,
        population.people.length,
      ).map((option) => ({ ...option, declinedPreviously: declined.has(option.candidateSlug),
        recentParticipations: recent.get(option.candidateSlug) ?? [] }));
      roleViews.push({
        id: row.slug,
        title: row.title,
        headcount: row.headcount ?? 1,
        allocation: row.allocation ?? '',
        skills: skills.map((item) => ({ skillSlug: item.skillSlug, level: item.level, type: item.type, name: item.name })),
        recommendations: recommendations.filter((option) => !option.declinedPreviously).slice(0, MAX_RECOMMENDATIONS),
        members: recommendations.filter((option) => option.assignedHere),
      });
    }

    const { conflicts, skillCoverage, pendingAvailabilityCount } = this.evaluatePlan(
      roleViews,
      assignmentMap,
      candidateRoles,
      population,
    );

    const notifications = await this.db.execute<{
      slug: string; title: string; body: string; created_at: string | Date;
      payload: { action: 'accepted' | 'rejected'; candidateSlug: string; source: 'mock' | 'employee' | 'feishu'; channel?: 'feishu-mock' | 'feishu' | 'in-app' };
    }>(sql`SELECT slug,title,body,created_at,payload FROM mvp_notification
      WHERE kind='team-invite' AND payload->>'event'='team-response'
        AND payload->>'projectSlug'=${project.slug} AND recipient_employee_slug=${project.creatorSlug ?? ''}
      ORDER BY created_at DESC,slug DESC`);
    const historyRows = await this.db.execute<{ id: string; event: string; actor_name: string; description: string; created_at: string | Date; snapshot: TeamHistoryRecord['snapshot'] }>(
      sql`SELECT id,event,actor_name,description,created_at,snapshot FROM team_history WHERE project_slug=${project.slug} ORDER BY created_at DESC,id DESC`);
    const coordinationRows = await this.db.execute<{ slug: string; title: string; body: string; created_at: Date | string; name: string; payload: { event?: string; withdrawnAt?: string; action?: string } }>(
      sql`SELECT n.slug,n.title,n.body,n.created_at,coalesce(e.name,n.recipient_employee_slug) AS name,n.payload
        FROM mvp_notification n LEFT JOIN employee e ON e.slug=n.recipient_employee_slug
        WHERE n.kind='team-invite' AND n.payload->>'projectSlug'=${project.slug} ORDER BY n.created_at DESC,n.slug DESC`);
    return {
      project: {
        id: project.slug,
        title: project.title,
        period: project.period ?? '',
        note: project.note ?? '',
        status: this.parseStatus(project.status) as TeamStatus,
        updatedAt: project.updatedAt ? new Date(project.updatedAt).toISOString() : null,
        department: project.department ?? '',
        creatorSlug: project.creatorSlug ?? '',
        creatorName: project.creatorName ?? '',
        roles: roleViews,
        assignments: assignmentMap,
        responses: responseMap,
        skillCoverage,
        conflicts,
        pendingAvailabilityCount,
        mockResponsesEnabled: process.env.LOCAL_DEMO === 'true' && process.env.FEISHU_MODE !== 'real'
          && (actor.personnelRole === 'hr' || project.creatorSlug === actor.employeeSlug),
        history: historyRows.map((row) => ({ id: row.id, event: row.event, actorName: row.actor_name,
          description: row.description, createdAt: new Date(row.created_at).toISOString(), snapshot: row.snapshot })),
        coordinationNotifications: coordinationRows.map((row) => ({ id: row.slug, title: row.title, body: row.body,
          recipientName: row.name, createdAt: new Date(row.created_at).toISOString(),
          event: row.payload.event === 'team-response' ? 'response' as const : 'invite' as const,
          decision: row.payload.action === 'accepted' || row.payload.action === 'rejected' ? row.payload.action : null,
          state: row.payload.withdrawnAt ? 'withdrawn' as const : 'retained' as const })),
        responseNotifications: notifications.map((item) => ({
          id: item.slug, title: item.title, body: item.body,
          createdAt: new Date(item.created_at).toISOString(), ...item.payload, channel: item.payload.channel ?? (item.payload.source === 'mock' ? 'feishu-mock' as const : 'in-app' as const),
        })),
      },
      projects,
    };
  }

  async searchCandidates(actor: TeamActor, roleSlug: string, query: unknown): Promise<TeamCandidateSearchResponse> {
    if (typeof query !== 'string' || query.length > 100) throw new BadRequestException('搜索词最多 100 字');
    const [role] = await this.db.select().from(teamRole).where(eq(teamRole.slug, roleSlug));
    if (!role) throw new NotFoundException('未找到该角色');
    await this.resolveProject(actor, role.projectSlug);
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return { candidates: [], total: 0 };
    const population = await this.loadPopulation();
    population.people = population.people.filter((person) =>
      [person.name, person.slug, person.department, person.org, person.role]
        .some((value) => value?.toLocaleLowerCase().includes(keyword)));
    const assignments = await this.db.execute<{ role_slug: string; candidate_slug: string }>(sql`SELECT a.role_slug,a.candidate_slug
      FROM team_assignment a JOIN team_role r ON r.slug=a.role_slug WHERE r.project_slug=${role.projectSlug}`);
    const candidateRoles = new Map<string, string[]>();
    for (const item of assignments) candidateRoles.set(item.candidate_slug, [...(candidateRoles.get(item.candidate_slug) ?? []), item.role_slug]);
    const declined = await this.declinedCandidates(role.projectSlug);
    const recent = await this.recentParticipation(actor, role.projectSlug);
    return {
      candidates: this.recommendForRole(normalizeSkills(role.skills, population.skillNames), roleSlug,
        role.allocation ?? '', assignments.filter((item) => item.role_slug === roleSlug).map((item) => item.candidate_slug),
        candidateRoles, population, 50).map((option) => ({ ...option, declinedPreviously: declined.has(option.candidateSlug),
          recentParticipations: recent.get(option.candidateSlug) ?? [] })),
      total: population.people.length,
    };
  }

  private async loadPopulation(): Promise<{
    people: PersonRow[];
    levels: Map<string, Map<string, number>>;
    skillNames: Map<string, string>;
    catalogNames: string[];
  }> {
    const [people, skills, catalog] = await Promise.all([
      this.db.execute<PersonRow>(sql`SELECT e.slug,e.name,e.avatar_text,e.avatar_tone,e.department,e.org,e.role,e.availability
        FROM employee e WHERE e.status='active' ORDER BY e.name,e.slug`),
      this.db.execute<SkillRow>(sql`SELECT s.employee_slug,s.skill_slug,k.name,max(s.level)::int AS level
        FROM mvp_employee_skill s JOIN skill k ON k.slug=s.skill_slug
        WHERE s.status='active' AND s.certified_at<=now() AND (s.review_due_at IS NULL OR s.review_due_at>=now())
        GROUP BY s.employee_slug,s.skill_slug,k.name`),
      this.db.execute<{ slug: string; name: string }>(sql`SELECT slug,name FROM skill`),
    ]);
    const levels = new Map<string, Map<string, number>>();
    for (const row of skills) {
      const map = levels.get(row.employee_slug) ?? new Map<string, number>();
      map.set(row.skill_slug, Math.max(map.get(row.skill_slug) ?? 0, row.level));
      levels.set(row.employee_slug, map);
    }
    const skillNames = new Map(catalog.map((item) => [item.slug, item.name]));
    return {
      people: [...people],
      levels,
      skillNames,
      catalogNames: catalog.map((item) => item.name),
    };
  }

  /** 按角色的技能条件对全员计算匹配分，返回排序后的推荐候选。 */
  private recommendForRole(
    skills: NormalizedSkill[],
    roleSlug: string,
    allocation: string,
    assignedCandidates: string[],
    candidateRoles: Map<string, string[]>,
    population: Awaited<ReturnType<TeamService['loadPopulation']>>,
    limit = MAX_RECOMMENDATIONS,
  ): TeamCandidateOption[] {
    const required = skills.filter((item) => item.type === 'required');
    const bonus = skills.filter((item) => item.type === 'bonus');
    const allocationPercent = parseAllocationPercent(allocation);

    const options: TeamCandidateOption[] = population.people.map((person) => {
      const personLevels = population.levels.get(person.slug) ?? new Map<string, number>();
      const matchOf = (item: NormalizedSkill) => (personLevels.get(item.skillSlug) ?? 0) >= item.level;
      const requiredMet = required.filter(matchOf).length;
      const bonusMet = bonus.filter(matchOf).length;
      const tier: TeamCandidateOption['tier'] =
        required.length === 0
          ? bonusMet === bonus.length && bonus.length > 0 ? 'direct' : 'potential'
          : requiredMet === required.length ? 'direct'
          : requiredMet > 0 ? 'adjacent'
          : 'potential';
      const percent = parseAvailabilityPercent(person.availability);
      const evidence = [
        ...required.filter(matchOf).map((item) => `${item.name} L${personLevels.get(item.skillSlug)}`),
        ...bonus.filter(matchOf).map((item) => `${item.name} L${personLevels.get(item.skillSlug)}`),
      ].slice(0, 6);
      const assignedHere = assignedCandidates.includes(person.slug);
      const otherSlug = (candidateRoles.get(person.slug) ?? []).find((slug) => slug !== roleSlug) ?? null;
      return {
        candidateSlug: person.slug,
        declinedPreviously: false,
        recentParticipations: [],
        name: person.name,
        avatar: person.avatar_text || person.name.slice(-2),
        avatarTone: person.avatar_tone || 'blue',
        org: person.department || person.org || '未登记部门',
        roleTitle: person.role || '未登记岗位',
        requiredMet,
        requiredTotal: required.length,
        bonusMet,
        bonusTotal: bonus.length,
        score: Math.round((required.length ? (requiredMet / required.length) * 100 : 0) + (bonus.length ? (bonusMet / bonus.length) * 20 : 0)),
        tier,
        evidence,
        availabilityText: percent === null ? '投入待确认' : `可投入 ${percent}%`,
        availabilityPercent: percent,
        assignedHere,
        assignedElsewhere: otherSlug,
        insufficient: percent !== null && allocationPercent > 0 && percent < allocationPercent,
      };
    });

    const tierRank = { direct: 0, adjacent: 1, potential: 2 } as const;
    options.sort((a, b) =>
      Number(b.assignedHere) - Number(a.assignedHere)
      || tierRank[a.tier] - tierRank[b.tier]
      || b.score - a.score
      || b.requiredMet - a.requiredMet
      || a.name.localeCompare(b.name, 'zh-CN'),
    );
    return options.slice(0, Math.max(limit, assignedCandidates.length));
  }

  private evaluatePlan(
    roleViews: TeamRole[],
    assignmentMap: TeamProjectView['assignments'],
    candidateRoles: Map<string, string[]>,
    population: Awaited<ReturnType<TeamService['loadPopulation']>>,
  ): { conflicts: TeamConflictItem[]; skillCoverage: number; pendingAvailabilityCount: number } {
    const conflicts: TeamConflictItem[] = [];
    const roleTitleById = new Map(roleViews.map((role) => [role.id, role.title]));

    // 硬冲突 1：同一成员被选入多个角色
    for (const [candidateSlug, slugs] of candidateRoles) {
      if (slugs.length <= 1) continue;
      const person = population.people.find((item) => item.slug === candidateSlug);
      const titles = slugs.map((slug) => roleTitleById.get(slug) ?? slug).join('、');
      conflicts.push({
        kind: 'multi-role',
        candidateSlug,
        name: person?.name ?? candidateSlug,
        detail: `被同时选入 ${titles}，需要为其中一个角色另选人选`,
      });
    }

    let coverageSum = 0;
    let pendingAvailabilityCount = 0;
    for (const role of roleViews) {
      const members = assignmentMap[role.id] ?? [];
      const requiredTotal = role.skills.filter((item) => item.type === 'required').length;
      for (const assigned of members) {
        const person = population.people.find((item) => item.slug === assigned);
        const personLevels = population.levels.get(assigned) ?? new Map<string, number>();
        const met = role.skills
          .filter((item) => item.type === 'required')
          .filter((item) => (personLevels.get(item.skillSlug) ?? 0) >= item.level).length;
        coverageSum += requiredTotal > 0 ? met / requiredTotal : 1;

        // 硬冲突 2：已登记的可投入比例低于角色要求
        const percent = parseAvailabilityPercent(person?.availability ?? null);
        if (percent === null) {
          pendingAvailabilityCount += 1;
        } else {
          const allocationPercent = parseAllocationPercent(role.allocation);
          if (allocationPercent > 0 && percent < allocationPercent) {
            conflicts.push({
              kind: 'insufficient-availability',
              candidateSlug: assigned,
              name: person?.name ?? assigned,
              detail: `可投入 ${percent}%，低于「${role.title}」要求的 ${role.allocation}`,
            });
          }
        }
      }
    }

    const requiredHeadcount = roleViews.reduce((sum, role) => sum + role.headcount, 0);
    return {
      conflicts,
      skillCoverage: requiredHeadcount ? Math.round((coverageSum / requiredHeadcount) * 100) : 0,
      pendingAvailabilityCount,
    };
  }

  /* ==================== 解析与校验 ==================== */

  private async resolveProject(actor: TeamActor, projectSlug?: string): Promise<ProjectRow> {
    if (projectSlug) {
      const [row] = await this.db.select().from(teamProject).where(eq(teamProject.slug, projectSlug)).limit(1);
      if (!row) throw new NotFoundException('未找到组队方案');
      if (actor.personnelRole !== 'hr'
        && row.department !== actor.department
        && row.creatorSlug !== actor.employeeSlug) {
        throw new ForbiddenException('无权访问其他部门的组队方案');
      }
      return row;
    }
    const rows = await this.db.execute<{ slug: string }>(
      sql`SELECT p.slug FROM team_project p WHERE ${this.visibleFilter(actor)} ORDER BY p._updated_at DESC LIMIT 1`,
    );
    if (!rows[0]) throw new NotFoundException('暂无可见的组队方案，请先创建');
    const [row] = await this.db.select().from(teamProject).where(eq(teamProject.slug, rows[0].slug)).limit(1);
    if (!row) throw new NotFoundException('未找到组队方案');
    return row;
  }

  /** 编辑锁：仅 draft 可自由编辑；adjusting 只允许为被拒角色重选人员（assign/remove 处单独放行） */
  private assertEditable(project: ProjectRow, actionLabel: string): void {
    if (project.status === 'confirming') {
      throw new BadRequestException(`方案正在协调确认中，${actionLabel}前请先重新打开组队`);
    }
    if (project.status === 'adjusting') {
      throw new BadRequestException(`方案有成员拒绝待调整，${actionLabel}仅支持为被拒绝的角色重选人员`);
    }
    if (project.status === 'confirmed') {
      throw new BadRequestException(`方案已全员确认，${actionLabel}前请先重新打开组队`);
    }
  }

  private async touchProject(slug: string): Promise<void> {
    await this.db.update(teamProject).set({ updatedAt: new Date() }).where(eq(teamProject.slug, slug));
  }

  private parseStatus(value: string | null): TeamStatus {
    return value === 'confirming' || value === 'adjusting' || value === 'confirmed' ? value : 'draft';
  }

  private parseResponseState(value: string | null): TeamAssignmentResponseState {
    return value === 'accepted' || value === 'rejected' ? value : 'pending';
  }

  private parseProjectSlug(body: unknown): string | undefined {
    if (typeof body === 'object' && body !== null && typeof (body as { project?: unknown }).project === 'string') {
      return (body as { project: string }).project || undefined;
    }
    return undefined;
  }

  private async parseRoleInput(body: unknown): Promise<CreateTeamRoleInput> {
    if (typeof body !== 'object' || body === null) throw new BadRequestException('请求体必须为对象');
    const raw = body as { title?: unknown; allocation?: unknown; headcount?: unknown; skills?: unknown };
    if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 100) {
      throw new BadRequestException('角色名称需为 1~100 字');
    }
    const allocation = typeof raw.allocation === 'string' ? raw.allocation.trim() : '';
    const allocationPercent = parseAllocationPercent(allocation);
    if (allocationPercent < 10 || allocationPercent > 100 || !/^\d{2,3}\s*%$/.test(allocation)) {
      throw new BadRequestException('投入比例需为 10%~100% 的整数百分比');
    }
    const headcount = Number.isInteger(raw.headcount) ? Number(raw.headcount) : 0;
    if (headcount < 1 || headcount > 20) throw new BadRequestException('人数需为 1~20');

    const catalog = await this.db.execute<{ slug: string }>(sql`SELECT slug FROM skill`);
    const known = new Set(catalog.map((item) => item.slug));
    if (!Array.isArray(raw.skills) || raw.skills.length === 0 || raw.skills.length > 30) {
      throw new BadRequestException('每角色需设置 1~30 项技能');
    }
    const used = new Set<string>();
    const skills: TeamRoleSkillInput[] = (raw.skills as RawSkill[]).map((item): TeamRoleSkillInput => {
      const skillSlug = (item as { skillSlug?: unknown })?.skillSlug;
      const level = (item as { level?: unknown })?.level;
      const type = (item as { type?: unknown })?.type;
      if (typeof skillSlug !== 'string' || !known.has(skillSlug) || used.has(skillSlug)) {
        throw new BadRequestException('技能无效或重复，请从技能目录中选择');
      }
      if (!Number.isInteger(level) || Number(level) < 1 || Number(level) > 5) {
        throw new BadRequestException('技能等级需为 L1~L5');
      }
      if (type !== 'required' && type !== 'bonus') throw new BadRequestException('技能类型无效');
      used.add(skillSlug);
      return { skillSlug, level: Number(level), type };
    });
    return { title: raw.title.trim(), allocation, headcount, skills };
  }

  private parseCandidateSlug(body: unknown): string {
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as { candidateSlug?: unknown }).candidateSlug !== 'string' ||
      (body as { candidateSlug: string }).candidateSlug.length === 0
    ) {
      throw new BadRequestException('candidateSlug 必须为非空字符串');
    }
    return (body as { candidateSlug: string }).candidateSlug;
  }

  private parseStatusInput(body: unknown): TeamStatusInput {
    const action = typeof body === 'object' && body !== null ? (body as { action?: unknown }).action : undefined;
    if (action !== 'confirm' && action !== 'reopen') throw new BadRequestException('action 需为 confirm 或 reopen');
    return { action, project: this.parseProjectSlug(body) };
  }
}
