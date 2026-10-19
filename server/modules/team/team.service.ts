import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
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
  TeamResponse,
  TeamRole,
  TeamRoleSkill,
} from '@shared/api.interface';

const PREFERRED_PROJECT_SLUG = 'embodied-intelligence';

type ProjectRow = typeof teamProject.$inferSelect;
type RoleRow = typeof teamRole.$inferSelect;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is string => typeof item === 'string');
}

function toTeamSkills(value: unknown): TeamRoleSkill[] {
  if (!Array.isArray(value)) return [];
  const result: TeamRoleSkill[] = [];
  for (const item of value) {
    if (typeof item === 'object' && item !== null && 'name' in item && 'type' in item) {
      const obj = item as { name: unknown; type: unknown };
      if (typeof obj.name === 'string' && (obj.type === 'required' || obj.type === 'bonus')) {
        result.push({ name: obj.name, type: obj.type });
      }
    }
  }
  return result;
}

function toTeamRole(row: RoleRow): TeamRole {
  return {
    id: row.slug,
    title: row.title,
    headcount: row.headcount ?? 1,
    allocation: row.allocation ?? '',
    skills: toTeamSkills(row.skills),
    candidates: toStringArray(row.candidateSlugs),
  };
}

@Injectable()
export class TeamService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getTeamResponse(): Promise<TeamResponse> {
    const project = await this.resolveProject();
    const roles = await this.db
      .select()
      .from(teamRole)
      .where(eq(teamRole.projectSlug, project.slug))
      .orderBy(asc(teamRole.sort));
    const assignments = await this.db.select().from(teamAssignment);

    const assignmentMap: { [roleSlug: string]: string } = {};
    for (const row of assignments) {
      assignmentMap[row.roleSlug] = row.candidateSlug;
    }

    return {
      project: {
        id: project.slug,
        title: project.title,
        period: project.period ?? '',
        note: project.note ?? '',
        roles: roles.map((row) => toTeamRole(row)),
        assignments: assignmentMap,
      },
    };
  }

  async createRole(body: unknown): Promise<TeamRole> {
    const input = this.parseCreateInput(body);
    const project = await this.resolveProject();

    const lastRows = await this.db
      .select({ sort: teamRole.sort })
      .from(teamRole)
      .where(eq(teamRole.projectSlug, project.slug))
      .orderBy(desc(teamRole.sort))
      .limit(1);
    const nextSort: number = (lastRows[0]?.sort ?? 0) + 1;
    const slug = `custom-role-${Date.now()}`;

    const inserted = await this.db
      .insert(teamRole)
      .values({
        slug,
        projectSlug: project.slug,
        title: input.title,
        headcount: 1,
        allocation: input.allocation,
        skills: input.skills,
        candidateSlugs: input.candidates,
        sort: nextSort,
      })
      .returning({ id: teamRole.id });
    if (inserted.length === 0) throw new ConflictException('角色创建失败');

    return {
      id: slug,
      title: input.title,
      headcount: 1,
      allocation: input.allocation,
      skills: input.skills,
      candidates: input.candidates,
    };
  }

  async assign(roleSlug: string, body: unknown): Promise<TeamResponse> {
    const candidateSlug = this.parseCandidateSlug(body);

    const found = await this.db
      .select({ slug: teamRole.slug })
      .from(teamRole)
      .where(eq(teamRole.slug, roleSlug))
      .limit(1);
    if (found.length === 0) throw new NotFoundException('未找到该角色');

    const upserted = await this.db
      .insert(teamAssignment)
      .values({ roleSlug, candidateSlug })
      .onConflictDoUpdate({
        target: teamAssignment.roleSlug,
        set: { candidateSlug },
      })
      .returning({ id: teamAssignment.id });
    if (upserted.length === 0) throw new ConflictException('指派失败');

    return this.getTeamResponse();
  }

  async removeAssignment(roleSlug: string): Promise<TeamResponse> {
    const removed = await this.db
      .delete(teamAssignment)
      .where(eq(teamAssignment.roleSlug, roleSlug))
      .returning({ id: teamAssignment.id });
    if (removed.length === 0) throw new NotFoundException('该角色暂无指派');
    return this.getTeamResponse();
  }

  async clearAssignments(): Promise<TeamResponse> {
    await this.db.delete(teamAssignment).returning({ id: teamAssignment.id });
    return this.getTeamResponse();
  }

  private async resolveProject(): Promise<ProjectRow> {
    const preferred = await this.db
      .select()
      .from(teamProject)
      .where(eq(teamProject.slug, PREFERRED_PROJECT_SLUG))
      .limit(1);
    if (preferred[0]) return preferred[0];

    const first = await this.db.select().from(teamProject).limit(1);
    if (!first[0]) throw new NotFoundException('未找到团队项目');
    return first[0];
  }

  private parseCreateInput(body: unknown): CreateTeamRoleInput {
    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException('请求体必须为对象');
    }
    const raw = body as {
      title?: unknown;
      allocation?: unknown;
      skills?: unknown;
      candidates?: unknown;
    };
    if (typeof raw.title !== 'string' || raw.title.length === 0) {
      throw new BadRequestException('title 必须为非空字符串');
    }
    if (typeof raw.allocation !== 'string') {
      throw new BadRequestException('allocation 必须为字符串');
    }
    if (!Array.isArray(raw.skills)) {
      throw new BadRequestException('skills 必须为数组');
    }
    const skills: TeamRoleSkill[] = [];
    for (const item of raw.skills) {
      const name = (item as { name?: unknown } | null)?.name;
      if (typeof name !== 'string' || name.length === 0) {
        throw new BadRequestException('skills 项必须包含非空 name');
      }
      const type = (item as { type?: unknown }).type;
      if (type !== 'required' && type !== 'bonus') {
        throw new BadRequestException('skills 项 type 必须为 required 或 bonus');
      }
      skills.push({
        name: (item as { name: string }).name,
        type,
      });
    }
    if (!Array.isArray(raw.candidates)) {
      throw new BadRequestException('candidates 必须为数组');
    }
    for (const item of raw.candidates) {
      if (typeof item !== 'string') {
        throw new BadRequestException('candidates 必须为字符串数组');
      }
    }
    return {
      title: raw.title,
      allocation: raw.allocation,
      skills,
      candidates: raw.candidates as string[],
    };
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
}
