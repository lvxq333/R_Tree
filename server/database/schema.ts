/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const performanceRecord = pgTable("performance_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  period: varchar("period", { length: 32 }).notNull(),
  rating: varchar("rating", { length: 16 }).notNull(),
  summary: varchar("summary", { length: 255 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_performance_record_slug").on(table.employeeSlug),
]);

export const teamAssignment = pgTable("team_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleSlug: varchar("role_slug", { length: 64 }).notNull(),
  candidateSlug: varchar("candidate_slug", { length: 64 }).notNull(),
  /** 成员对组队邀请的响应：pending 待响应 / accepted 已接受 / rejected 已拒绝 */
  response: varchar("response", { length: 16 }).notNull().default("pending"),
  respondedAt: customTimestamptz("responded_at", { precision: 3 }),
  responseSource: varchar("response_source", { length: 16 }).notNull().default("employee"),
  rejectNote: varchar("reject_note", { length: 255 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("team_assignment_role_candidate_key").on(table.roleSlug, table.candidateSlug),
]);

export const teamRole = pgTable("team_role", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  projectSlug: varchar("project_slug", { length: 64 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  headcount: integer("headcount"),
  allocation: varchar("allocation", { length: 8 }),
  /**
   * @type { name: string; type: string }[]
   */
  skills: jsonb("skills"),
  /**
   * @type string[]
   */
  candidateSlugs: jsonb("candidate_slugs"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("team_role_slug_key").on(table.slug),
  index("idx_team_role_project").on(table.projectSlug),
]);

export const teamProject = pgTable("team_project", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 128 }).notNull(),
  period: varchar("period", { length: 64 }),
  note: varchar("note", { length: 255 }),
  /**
   * 组队方案状态：draft 草稿 / confirming 协调确认中 / adjusting 有成员拒绝待调整 / confirmed 全员接受
   */
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  /** 方案归属部门（创建时手选；可见范围=本部门方案+本人创建，HR 全可见） */
  department: varchar("department", { length: 128 }),
  creatorSlug: varchar("creator_slug", { length: 64 }),
  creatorName: varchar("creator_name", { length: 64 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("team_project_slug_key").on(table.slug),
]);

export const successionCandidate = pgTable("succession_candidate", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionSlug: varchar("position_slug", { length: 64 }).notNull(),
  personName: varchar("person_name", { length: 64 }).notNull(),
  employeeSlug: varchar("employee_slug", { length: 64 }),
  avatarText: varchar("avatar_text", { length: 8 }),
  avatarTone: varchar("avatar_tone", { length: 16 }),
  role: varchar("role", { length: 128 }),
  gap: varchar("gap", { length: 255 }),
  state: varchar("state", { length: 32 }),
  stateClass: varchar("state_class", { length: 32 }),
  bucket: varchar("bucket", { length: 16 }).notNull(),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_succession_candidate_pos").on(table.positionSlug),
]);

export const successionPosition = pgTable("succession_position", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 128 }).notNull(),
  family: varchar("family", { length: 64 }),
  incumbent: varchar("incumbent", { length: 64 }),
  incumbentMeta: varchar("incumbent_meta", { length: 128 }),
  immediate: integer("immediate"),
  developing: integer("developing"),
  health: varchar("health", { length: 16 }),
  healthText: varchar("health_text", { length: 16 }),
  summary: text("summary"),
  risk: text("risk"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("succession_position_slug_key").on(table.slug),
]);

export const talentShortlistItem = pgTable("talent_shortlist_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateSlug: varchar("candidate_slug", { length: 64 }).notNull(),
  demand: varchar("demand", { length: 128 }).notNull().default('具身智能业务探索'),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_shortlist_item_unique").on(table.candidateSlug, table.demand),
]);

export const talentCandidate = pgTable("talent_candidate", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  avatarText: varchar("avatar_text", { length: 8 }),
  avatarTone: varchar("avatar_tone", { length: 16 }),
  org: varchar("org", { length: 128 }),
  role: varchar("role", { length: 128 }),
  tier: varchar("tier", { length: 16 }),
  available: boolean("available").notNull().default(true),
  reason: varchar("reason", { length: 255 }),
  note: text("note"),
  /**
   * @type string[]
   */
  evidence: jsonb("evidence"),
  gap: varchar("gap", { length: 255 }),
  availability: varchar("availability", { length: 64 }),
  freshness: varchar("freshness", { length: 32 }),
  /**
   * @type { label: string; value: number }[]
   */
  dimensions: jsonb("dimensions"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("talent_candidate_slug_key").on(table.slug),
]);

export const idpAdjustRule = pgTable("idp_adjust_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull(),
  triggerLabel: varchar("trigger_label", { length: 128 }),
  action: text("action"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_idp_adjust_plan").on(table.planId),
]);

export const idpMilestone = pgTable("idp_milestone", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull(),
  timeLabel: varchar("time_label", { length: 16 }),
  title: varchar("title", { length: 128 }),
  detail: varchar("detail", { length: 255 }),
  state: varchar("state", { length: 16 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_idp_milestone_plan").on(table.planId),
]);

export const idpAction = pgTable("idp_action", {
  id: uuid("id").primaryKey().defaultRandom(),
  phaseId: uuid("phase_id").notNull(),
  kind: varchar("kind", { length: 16 }),
  title: varchar("title", { length: 255 }),
  gap: varchar("gap", { length: 128 }),
  windowLabel: varchar("window_label", { length: 64 }),
  proof: varchar("proof", { length: 255 }),
  sort: integer("sort").notNull().default(0),
  kindLabel: varchar("kind_label", { length: 16 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_idp_action_phase").on(table.phaseId),
]);

export const idpPhase = pgTable("idp_phase", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull(),
  rangeLabel: varchar("range_label", { length: 128 }),
  title: varchar("title", { length: 128 }),
  theme: text("theme"),
  objective: varchar("objective", { length: 255 }),
  milestone: varchar("milestone", { length: 255 }),
  outcome: text("outcome"),
  /**
   * @type string[]
   */
  focusGaps: jsonb("focus_gaps"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_idp_phase_plan").on(table.planId),
]);

export const idpPlan = pgTable("idp_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull().unique(),
  currentRoleLabel: varchar("current_role_label", { length: 128 }),
  targetRoleLabel: varchar("target_role_label", { length: 128 }),
  horizon: varchar("horizon", { length: 64 }),
  readiness: integer("readiness"),
  readinessNote: text("readiness_note"),
  /**
   * @type string[]
   */
  strengths: jsonb("strengths"),
  /**
   * @type string[]
   */
  weaknesses: jsonb("weaknesses"),
  reviewCadence: varchar("review_cadence", { length: 512 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idp_plan_employee_slug_key").on(table.employeeSlug),
]);

export const careerNodeSkill = pgTable("career_node_skill", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeSlug: varchar("node_slug", { length: 64 }).notNull(),
  skillSlug: varchar("skill_slug", { length: 64 }).notNull(),
  requiredLevel: integer("required_level").notNull(),
  currentLevel: integer("current_level"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_career_node_skill_node").on(table.nodeSlug),
]);

export const careerNode = pgTable("career_node", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  sequenceSlug: varchar("sequence_slug", { length: 32 }).notNull(),
  code: varchar("code", { length: 8 }),
  title: varchar("title", { length: 128 }),
  meta: varchar("meta", { length: 64 }),
  state: varchar("state", { length: 64 }),
  coverage: integer("coverage"),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("career_node_slug_key").on(table.slug),
  index("idx_career_node_seq").on(table.sequenceSlug),
]);

export const careerSequence = pgTable("career_sequence", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  label: varchar("label", { length: 64 }).notNull(),
  description: varchar("description", { length: 255 }),
  channel: varchar("channel", { length: 16 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("career_sequence_slug_key").on(table.slug),
]);

export const approval = pgTable("approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  linkedSlug: varchar("linked_slug", { length: 64 }),
  kind: varchar("kind", { length: 16 }),
  applicant: varchar("applicant", { length: 64 }),
  avatar: varchar("avatar", { length: 8 }),
  department: varchar("department", { length: 128 }),
  title: varchar("title", { length: 128 }).notNull(),
  currentLevel: integer("current_level"),
  targetLevel: integer("target_level"),
  sourceLabel: varchar("source_label", { length: 64 }),
  submittedAt: varchar("submitted_at", { length: 64 }),
  due: varchar("due", { length: 32 }),
  status: varchar("status", { length: 32 }),
  detail: text("detail"),
  employeeResponse: text("employee_response"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("approval_slug_key").on(table.slug),
]);

/** 审批催办记录：员工对未处理的申请发起催办时写入，供审批人侧展示与审计留痕 */
export const approvalReminder = pgTable("approval_reminder", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  approvalSlug: varchar("approval_slug", { length: 64 }).notNull(),
  requesterSlug: varchar("requester_slug", { length: 64 }),
  requesterName: varchar("requester_name", { length: 64 }),
  department: varchar("department", { length: 128 }),
  targetScope: varchar("target_scope", { length: 32 }).notNull().default('approver'),
  note: text("note"),
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("approval_reminder_approval_idx").on(table.approvalSlug, table.createdAt),
]);

export const skillGap = pgTable("skill_gap", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  source: varchar("source", { length: 16 }),
  sourceLabel: varchar("source_label", { length: 16 }),
  title: varchar("title", { length: 128 }).notNull(),
  description: varchar("description", { length: 255 }),
  filled: integer("filled"),
  target: integer("target"),
  levelRange: varchar("level_range", { length: 32 }),
  priority: varchar("priority", { length: 8 }),
  note: varchar("note", { length: 255 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_skill_gap_emp").on(table.employeeSlug),
]);

export const skillEvent = pgTable("skill_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  dateLabel: varchar("date_label", { length: 16 }),
  total: integer("total"),
  title: varchar("title", { length: 128 }),
  category: varchar("category", { length: 128 }),
  level: varchar("level", { length: 64 }),
  evidence: varchar("evidence", { length: 255 }),
  approver: varchar("approver", { length: 128 }),
  note: text("note"),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_skill_event_emp").on(table.employeeSlug),
]);

export const employeeSkill = pgTable("employee_skill", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  skillSlug: varchar("skill_slug", { length: 64 }),
  title: varchar("title", { length: 128 }).notNull(),
  category: varchar("category", { length: 128 }),
  source: varchar("source", { length: 32 }),
  sourceShort: varchar("source_short", { length: 16 }),
  sourceLabel: varchar("source_label", { length: 128 }),
  currentLevel: integer("current_level"),
  targetLevel: integer("target_level"),
  confidence: integer("confidence"),
  status: varchar("status", { length: 32 }),
  statusLabel: varchar("status_label", { length: 32 }),
  explanation: text("explanation"),
  anchor: text("anchor"),
  /**
   * @type { type: string; title: string; detail: string }[]
   */
  evidence: jsonb("evidence"),
  deadline: varchar("deadline", { length: 32 }),
  approvedAt: varchar("approved_at", { length: 32 }),
  expiry: varchar("expiry", { length: 32 }),
  lastUsed: varchar("last_used", { length: 32 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("employee_skill_slug_key").on(table.slug),
  index("idx_employee_skill_emp").on(table.employeeSlug),
]);

export const skillLevelAnchor = pgTable("skill_level_anchor", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillSlug: varchar("skill_slug", { length: 64 }).notNull(),
  level: integer("level").notNull(),
  anchor: text("anchor"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_skill_level_anchor_unique").on(table.skillSlug, table.level),
]);

export const skill = pgTable("skill", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  categorySlug: varchar("category_slug", { length: 64 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("skill_slug_key").on(table.slug),
  index("idx_skill_category").on(table.categorySlug),
]);

export const skillCategory = pgTable("skill_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 16 }).notNull(),
  parentSlug: varchar("parent_slug", { length: 64 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("skill_category_slug_key").on(table.slug),
]);

export const employeeProject = pgTable("employee_project", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  timeRange: varchar("time_range", { length: 64 }),
  title: varchar("title", { length: 255 }),
  responsibility: text("responsibility"),
  actions: text("actions"),
  outcome: text("outcome"),
  impact: text("impact"),
  contribution: varchar("contribution", { length: 32 }),
  /**
   * @type string[]
   */
  skills: jsonb("skills"),
  verification: varchar("verification", { length: 64 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_employee_project_slug").on(table.employeeSlug),
]);

export const employeeTrait = pgTable("employee_trait", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  badge: varchar("badge", { length: 8 }),
  title: varchar("title", { length: 64 }),
  detail: text("detail"),
  source: varchar("source", { length: 255 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_employee_trait_slug").on(table.employeeSlug),
]);

export const employeeExperience = pgTable("employee_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeSlug: varchar("employee_slug", { length: 64 }).notNull(),
  period: varchar("period", { length: 64 }),
  role: varchar("role", { length: 128 }),
  org: varchar("org", { length: 255 }),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_employee_experience_slug").on(table.employeeSlug),
]);

export const employee = pgTable("employee", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  avatarText: varchar("avatar_text", { length: 8 }),
  avatarTone: varchar("avatar_tone", { length: 16 }),
  role: varchar("role", { length: 128 }),
  org: varchar("org", { length: 255 }),
  status: varchar("status", { length: 32 }),
  summary: text("summary"),
  summaryDescription: text("summary_description"),
  goal: varchar("goal", { length: 128 }),
  nextCheckin: varchar("next_checkin", { length: 64 }),
  availability: varchar("availability", { length: 64 }),
  readiness: varchar("readiness", { length: 64 }),
  readinessValue: integer("readiness_value"),
  readinessCopy: varchar("readiness_copy", { length: 255 }),
  tenureSummary: varchar("tenure_summary", { length: 255 }),
  /**
   * @type { label: string; text: string; meta: string }[]
   */
  responsibilities: jsonb("responsibilities"),
  /**
   * @type { label: string; text: string }[]
   */
  collaboration: jsonb("collaboration"),
  updatedLabel: varchar("updated_label", { length: 64 }),
  isCurrentUser: boolean("is_current_user").notNull().default(false),
  /**
   * @type { ratio: string; action: string; proof: string }[]
   */
  developmentActions: jsonb("development_actions"),
  /**
   * @type { hasTeam: boolean; scope: string; years: string; style: string; styleDetail: string; collaborationFit: string }
   */
  managementProfile: jsonb("management_profile"),
  birthYear: integer("birth_year"),
  gender: varchar("gender", { length: 8 }),
  education: varchar("education", { length: 64 }),
  hireDate: varchar("hire_date", { length: 16 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("employee_slug_key").on(table.slug),
]);

// table aliases
export const approvalTable = approval;
export const careerNodeTable = careerNode;
export const careerNodeSkillTable = careerNodeSkill;
export const careerSequenceTable = careerSequence;
export const employeeTable = employee;
export const employeeExperienceTable = employeeExperience;
export const employeeProjectTable = employeeProject;
export const employeeSkillTable = employeeSkill;
export const employeeTraitTable = employeeTrait;
export const idpActionTable = idpAction;
export const idpAdjustRuleTable = idpAdjustRule;
export const idpMilestoneTable = idpMilestone;
export const idpPhaseTable = idpPhase;
export const idpPlanTable = idpPlan;
export const performanceRecordTable = performanceRecord;
export const skillTable = skill;
export const skillCategoryTable = skillCategory;
export const skillEventTable = skillEvent;
export const skillGapTable = skillGap;
export const skillLevelAnchorTable = skillLevelAnchor;
export const successionCandidateTable = successionCandidate;
export const successionPositionTable = successionPosition;
export const talentCandidateTable = talentCandidate;
export const talentShortlistItemTable = talentShortlistItem;
export const teamAssignmentTable = teamAssignment;
export const teamProjectTable = teamProject;
export const teamRoleTable = teamRole;
