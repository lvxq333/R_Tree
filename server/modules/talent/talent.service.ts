import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@server/platform/local-platform';
import { talentCandidate, talentShortlistItem } from '@server/database/schema';
import type {
  ShortlistResponse,
  TalentCandidate,
  TalentCandidatesResponse,
} from '@shared/api.interface';

const DEMAND = '具身智能业务探索';

type CandidateRow = typeof talentCandidate.$inferSelect;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is string => typeof item === 'string');
}

function toDimensions(value: unknown): [string, number][] {
  if (!Array.isArray(value)) return [];
  const result: [string, number][] = [];
  for (const item of value) {
    if (typeof item === 'object' && item !== null && 'label' in item && 'value' in item) {
      const obj = item as { label: unknown; value: unknown };
      if (typeof obj.label === 'string' && typeof obj.value === 'number') {
        result.push([obj.label, obj.value]);
      }
    }
  }
  return result;
}

function toCandidate(row: CandidateRow): TalentCandidate {
  return {
    id: row.slug,
    name: row.name,
    avatar: row.avatarText ?? '',
    avatarTone: row.avatarTone ?? '',
    org: row.org ?? '',
    role: row.role ?? '',
    available: row.available,
    reason: row.reason ?? '',
    note: row.note ?? '',
    evidence: toStringArray(row.evidence),
    gap: row.gap ?? '',
    availability: row.availability ?? '',
    freshness: row.freshness ?? '',
    dimensions: toDimensions(row.dimensions),
  };
}

@Injectable()
export class TalentService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getCandidates(): Promise<TalentCandidatesResponse> {
    const rows = await this.db
      .select()
      .from(talentCandidate)
      .orderBy(asc(talentCandidate.sort));

    const direct: TalentCandidate[] = [];
    const adjacent: TalentCandidate[] = [];
    const potential: TalentCandidate[] = [];
    for (const row of rows) {
      const candidate = toCandidate(row);
      if (row.tier === 'direct') direct.push(candidate);
      else if (row.tier === 'adjacent') adjacent.push(candidate);
      else if (row.tier === 'potential') potential.push(candidate);
    }
    return { direct, adjacent, potential };
  }

  async getShortlist(): Promise<ShortlistResponse> {
    const items = await this.db
      .select({ candidateSlug: talentShortlistItem.candidateSlug })
      .from(talentShortlistItem)
      .orderBy(asc(talentShortlistItem.sort));

    const slugs: string[] = items.map((item) => item.candidateSlug);
    const candidateRows =
      slugs.length > 0
        ? await this.db
            .select()
            .from(talentCandidate)
            .where(inArray(talentCandidate.slug, slugs))
        : [];

    const bySlug = new Map<string, TalentCandidate>();
    for (const row of candidateRows) {
      bySlug.set(row.slug, toCandidate(row));
    }

    const result: TalentCandidate[] = [];
    for (const slug of slugs) {
      const candidate = bySlug.get(slug);
      if (candidate) result.push(candidate);
    }
    return { items: result };
  }

  async addToShortlist(candidateSlug: string): Promise<ShortlistResponse> {
    const found = await this.db
      .select({ slug: talentCandidate.slug })
      .from(talentCandidate)
      .where(eq(talentCandidate.slug, candidateSlug))
      .limit(1);
    if (found.length === 0) throw new NotFoundException('未找到该候选人');

    const lastRows = await this.db
      .select({ sort: talentShortlistItem.sort })
      .from(talentShortlistItem)
      .where(eq(talentShortlistItem.demand, DEMAND))
      .orderBy(desc(talentShortlistItem.sort))
      .limit(1);
    const nextSort: number = (lastRows[0]?.sort ?? 0) + 1;

    await this.db
      .insert(talentShortlistItem)
      .values({ candidateSlug, demand: DEMAND, sort: nextSort })
      .onConflictDoNothing({
        target: [talentShortlistItem.candidateSlug, talentShortlistItem.demand],
      });
    return this.getShortlist();
  }

  async removeFromShortlist(candidateSlug: string): Promise<ShortlistResponse> {
    const removed = await this.db
      .delete(talentShortlistItem)
      .where(
        and(
          eq(talentShortlistItem.candidateSlug, candidateSlug),
          eq(talentShortlistItem.demand, DEMAND),
        ),
      )
      .returning({ id: talentShortlistItem.id });
    if (removed.length === 0) throw new NotFoundException('该候选人不在清单中');
    return this.getShortlist();
  }

  async clearShortlist(): Promise<ShortlistResponse> {
    await this.db
      .delete(talentShortlistItem)
      .where(eq(talentShortlistItem.demand, DEMAND))
      .returning({ id: talentShortlistItem.id });
    return this.getShortlist();
  }
}
