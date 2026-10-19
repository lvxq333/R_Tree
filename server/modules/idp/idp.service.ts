import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@server/platform/local-platform';
import {
  idpAction,
  idpAdjustRule,
  idpMilestone,
  idpPhase,
  idpPlan,
  skillGap,
} from '@server/database/schema';
import type {
  IdpAction,
  IdpActionKind,
  IdpGap,
  IdpMilestone,
  IdpPhase,
  IdpResponse,
} from '@shared/api.interface';

const EMPLOYEE_SLUG = 'zhang-san';
const GAP_SOURCES: string[] = ['career', 'okr', 'current'];
const ACTION_KINDS: IdpActionKind[] = ['learn', 'practice', 'mentor', 'deliver'];

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is string => typeof item === 'string');
}

function toActionKind(value: string | null): IdpActionKind {
  const matched = ACTION_KINDS.find((kind: IdpActionKind) => kind === value);
  return matched ?? 'learn';
}

function toMilestoneState(value: string | null): IdpMilestone['state'] {
  if (value === 'done' || value === 'current' || value === 'next') return value;
  return 'next';
}

@Injectable()
export class IdpService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getIdp(): Promise<IdpResponse> {
    const plans = await this.db
      .select()
      .from(idpPlan)
      .where(eq(idpPlan.employeeSlug, EMPLOYEE_SLUG))
      .limit(1);
    const plan = plans[0];
    if (!plan) throw new NotFoundException('未找到该员工的 IDP 计划');

    const [phaseRows, milestoneRows, ruleRows, gapRows] = await Promise.all([
      this.db
        .select()
        .from(idpPhase)
        .where(eq(idpPhase.planId, plan.id))
        .orderBy(asc(idpPhase.sort)),
      this.db
        .select()
        .from(idpMilestone)
        .where(eq(idpMilestone.planId, plan.id))
        .orderBy(asc(idpMilestone.sort)),
      this.db
        .select()
        .from(idpAdjustRule)
        .where(eq(idpAdjustRule.planId, plan.id))
        .orderBy(asc(idpAdjustRule.sort)),
      this.db
        .select()
        .from(skillGap)
        .where(
          and(
            eq(skillGap.employeeSlug, EMPLOYEE_SLUG),
            inArray(skillGap.source, GAP_SOURCES),
          ),
        )
        .orderBy(asc(skillGap.sort)),
    ]);

    const phaseIds: string[] = phaseRows.map((row) => row.id);
    const actionRows =
      phaseIds.length > 0
        ? await this.db
            .select()
            .from(idpAction)
            .where(inArray(idpAction.phaseId, phaseIds))
            .orderBy(asc(idpAction.sort))
        : [];

    const actionsByPhase = new Map<string, IdpAction[]>();
    for (const action of actionRows) {
      const list = actionsByPhase.get(action.phaseId) ?? [];
      list.push({
        kind: toActionKind(action.kind),
        kindLabel: action.kindLabel ?? '',
        title: action.title ?? '',
        gap: action.gap ?? '',
        window: action.windowLabel ?? '',
        proof: action.proof ?? '',
      });
      actionsByPhase.set(action.phaseId, list);
    }

    const phases: IdpPhase[] = phaseRows.map((row) => ({
      range: row.rangeLabel ?? '',
      title: row.title ?? '',
      theme: row.theme ?? '',
      focusGaps: toStringArray(row.focusGaps),
      objective: row.objective ?? '',
      actions: actionsByPhase.get(row.id) ?? [],
      milestone: row.milestone ?? '',
      outcome: row.outcome ?? '',
    }));

    const milestones: IdpMilestone[] = milestoneRows.map((row) => ({
      time: row.timeLabel ?? '',
      title: row.title ?? '',
      detail: row.detail ?? '',
      state: toMilestoneState(row.state),
    }));

    const adjustRules = ruleRows.map((row) => ({
      trigger: row.triggerLabel ?? '',
      action: row.action ?? '',
    }));

    const gaps: IdpGap[] = gapRows.map((row) => ({
      title: row.title,
      priority: (row.priority ?? '').toUpperCase(),
      note: row.levelRange ?? row.description ?? '',
    }));

    return {
      positioning: {
        currentRole: plan.currentRoleLabel ?? '',
        targetRole: plan.targetRoleLabel ?? '',
        horizon: plan.horizon ?? '',
        readiness: plan.readiness ?? 0,
        readinessNote: plan.readinessNote ?? '',
        strengths: toStringArray(plan.strengths),
        weaknesses: toStringArray(plan.weaknesses),
      },
      gaps,
      phases,
      milestones,
      adjustRules,
      reviewCadence: plan.reviewCadence ?? '',
    };
  }
}
