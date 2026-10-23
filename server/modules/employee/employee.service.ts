import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  employee,
  skill,
  skillCategory,
  skillLevelAnchor,
  talentCandidate,
} from '@server/database/schema';
import type {
  EmployeeListItem,
  SkillCategoryNode,
  SkillNode,
  SkillTreeResponse,
  SkillRelationsResponse,
  SkillRelationEdge,
} from '@shared/api.interface';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listEmployees(): Promise<EmployeeListItem[]> {
    const user=currentEmployee();
    const allowed=user.personnelRole==='expert' ? await this.db.execute<{id:string}>(sql`
      SELECT e.id FROM employee e WHERE e.department=${user.department} OR EXISTS(
        SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${user.employeeSlug}
          AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL)`) : [];
    const employees = await this.db.select().from(employee).where(user.personnelRole==='hr' ? undefined
      : user.personnelRole==='expert' ? inArray(employee.id,allowed.map(row=>row.id)) : eq(employee.id,user.employeeId));
    const candidates = user.personnelRole === 'hr' ? await this.db.select().from(talentCandidate) : [];

    const fromEmployees: EmployeeListItem[] = employees.map((row) => ({
      id: row.slug,
      name: row.name,
      avatar: row.avatarText ?? '',
      tone: row.avatarTone ?? '',
      role: row.role ?? '',
      org: row.org ?? '',
    }));

    const employeeIds = new Set(fromEmployees.map((item: EmployeeListItem) => item.id));
    const fromCandidates: EmployeeListItem[] = candidates
      .filter((row: typeof talentCandidate.$inferSelect) => !employeeIds.has(row.slug))
      .map((row) => ({
        id: row.slug,
        name: row.name,
        avatar: row.avatarText ?? '',
        tone: row.avatarTone ?? '',
        role: row.role ?? '',
        org: row.org ?? '',
      }));

    return [...fromEmployees, ...fromCandidates];
  }

  async listColleagues(): Promise<EmployeeListItem[]> {
    const user=currentEmployee();
    const rows=await this.db.execute<{slug:string;name:string;avatar_text:string|null;avatar_tone:string|null;
      role:string|null;department:string|null}>(sql`SELECT slug,name,avatar_text,avatar_tone,role,
        COALESCE(department,org) AS department FROM employee
        WHERE status='active' AND COALESCE(department,org)=${user.department}
        ORDER BY name,slug LIMIT 500`);
    return rows.map(row=>({id:row.slug,name:row.name,avatar:row.avatar_text??Array.from(row.name)[0]??'',
      tone:row.avatar_tone??'',role:row.role??'',org:row.department??''}));
  }

  async getSkillTree(): Promise<SkillTreeResponse> {
    const categories = await this.db
      .select()
      .from(skillCategory)
      .orderBy(asc(skillCategory.sort));
    const skills = await this.db.select().from(skill).orderBy(asc(skill.slug));
    const anchors = await this.db
      .select()
      .from(skillLevelAnchor)
      .orderBy(asc(skillLevelAnchor.level));

    const levelsBySkill = new Map<string, string[]>();
    for (const anchor of anchors) {
      const list: string[] = levelsBySkill.get(anchor.skillSlug) ?? [];
      list.push(`L${anchor.level}`);
      levelsBySkill.set(anchor.skillSlug, list);
    }

    const skillsByCategory = new Map<string, SkillNode[]>();
    for (const skillRow of skills) {
      const categorySlug: string | null = skillRow.categorySlug;
      if (!categorySlug) continue;
      const node: SkillNode = {
        slug: skillRow.slug,
        name: skillRow.name,
        levels: levelsBySkill.get(skillRow.slug) ?? [],
      };
      const list: SkillNode[] = skillsByCategory.get(categorySlug) ?? [];
      list.push(node);
      skillsByCategory.set(categorySlug, list);
    }

    const topCategories = categories.filter(
      (row: typeof skillCategory.$inferSelect) => !row.parentSlug,
    );

    const categoryNodes: SkillCategoryNode[] = topCategories.map(
      (top: typeof skillCategory.$inferSelect) => ({
        slug: top.slug,
        name: top.name,
        kind: top.kind === 'generic' ? 'generic' : 'professional',
        children: categories
          .filter((child: typeof skillCategory.$inferSelect) => child.parentSlug === top.slug)
          .map((child: typeof skillCategory.$inferSelect) => ({
            slug: child.slug,
            name: child.name,
            skills: skillsByCategory.get(child.slug) ?? [],
          })),
      }),
    );

    return { categories: categoryNodes };
  }

  async getSkillRelations(requestedSlugs: string[]): Promise<SkillRelationsResponse> {
    const slugs = [...new Set(requestedSlugs.filter(slug => /^[\w-]{1,64}$/.test(slug)))].slice(0, 100);
    if (slugs.length < 2) return { edges: [] };
    const requested = new Set(slugs);
    const [version] = await this.db.execute<{ slug: string }>(sql`
      SELECT slug FROM mvp_standard_version
      WHERE status = 'published' AND effective_at <= now()
      ORDER BY effective_at DESC LIMIT 1`);
    if (!version) return { edges: [] };
    const [competencies, titleLevels] = await Promise.all([
      this.db.execute<{ skill_slug: string; rule_key: string; label: string }>(sql`
        SELECT DISTINCT sc.skill_slug, sc.competency_slug AS rule_key, c.name AS label
        FROM mvp_skill_competency sc
        JOIN mvp_competency c ON c.slug = sc.competency_slug
        WHERE sc.standard_version_slug = ${version.slug}`),
      this.db.execute<{ skill_slug: string; rule_key: string; label: string }>(sql`
        SELECT DISTINCT r.skill_slug, l.id::text AS rule_key,
          COALESCE(t.name || ' · ', '') || l.level_code AS label
        FROM mvp_title_requirement r
        JOIN mvp_title_level l ON l.id = r.title_level_id
        LEFT JOIN mvp_title_track t ON t.slug = l.track_slug
        WHERE l.standard_version_slug = ${version.slug}
        UNION ALL
        SELECT ns.skill_slug, n.id::text AS rule_key, '人力资源管理通道 · ' || n.code AS label
        FROM career_node_skill ns JOIN career_node n ON n.slug = ns.node_slug
        WHERE n.sequence_slug = 'hr'`),
    ]);
    const standardSkillCount = new Set(competencies.map(row => row.skill_slug)).size;
    const maximumSelectiveCoverage = Math.max(2, Math.ceil(standardSkillCount / 3));
    const edges = new Map<string, SkillRelationEdge>();
    const addSharedRules = (rows: { skill_slug: string; rule_key: string; label: string }[], kind: 'sharedCompetencies' | 'sharedTitleLevels') => {
      const groups = new Map<string, { label: string; slugs: Set<string> }>();
      for (const row of rows) {
        const group = groups.get(row.rule_key) ?? { label: row.label, slugs: new Set<string>() };
        group.slugs.add(row.skill_slug);
        groups.set(row.rule_key, group);
      }
      for (const group of groups.values()) {
        if (kind === 'sharedCompetencies' && group.slugs.size > maximumSelectiveCoverage) continue;
        const members = [...group.slugs].filter(slug => requested.has(slug)).sort();
        for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
          const key = `${members[i]}|${members[j]}`;
          const edge = edges.get(key) ?? {
            fromSkillSlug: members[i], toSkillSlug: members[j], sharedCompetencies: [], sharedTitleLevels: [],
          };
          if (!edge[kind].includes(group.label)) edge[kind].push(group.label);
          edges.set(key, edge);
        }
      }
    };
    addSharedRules(competencies, 'sharedCompetencies');
    addSharedRules(titleLevels, 'sharedTitleLevels');
    return { edges: [...edges.values()].sort((a, b) =>
      (b.sharedCompetencies.length * 2 + b.sharedTitleLevels.length) -
      (a.sharedCompetencies.length * 2 + a.sharedTitleLevels.length)) };
  }
}
