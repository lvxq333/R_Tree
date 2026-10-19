import { Inject, Injectable } from '@nestjs/common';
import { asc, inArray } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@server/platform/local-platform';
import {
  successionCandidate,
  successionPosition,
} from '@server/database/schema';
import type {
  SuccessionResponse,
  SuccessionRole,
  SuccessorPerson,
} from '@shared/api.interface';

type CandidateRow = typeof successionCandidate.$inferSelect;

function toSuccessorPerson(row: CandidateRow): SuccessorPerson {
  return {
    name: row.personName,
    avatar: row.avatarText ?? '',
    tone: row.avatarTone ?? '',
    role: row.role ?? '',
    gap: row.gap ?? '',
    state: row.state ?? '',
    stateClass: row.stateClass ?? '',
    employeeId: row.employeeSlug ?? null,
  };
}

@Injectable()
export class SuccessionService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getSuccession(): Promise<SuccessionResponse> {
    const positions = await this.db
      .select()
      .from(successionPosition)
      .orderBy(asc(successionPosition.sort));

    const positionSlugs: string[] = positions.map((row) => row.slug);
    const candidateRows =
      positionSlugs.length > 0
        ? await this.db
            .select()
            .from(successionCandidate)
            .where(inArray(successionCandidate.positionSlug, positionSlugs))
            .orderBy(asc(successionCandidate.sort))
        : [];

    const bucketsByPosition = new Map<
      string,
      { ready: SuccessorPerson[]; pipeline: SuccessorPerson[] }
    >();
    for (const row of candidateRows) {
      const bucket = bucketsByPosition.get(row.positionSlug) ?? {
        ready: [],
        pipeline: [],
      };
      if (row.bucket === 'ready') bucket.ready.push(toSuccessorPerson(row));
      else if (row.bucket === 'pipeline') bucket.pipeline.push(toSuccessorPerson(row));
      bucketsByPosition.set(row.positionSlug, bucket);
    }

    const roles: SuccessionRole[] = positions.map((row) => {
      const bucket = bucketsByPosition.get(row.slug);
      return {
        id: row.slug,
        title: row.title,
        family: row.family ?? '',
        incumbent: row.incumbent ?? '',
        incumbentMeta: row.incumbentMeta ?? '',
        immediate: row.immediate ?? 0,
        developing: row.developing ?? 0,
        health: row.health ?? '',
        healthText: row.healthText ?? '',
        summary: row.summary ?? '',
        risk: row.risk ?? '',
        ready: bucket?.ready ?? [],
        pipeline: bucket?.pipeline ?? [],
      };
    });

    return { roles };
  }
}
