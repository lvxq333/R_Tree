import { currentEmployee } from '../auth/employee-context';
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { asc, eq } from 'drizzle-orm';
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
} from '@shared/api.interface';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listEmployees(): Promise<EmployeeListItem[]> {
    const employees = await this.db.select().from(employee).where(currentEmployee().accessRole === 'manager' ? undefined : eq(employee.id, currentEmployee().employeeId));
    const candidates = currentEmployee().accessRole === 'manager' ? await this.db.select().from(talentCandidate) : [];

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
}
