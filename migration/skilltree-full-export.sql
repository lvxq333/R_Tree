-- =====================================================================
-- 技能树 · 人才管理系统 — 全量数据库导出（可恢复 SQL）
-- 生成时间：2026-10-15
-- 来源：妙搭应用数据库（app_17e9ph7uz2y），经 lark-cli apps +db-table-get / +db-data-export 只读导出
-- 范围：27 张业务表 结构（DDL + 索引 + 注释）+ 演示数据 346 行（含主键 uuid、slug、JSONB 原样保留）
-- 用法：psql -d <目标库> -f skilltree-full-export.sql
--   或分段执行：扩展与类型 → 建表 → 数据 →（可选）RLS 段（见文末注释说明）
-- 注意：未包含任何账号、令牌或连接密钥；_created_by/_updated_by 中的数字为
--       妙搭平台内部用户 ID（user_profile 复合类型），独立环境中无业务含义。
-- =====================================================================

BEGIN;

-- PG13+ 内置 gen_random_uuid()；低版本需先启用 pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 平台自定义复合类型（原 workspace schema 内置类型，独立库需自建）
CREATE TYPE user_profile AS (user_id varchar, name varchar, email varchar, avatar text, status integer);


-- =============================================================
-- 表：skill_category（17 行，索引：skill_category_slug_key, skill_category_pkey）
-- =============================================================
CREATE  TABLE skill_category (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  name character varying(64) NOT NULL,
  kind character varying(16) NOT NULL,
  parent_slug character varying(64) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT skill_category_pkey PRIMARY KEY (id),
  CONSTRAINT skill_category_slug_key UNIQUE (slug)
);


-- =============================================================
-- 表：skill（81 行，索引：skill_slug_key, idx_skill_category, skill_pkey）
-- =============================================================
CREATE  TABLE skill (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  name character varying(128) NOT NULL,
  category_slug character varying(64) NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT skill_pkey PRIMARY KEY (id),
  CONSTRAINT skill_slug_key UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_skill_category ON skill USING btree (category_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：skill_level_anchor（10 行，索引：idx_skill_level_anchor_unique, skill_level_anchor_pkey）
-- =============================================================
CREATE  TABLE skill_level_anchor (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  skill_slug character varying(64) NOT NULL,
  level integer NOT NULL,
  anchor text NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT skill_level_anchor_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_level_anchor_unique ON skill_level_anchor USING btree (skill_slug, level) TABLESPACE pg_default;


-- =============================================================
-- 表：career_sequence（4 行，索引：career_sequence_slug_key, career_sequence_pkey）
-- =============================================================
CREATE  TABLE career_sequence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(32) NOT NULL,
  label character varying(64) NOT NULL,
  description character varying(255) NULL,
  channel character varying(16) NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT career_sequence_pkey PRIMARY KEY (id),
  CONSTRAINT career_sequence_slug_key UNIQUE (slug)
);


-- =============================================================
-- 表：career_node（16 行，索引：career_node_slug_key, idx_career_node_seq, career_node_pkey）
-- =============================================================
CREATE  TABLE career_node (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  sequence_slug character varying(32) NOT NULL,
  code character varying(8) NULL,
  title character varying(128) NULL,
  meta character varying(64) NULL,
  state character varying(64) NULL,
  coverage integer NULL,
  description text NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT career_node_pkey PRIMARY KEY (id),
  CONSTRAINT career_node_slug_key UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_career_node_seq ON career_node USING btree (sequence_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：career_node_skill（64 行，索引：idx_career_node_skill_node, career_node_skill_pkey）
-- =============================================================
CREATE  TABLE career_node_skill (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  node_slug character varying(64) NOT NULL,
  skill_slug character varying(64) NOT NULL,
  required_level integer NOT NULL,
  current_level integer NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT career_node_skill_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_career_node_skill_node ON career_node_skill USING btree (node_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：employee（4 行，索引：employee_slug_key, employee_pkey）
-- =============================================================
CREATE  TABLE employee (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  name character varying(64) NOT NULL,
  avatar_text character varying(8) NULL,
  avatar_tone character varying(16) NULL,
  role character varying(128) NULL,
  org character varying(255) NULL,
  status character varying(32) NULL,
  summary text NULL,
  summary_description text NULL,
  goal character varying(128) NULL,
  next_checkin character varying(64) NULL,
  availability character varying(64) NULL,
  readiness character varying(64) NULL,
  readiness_value integer NULL,
  readiness_copy character varying(255) NULL,
  tenure_summary character varying(255) NULL,
  responsibilities jsonb NULL,
  collaboration jsonb NULL,
  updated_label character varying(64) NULL,
  is_current_user boolean NOT NULL DEFAULT false,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  development_actions jsonb NULL,
  management_profile jsonb NULL,
  birth_year integer NULL,
  gender character varying(8) NULL,
  education character varying(64) NULL,
  hire_date character varying(16) NULL,
  CONSTRAINT employee_pkey PRIMARY KEY (id),
  CONSTRAINT employee_slug_key UNIQUE (slug)
);
COMMENT ON COLUMN employee.responsibilities IS '@type { label: string; text: string; meta: string }[]';
COMMENT ON COLUMN employee.management_profile IS '@type { hasTeam: boolean; scope: string; years: string; style: string; styleDetail: string; collaborationFit: string }';
COMMENT ON COLUMN employee.hire_date IS '入职年月，如 2023.03';
COMMENT ON COLUMN employee.gender IS '性别';
COMMENT ON COLUMN employee.education IS '学历信息，如：硕士 · 北京邮电大学';
COMMENT ON COLUMN employee.development_actions IS '@type { ratio: string; action: string; proof: string }[]';
COMMENT ON COLUMN employee.collaboration IS '@type { label: string; text: string }[]';
COMMENT ON COLUMN employee.birth_year IS '出生年份，用于计算年龄';


-- =============================================================
-- 表：employee_experience（7 行，索引：idx_employee_experience_slug, employee_experience_pkey）
-- =============================================================
CREATE  TABLE employee_experience (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  period character varying(64) NULL,
  role character varying(128) NULL,
  org character varying(255) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT employee_experience_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_employee_experience_slug ON employee_experience USING btree (employee_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：employee_trait（15 行，索引：idx_employee_trait_slug, employee_trait_pkey）
-- =============================================================
CREATE  TABLE employee_trait (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  badge character varying(8) NULL,
  title character varying(64) NULL,
  detail text NULL,
  source character varying(255) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT employee_trait_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_employee_trait_slug ON employee_trait USING btree (employee_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：employee_project（9 行，索引：idx_employee_project_slug, employee_project_pkey）
-- =============================================================
CREATE  TABLE employee_project (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  time_range character varying(64) NULL,
  title character varying(255) NULL,
  responsibility text NULL,
  actions text NULL,
  outcome text NULL,
  impact text NULL,
  contribution character varying(32) NULL,
  skills jsonb NULL,
  verification character varying(64) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT employee_project_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_employee_project_slug ON employee_project USING btree (employee_slug) TABLESPACE pg_default;
COMMENT ON COLUMN employee_project.skills IS '@type string[]';


-- =============================================================
-- 表：performance_record（12 行，索引：idx_performance_record_slug, performance_record_pkey）
-- =============================================================
CREATE  TABLE performance_record (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  period character varying(32) NOT NULL,
  rating character varying(16) NOT NULL,
  summary character varying(255) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT performance_record_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_performance_record_slug ON performance_record USING btree (employee_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：skill_event（12 行，索引：idx_skill_event_emp, skill_event_pkey）
-- =============================================================
CREATE  TABLE skill_event (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  date_label character varying(16) NULL,
  total integer NULL,
  title character varying(128) NULL,
  category character varying(128) NULL,
  level character varying(64) NULL,
  evidence character varying(255) NULL,
  approver character varying(128) NULL,
  note text NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT skill_event_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_skill_event_emp ON skill_event USING btree (employee_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：skill_gap（12 行，索引：idx_skill_gap_emp, skill_gap_pkey）
-- =============================================================
CREATE  TABLE skill_gap (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  source character varying(16) NULL,
  source_label character varying(16) NULL,
  title character varying(128) NOT NULL,
  description character varying(255) NULL,
  filled integer NULL,
  target integer NULL,
  level_range character varying(32) NULL,
  priority character varying(8) NULL,
  note character varying(255) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT skill_gap_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_skill_gap_emp ON skill_gap USING btree (employee_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：employee_skill（22 行，索引：employee_skill_slug_key, idx_employee_skill_emp, employee_skill_pkey）
-- =============================================================
CREATE  TABLE employee_skill (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  employee_slug character varying(64) NOT NULL,
  skill_slug character varying(64) NULL,
  title character varying(128) NOT NULL,
  category character varying(128) NULL,
  source character varying(32) NULL,
  source_short character varying(16) NULL,
  source_label character varying(128) NULL,
  current_level integer NULL,
  target_level integer NULL,
  confidence integer NULL,
  status character varying(32) NULL,
  status_label character varying(32) NULL,
  explanation text NULL,
  anchor text NULL,
  evidence jsonb NULL,
  deadline character varying(32) NULL,
  approved_at character varying(32) NULL,
  expiry character varying(32) NULL,
  last_used character varying(32) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT employee_skill_pkey PRIMARY KEY (id),
  CONSTRAINT employee_skill_slug_key UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_employee_skill_emp ON employee_skill USING btree (employee_slug) TABLESPACE pg_default;
COMMENT ON COLUMN employee_skill.evidence IS '@type { type: string; title: string; detail: string }[]';


-- =============================================================
-- 表：approval（4 行，索引：approval_slug_key, approval_pkey）
-- =============================================================
CREATE  TABLE approval (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  linked_slug character varying(64) NULL,
  kind character varying(16) NULL,
  applicant character varying(64) NULL,
  avatar character varying(8) NULL,
  department character varying(128) NULL,
  title character varying(128) NOT NULL,
  current_level integer NULL,
  target_level integer NULL,
  source_label character varying(64) NULL,
  submitted_at character varying(64) NULL,
  due character varying(32) NULL,
  status character varying(32) NULL,
  detail text NULL,
  employee_response text NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT approval_pkey PRIMARY KEY (id),
  CONSTRAINT approval_slug_key UNIQUE (slug)
);


-- =============================================================
-- 表：idp_plan（1 行，索引：idp_plan_employee_slug_key, idp_plan_pkey）
-- =============================================================
CREATE  TABLE idp_plan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_slug character varying(64) NOT NULL,
  current_role_label character varying(128) NULL,
  target_role_label character varying(128) NULL,
  horizon character varying(64) NULL,
  readiness integer NULL,
  readiness_note text NULL,
  strengths jsonb NULL,
  weaknesses jsonb NULL,
  review_cadence character varying(512) NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT idp_plan_pkey PRIMARY KEY (id),
  CONSTRAINT idp_plan_employee_slug_key UNIQUE (employee_slug)
);
COMMENT ON COLUMN idp_plan.weaknesses IS '@type string[]';
COMMENT ON COLUMN idp_plan.strengths IS '@type string[]';


-- =============================================================
-- 表：idp_phase（4 行，索引：idx_idp_phase_plan, idp_phase_pkey）
-- =============================================================
CREATE  TABLE idp_phase (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  range_label character varying(128) NULL,
  title character varying(128) NULL,
  theme text NULL,
  objective character varying(255) NULL,
  milestone character varying(255) NULL,
  outcome text NULL,
  focus_gaps jsonb NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT idp_phase_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_idp_phase_plan ON idp_phase USING btree (plan_id) TABLESPACE pg_default;
COMMENT ON COLUMN idp_phase.focus_gaps IS '@type string[]';


-- =============================================================
-- 表：idp_action（13 行，索引：idx_idp_action_phase, idp_action_pkey）
-- =============================================================
CREATE  TABLE idp_action (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL,
  kind character varying(16) NULL,
  title character varying(255) NULL,
  gap character varying(128) NULL,
  window_label character varying(64) NULL,
  proof character varying(255) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  kind_label character varying(16) NULL,
  CONSTRAINT idp_action_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_idp_action_phase ON idp_action USING btree (phase_id) TABLESPACE pg_default;


-- =============================================================
-- 表：idp_milestone（5 行，索引：idx_idp_milestone_plan, idp_milestone_pkey）
-- =============================================================
CREATE  TABLE idp_milestone (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  time_label character varying(16) NULL,
  title character varying(128) NULL,
  detail character varying(255) NULL,
  state character varying(16) NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT idp_milestone_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_idp_milestone_plan ON idp_milestone USING btree (plan_id) TABLESPACE pg_default;


-- =============================================================
-- 表：idp_adjust_rule（4 行，索引：idx_idp_adjust_plan, idp_adjust_rule_pkey）
-- =============================================================
CREATE  TABLE idp_adjust_rule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  trigger_label character varying(128) NULL,
  action text NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT idp_adjust_rule_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_idp_adjust_plan ON idp_adjust_rule USING btree (plan_id) TABLESPACE pg_default;


-- =============================================================
-- 表：talent_candidate（10 行，索引：talent_candidate_slug_key, talent_candidate_pkey）
-- =============================================================
CREATE  TABLE talent_candidate (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  name character varying(64) NOT NULL,
  avatar_text character varying(8) NULL,
  avatar_tone character varying(16) NULL,
  org character varying(128) NULL,
  role character varying(128) NULL,
  tier character varying(16) NULL,
  available boolean NOT NULL DEFAULT true,
  reason character varying(255) NULL,
  note text NULL,
  evidence jsonb NULL,
  gap character varying(255) NULL,
  availability character varying(64) NULL,
  freshness character varying(32) NULL,
  dimensions jsonb NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT talent_candidate_pkey PRIMARY KEY (id),
  CONSTRAINT talent_candidate_slug_key UNIQUE (slug)
);
COMMENT ON COLUMN talent_candidate.evidence IS '@type string[]';
COMMENT ON COLUMN talent_candidate.dimensions IS '@type { label: string; value: number }[]';


-- =============================================================
-- 表：talent_shortlist_item（0 行，索引：idx_shortlist_item_unique, talent_shortlist_item_pkey）
-- =============================================================
CREATE  TABLE talent_shortlist_item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_slug character varying(64) NOT NULL,
  demand character varying(128) NOT NULL DEFAULT '具身智能业务探索'::character varying,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT talent_shortlist_item_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shortlist_item_unique ON talent_shortlist_item USING btree (candidate_slug, demand) TABLESPACE pg_default;


-- =============================================================
-- 表：succession_position（4 行，索引：succession_position_slug_key, succession_position_pkey）
-- =============================================================
CREATE  TABLE succession_position (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  title character varying(128) NOT NULL,
  family character varying(64) NULL,
  incumbent character varying(64) NULL,
  incumbent_meta character varying(128) NULL,
  immediate integer NULL,
  developing integer NULL,
  health character varying(16) NULL,
  health_text character varying(16) NULL,
  summary text NULL,
  risk text NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT succession_position_pkey PRIMARY KEY (id),
  CONSTRAINT succession_position_slug_key UNIQUE (slug)
);


-- =============================================================
-- 表：succession_candidate（9 行，索引：idx_succession_candidate_pos, succession_candidate_pkey）
-- =============================================================
CREATE  TABLE succession_candidate (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  position_slug character varying(64) NOT NULL,
  person_name character varying(64) NOT NULL,
  employee_slug character varying(64) NULL,
  avatar_text character varying(8) NULL,
  avatar_tone character varying(16) NULL,
  role character varying(128) NULL,
  gap character varying(255) NULL,
  state character varying(32) NULL,
  state_class character varying(32) NULL,
  bucket character varying(16) NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT succession_candidate_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_succession_candidate_pos ON succession_candidate USING btree (position_slug) TABLESPACE pg_default;


-- =============================================================
-- 表：team_project（1 行，索引：team_project_slug_key, team_project_pkey）
-- =============================================================
CREATE  TABLE team_project (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  title character varying(128) NOT NULL,
  period character varying(64) NULL,
  note character varying(255) NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT team_project_pkey PRIMARY KEY (id),
  CONSTRAINT team_project_slug_key UNIQUE (slug)
);


-- =============================================================
-- 表：team_role（4 行，索引：team_role_slug_key, idx_team_role_project, team_role_pkey）
-- =============================================================
CREATE  TABLE team_role (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying(64) NOT NULL,
  project_slug character varying(64) NOT NULL,
  title character varying(128) NOT NULL,
  headcount integer NULL,
  allocation character varying(8) NULL,
  skills jsonb NULL,
  candidate_slugs jsonb NULL,
  sort integer NOT NULL DEFAULT 0,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT team_role_pkey PRIMARY KEY (id),
  CONSTRAINT team_role_slug_key UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_team_role_project ON team_role USING btree (project_slug) TABLESPACE pg_default;
COMMENT ON COLUMN team_role.skills IS '@type { name: string; type: string }[]';
COMMENT ON COLUMN team_role.candidate_slugs IS '@type string[]';


-- =============================================================
-- 表：team_assignment（2 行，索引：team_assignment_role_slug_key, team_assignment_pkey）
-- =============================================================
CREATE  TABLE team_assignment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_slug character varying(64) NOT NULL,
  candidate_slug character varying(64) NOT NULL,
  _created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  _updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile NULL DEFAULT 
CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL::user_profile
    ELSE (concat('(', current_setting('app.user_id'::text, true), ')'))::user_profile
END,
  CONSTRAINT team_assignment_pkey PRIMARY KEY (id),
  CONSTRAINT team_assignment_role_slug_key UNIQUE (role_slug)
);


-- ---- 数据：skill_category（17 行）----
INSERT INTO "skill_category" ("id","slug","name","kind","parent_slug","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('01cfdad7-f261-4cb8-9223-77ec69bd77f9','cloud-native','云原生基础设施','professional','professional','4','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('048ae506-7507-4822-9390-aac0b890ddb6','eng-quality','工程质量','professional','professional','2','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('189b9e16-0185-4b5f-b4ab-f71a0e9d322d','sys-design','系统设计','professional','professional','3','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('1fa9281b-bfc1-4bc0-adec-78813e605314','org-mgmt','组织管理','generic','generic','4','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('27d37fba-088b-487e-8c81-6ade83ba9e16','professional','专业技能','professional',NULL,'1','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('370e8c76-c0c4-4e04-9aed-9b73f66e5a45','collab-impact','协作影响','generic','generic','3','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('4b7dfbed-cfcf-43d2-bb6c-1f9005931299','stability','稳定性工程','professional','professional','5','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('62b146a5-2d4e-4130-82e7-509bd02b5556','platform-eng','平台工程','professional','professional','8','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('67f01059-feff-4928-9c5e-b70bb45e7a00','coding-eng','编程与工程化','professional','professional','1','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('8f21f8ea-55cf-4e6a-905c-4dc27734cd69','generic','通用技能','generic',NULL,'2','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('9713a876-441b-4122-9c03-bbf94f86f9d9','collaboration','沟通协作','generic','generic','1','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('9821e17d-6020-4166-9d5e-d7edb8c091aa','rd-efficiency','研发效能','professional','professional','9','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('c2107fed-8b89-4374-962b-87a32cd36fac','business','业务理解','generic','generic','2','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('c8cee6e2-7582-4183-bf67-960df33caa49','eng-practice','工程实践','professional','professional','11','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('cd89e427-ca98-49dc-91b6-a2fb2ae65b52','ai-app','AI 应用开发','professional','professional','7','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('fc548333-3aee-49ee-9c7c-f2144d986c27','problem-solving','问题解决','professional','professional','10','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('ff6f97ee-8336-448f-8349-c27303725759','data-ai','数据与 AI','professional','professional','6','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)');

-- ---- 数据：skill（81 行）----
INSERT INTO "skill" ("id","slug","name","category_slug","_created_at","_created_by","_updated_at","_updated_by") VALUES ('000446ee-56cb-48a6-a948-bb7d5ad3a94d','on-site-decision','现场决策','problem-solving','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('01cb8844-af0b-4ff5-862f-30b1170891d2','data-loop','数据闭环','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('01d85d06-d25d-4c63-b9fc-fb32aff3ad8e','distributed-sys','分布式系统设计','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('04d3afbe-71b6-4dde-908a-508878a42cd6','model-eng','模型工程','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('07ecc79d-21bd-4286-9bc0-ad0491f92e10','business-planning','业务规划','business','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('09cbc610-6e18-4f9c-84dc-9ed01b53cf8b','perf-mgmt','目标与绩效管理','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('112dc094-0384-44f1-8e68-df667e474d30','ai-platform-arch','AI 平台架构','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('11a87d20-c7c5-4267-958a-7ea80c3f877d','infra-as-code','基础设施即代码','platform-eng','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('14f9ce89-aa82-485c-a46a-67b1c3d850c9','machine-learning','机器学习','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('19c488e4-f51c-4aa8-8958-d22e4372e507','multimodal','多模态','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('1ada834f-9f59-49c7-8246-bb407e26da0b','visual-perception','视觉感知','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('1b28417b-c182-46f7-b389-017605d8ff2d','real-hardware','真实硬件','eng-practice','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('1e7a14a6-dddc-4ade-b103-40e2519888b8','model-eval','模型评估','data-ai','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('21ce1570-4d4d-4ddd-858e-cc3568ce3923','task-delivery','任务交付','eng-practice','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('21f241ad-5f46-40a2-8dfb-5c8f35ba3924','intelligent-sys','智能系统设计','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('23042db1-4d37-4617-89f2-7ebcade70a9d','observability-building','可观测性建设','stability','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('231f9371-24de-47d7-901f-e3756f2d788d','tech-influence','技术影响力','collab-impact','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('253c3cce-4758-4eff-9621-100cc68f9b72','sim-platform','仿真平台','platform-eng','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('29b4f526-16a2-43a3-b08d-c0c78ca7f6ca','cost-capacity','成本与容量治理','platform-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('2a8b5685-f61a-4272-a023-1c46273bfcf9','slo-design','SLO 设计','stability','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('2e48e666-6a89-4e9f-a2f1-01cd461de9f9','motion-control','运动控制','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('3210cff2-8bf6-4841-b3c5-b2cdab8f6ad3','cloud-platform-dev','云平台开发','platform-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('32fbf81d-6860-4b15-8dbd-4f86de3e08be','k8s','容器与编排','cloud-native','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('33279f74-872f-43e3-8e5f-6ba77d6cf8e4','distributed-training','分布式训练','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('371a88c1-3f53-4959-ab04-55351c1e8551','pipeline-building','梯队建设','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('372c9bf5-7489-46ee-b5e2-1c8d4f16fd34','programming','编程语言基础','coding-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('397127a5-dd42-4bf8-a6f8-7ef4146e5596','vlm','视觉语言模型','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('414f14ea-7776-44c7-89ec-7a69031101db','incident-response','应急响应','stability','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('4447ffb0-b5d9-44f7-917b-12530bdacd26','ai-tech-strategy','AI 技术战略','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('45873ab3-a1e8-485b-9a80-20f9eed3f45d','communication','技术方案表达','collaboration','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('4ca34765-e1f1-48c4-9285-308c48cbccf0','data-analysis','数据分析','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('52b4e809-61e5-4322-8ba5-e03df287a38e','product-collab','产品协作','collaboration','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('55d55572-5183-42ed-92e5-5279af144f2f','security-gov','安全与治理','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('57abc2e5-3bcf-431a-82a5-19780a1c4d7f','sys-design','系统设计','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('5ac06a0b-165c-468a-a05b-f4870d3b6057','platform-tech-strategy','平台技术战略','platform-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('5b1b67db-dd74-49f5-b9dc-086a52e7afba','robot-perception','机器人感知','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('5d4fdd9b-8f12-438f-9a44-efdd6ad2d0af','embedded-system','嵌入式系统','coding-eng','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('66e91ca5-2cc6-455f-92ea-9ff989dc1b89','org-design','组织设计','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('6925c4e9-a8f8-41b8-8160-794f8c75503b','sys-design-split','系统设计与拆分','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('695a32fb-5469-4bef-b885-169457edbb58','observability','可观测性','stability','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('6cbcd9fe-8980-40a6-84f0-61f4d8b47829','project-planning','项目规划','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('71ad5f7a-7ea3-4344-8994-689489043340','risk-mgmt','风险管理','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('7825e8be-02eb-4262-923e-9d41fe7f7ebc','decision-planning','决策规划','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('78ecafbe-efcf-4bc7-89c6-a14fc6564f4e','auto-testing','自动化测试','eng-quality','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('79870a09-016c-427b-80b6-053e8a8f20f7','code-quality','代码质量','eng-quality','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('7c367075-79fb-4ba4-b4b5-e4450097e699','data-quality-gov','数据质量治理','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('80c3d4d6-1892-49fa-8776-def74f6aca90','robotics-industry','机器人行业','business','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('8492ecbc-f9dc-418f-a3ea-8e8a72f0304b','reinforcement-learning','强化学习','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('87772bc3-3e4b-42e0-bd6a-f9f64a6c832b','edge-deployment','端侧部署','cloud-native','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('8973bfea-d40b-49f3-a0fd-8efe5e0e4079','testing','自动化测试与质量门禁','eng-quality','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('8fdabd12-9bfe-425c-a962-c6cc708926c4','java-go-eng','Java / Go 工程化','coding-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('910cbe9e-d7ff-41f1-82ad-699dc95e0df8','system-design','系统设计与模块拆分','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('94af3012-4773-40c8-9485-ab0ed0e99fd1','retro','复盘改进','eng-practice','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('96730658-2ee2-45b9-bfda-a6cb0979d36d','tech-strategy','技术战略','org-mgmt','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('98789d2c-b077-40c3-8547-46ffbde0ca5f','project-collab','项目协作','collab-impact','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('99b51313-4fc1-42e6-b138-d4461db3545f','business-exploration','业务探索','business','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('9ab887f4-5cff-4293-9bfc-ab0a9111ce2e','collaboration','跨团队协作','collaboration','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('a133fa1e-cc96-4b52-9e1b-778a8d3d8a45','proactive-comm','主动沟通','collaboration','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('a699fcec-cac3-4e30-b550-f11500806360','sim-eval','仿真评估','data-ai','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('ae455c98-8a1a-487e-96d9-7c5a959acf63','hardware-debug','硬件调试','eng-practice','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('b1e0df7e-1bb2-4757-8814-0cd4bc9c3300','env-perception','环境感知','ai-app','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('b226e32c-07b7-4fb7-b1a0-312a14531027','domain-arch','领域架构','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('b685061a-49e2-446f-bef1-39eb64d1b209','resource-allocation','资源配置','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('c0e04b6d-bdc8-4a4a-b0d7-423bec1c9a10','platform-product','平台产品设计','platform-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('c3f11efe-a118-400e-b106-8304bd261777','requirements','需求理解','business','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('c7bb7bc8-adc5-49f4-906c-2abbe04aede6','engineering-quality','工程质量','eng-quality','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('c9fdc6c2-ff99-4d90-9773-ed271c047350','stability-gov','稳定性治理','stability','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('d40dc803-6a74-4dda-984d-16437c47c0d7','capacity-gov','容量治理','platform-eng','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('d6a0d5b6-dcc3-4ff4-8ead-50abac420e7f','infra-arch','基础设施架构','platform-eng','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('d868ba1b-72e3-428d-bbeb-2cd5bb6f95ca','tech-decision','技术决策','org-mgmt','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('dcf5bea1-04a0-4860-8c44-2251bc716af1','data-processing','数据处理','data-ai','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('dfe2218b-4042-40f2-a728-f7c01c603da6','cross-team-synergy','跨团队协同','collaboration','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('e47bf44e-df54-4447-b0b0-930aa9b9105e','perf-capacity','性能与容量治理','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('e6019d07-44da-46f0-911a-5877ea97693d','org-governance','组织级治理','org-mgmt','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('eb33111b-cfd5-43e7-9ce6-b44ed3a19476','ai-integration','AI 应用集成','ai-app','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('ebf93dfa-34fa-4599-97ab-7acab0556014','quality-awareness','质量意识','eng-quality','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('ed9f7c1e-776f-483b-8488-c0bd199fc982','org-communication','组织沟通','collaboration','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('f087e708-5f0c-4a30-8ea9-f0d6898028f4','talent-dev','人才培养','org-mgmt','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)'),('f1476eac-3332-4787-9264-48299dd8c98b','automation-dev','自动化开发','rd-efficiency','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('f15fb80d-99f6-45c1-a8e3-3ce2869c336b','complex-project','复杂项目','eng-practice','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('f93dd918-f64f-43f7-8625-4e5441110b12','proposal-decision','技术方案决策','sys-design','2026-09-18 10:43:37+08:00','	(1809773148953787)','2026-09-18 10:43:37+08:00','	(1809773148953787)');

-- ---- 数据：skill_level_anchor（10 行）----
INSERT INTO "skill_level_anchor" ("id","skill_slug","level","anchor","_created_at","_created_by","_updated_at","_updated_by") VALUES ('07f0c287-528a-4565-a845-78d06b16096e','communication','2','能够清晰说明技术方案的目标、关键取舍与实施风险。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('0db2553c-4826-4dc2-b2a1-332f4ab0ad2d','code-quality','2','能够识别常见代码质量问题，完成重构并通过团队质量检查。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('3c9f0fdc-cd02-4a21-8560-29a0825b1481','observability','2','能够为单个服务配置指标、日志与基础告警，并完成常见问题定位。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('57a43c67-7281-4205-bb23-952b905b7273','requirements','3','L3 要求能够在复杂业务场景中澄清目标与边界，识别跨模块风险，并推动相关方形成一致验收标准。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('6ade2741-7d2d-45e8-b18b-a77f114b8b3b','k8s','2','能够独立完成常规服务的部署、配置排查与发布回滚，并能说明关键配置的作用。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('763a0198-4877-4617-8e92-e267891bac12','testing','2','能够为常规服务设计自动化测试，并在持续集成流程中配置覆盖率或质量门禁。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('ac843c0a-62f0-497e-891c-2aefbd028408','system-design','2','能够在明确边界下拆分中等复杂度模块，说明接口、数据流与异常处理，并通过方案评审。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('c7983e98-f7bf-4861-becc-905e8900d9e0','programming','2','能够独立完成常规功能开发，遵循团队编码规范并处理常见异常。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('d67c069d-6e8a-4595-8832-b7fcba0511d4','collaboration','3','能够协调多个团队解决目标冲突，形成明确决策并推动关键事项按约定交付。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)'),('d99910b1-4d4d-480a-97d0-51ca64a71e95','data-processing','2','能够完成常规数据清洗、转换与质量检查，产出可复用处理流程。','2026-09-18 10:43:38+08:00','	(1809773148953787)','2026-09-18 10:43:38+08:00','	(1809773148953787)');

-- ---- 数据：career_sequence（4 行）----
INSERT INTO "career_sequence" ("id","slug","label","description","channel","_created_at","_created_by","_updated_at","_updated_by") VALUES ('072705a9-c135-4c21-aeec-b2a179793207','platform','平台工程序列','云平台、稳定性与基础设施架构','tech','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('59683ba5-a036-424a-9b9f-cfd0dc772a74','software','软件开发序列','工程化、系统设计与技术影响力','tech','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('b763c8ec-e03d-441d-acd3-301bf24d208f','management','管理通道','项目规划、组织管理与梯队建设','management','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('bdee99f9-12c6-4af4-bf0c-8e73ea41cbea','ai','数据与 AI 序列','AI 应用、模型工程与智能系统架构','tech','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)');

-- ---- 数据：career_node（16 行）----
INSERT INTO "career_node" ("id","slug","sequence_slug","code","title","meta","state","coverage","description","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('2a11f84f-133b-4fe4-b9fd-89f57b6d5649','junior-platform','platform','T1','初级软件开发工程师','当前岗位','当前岗位','92','从软件开发基础出发，逐步补齐平台工程与稳定性能力。','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('54bd11f2-a8ae-41f3-82d4-52235afab4e9','junior-ai','ai','T1','初级软件开发工程师','当前岗位','当前岗位','92','从软件开发基础出发，逐步转向数据与 AI 应用工程方向。','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('68470bcf-c5eb-4a45-81d2-66e9fdf346fc','junior','software','T1','初级软件开发工程师','当前岗位','当前岗位','92','当前岗位基线共 6 项核心能力，5 项已满足，1 项需要复核。','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('77371217-4089-4ed8-aedd-459c55a0f14c','manager','management','M1','研发经理','管理通道','管理发展节点','31','要求具备目标管理、人员发展和资源配置能力。','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7fd7c987-3e9c-49de-93a7-3f9135756352','junior-m','management','T1','初级软件开发工程师','当前岗位','当前岗位','92','先建立稳定交付和协作基础，再逐步承担项目与团队责任。','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7fef1200-cd92-4099-97ad-08f23e75d611','senior','software','T3','高级软件开发工程师','远期方向','远期发展节点','39','该节点强调复杂系统设计、性能治理和跨团队技术影响力。','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('8b7b49d2-667e-4ded-b5ec-d6ef08ae7ede','expert','software','T4','资深 / 专家工程师','长期方向','长期发展节点','18','该节点要求形成跨业务域架构能力和组织级技术影响力。','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a13f888a-351d-437f-84ed-3e2f6cebee6a','senior-platform','platform','T3','高级平台工程师','远期方向','远期发展节点','34','该节点强调平台产品设计、稳定性治理和规模化工程能力。','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a5823fde-9ce7-4e30-9c4c-7f00ac49ca70','ai-engineer','ai','T2','AI 应用开发工程师','推荐下一站','推荐下一站','55','需掌握模型服务集成、数据处理和 AI 应用评估方法。','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a8e39576-2f6a-4382-a440-b2cab1417cac','director','management','M2','研发总监','长期方向','长期发展节点','12','面向组织级技术战略、业务规划和人才梯队建设。','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('ccc16e8b-6d5e-40c2-9860-f4a1252460f2','ai-architect','ai','T4','AI 架构专家','长期方向','长期发展节点','11','面向组织级 AI 架构、技术路线与安全治理。','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('d15477f3-4af4-449e-befe-c5f3d62280b1','senior-ai','ai','T3','高级 AI 工程师','远期方向','远期发展节点','28','该节点强调复杂智能系统设计、模型工程和业务效果治理。','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('d1ffb119-0362-4c59-bb5a-c5fe0ed7fc79','lead','management','M0','项目技术负责人','推荐过渡节点','推荐过渡节点','58','在不承担正式管理职责前，先验证项目规划和协同能力。','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e369853f-2d39-424a-bf31-a8266d1290ed','platform-architect','platform','T4','平台架构专家','长期方向','长期发展节点','15','面向组织级基础设施架构、平台战略与工程体系建设。','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('f0f706f6-5ec4-443f-941c-8a9700a77ad5','middle','software','T2','中级软件开发工程师','推荐下一站','推荐下一站','67','需满足 6 项核心能力，当前已满足 4 项。预计 9-12 个月可达成。','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('f2e525e6-2920-4b60-9893-15a99c255cb9','platform-engineer','platform','T2','平台开发工程师','推荐下一站','推荐下一站','61','需建立云平台开发、自动化交付与可观测性基础，预计 9-12 个月可达成。','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)');

-- ---- 数据：career_node_skill（64 行）----
INSERT INTO "career_node_skill" ("id","node_slug","skill_slug","required_level","current_level","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('01a012df-5e82-40b3-8410-1734f8bbe850','junior-ai','code-quality','2','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('0c5c5a50-f758-495b-ab1f-8d57c5a1d681','ai-architect','ai-tech-strategy','4','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('0fb56531-3a4a-4193-91d1-5ea0a47eed27','director','pipeline-building','4','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('120508ad-c2ab-4549-979c-f50f4867fb54','junior-m','retro','2','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('14a2619d-64c4-4b85-a0fa-330aeb2903bf','junior','programming','2','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('184ac7af-25df-42a7-97b1-e291c40972b8','senior','proposal-decision','4','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('1e08f861-fb7b-4de3-8085-a718ee9c3516','ai-engineer','model-eval','3','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('1e36de25-ae69-464e-b843-1c3cdaa072b4','platform-architect','platform-tech-strategy','4','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('258ff784-5902-4ddc-a6d6-a97a2e686a0c','platform-engineer','collaboration','3','3','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('2a898e87-9a1c-40c5-b30a-3859371c84e5','ai-engineer','ai-integration','3','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('2d2b1c74-294a-4d23-99d0-c14439732d25','director','business-planning','4','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('33a6331f-24a9-4dfa-b0cb-ba2672cdd4d4','lead','project-planning','3','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('3b1908da-4e02-4a3a-bb89-557e26ab8138','junior','auto-testing','2','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('410801a9-7be1-45dc-b499-a8272a428a34','junior-m','quality-awareness','2','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('416d0703-c613-49e9-8e8a-4c72fb2677a3','platform-engineer','observability-building','3','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('53ddaaaf-cdf9-4cb7-97bd-2f8ae01955c5','senior','tech-influence','3','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('56a5fbd2-2fa8-4725-82f9-369e89c9bdf8','ai-architect','security-gov','4','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('56e9f8da-fdc6-48ce-86e1-ff52954255d2','lead','risk-mgmt','3','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('5d9ef86e-f48f-43ee-b8c2-42191b2bbc95','junior-platform','code-quality','2','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('5e747441-eeff-458f-a563-87cfdb2b923d','junior-platform','programming','2','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('5f366b50-55bc-466f-b3c0-c5b0901cc7bd','senior-platform','cost-capacity','4','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('696bb28f-f104-4a29-8575-69628bfaa8b8','senior-platform','stability-gov','4','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('6f66d1fd-d3d0-4e6d-b181-acb3c56c07a5','senior-ai','model-eng','4','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('71fc3417-8f85-400f-9449-cfd5f643c1fc','expert','tech-strategy','4','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('76b70733-f468-4978-8a4f-6373d4d62e70','platform-architect','org-governance','4','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('77844375-02b6-4c70-be7b-9e0aa503d97c','director','tech-strategy','4','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7900dbff-00c8-40e2-97d2-8f28e68292db','junior-ai','requirements','2','2','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7b80e7f6-14cc-416d-bb71-07bafb4b403a','junior-m','proactive-comm','2','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7da3fbe2-b217-4f21-932d-20394351b696','lead','tech-decision','3','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('7ec93799-71d5-44ab-a91b-a1f334ca768a','junior-ai','programming','2','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('81a3ce8f-c929-487f-a35f-846f71c26cc4','junior-m','task-delivery','2','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('869c50de-6d3a-4d7e-8327-5a309ddac8d5','lead','cross-team-synergy','3','3','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('8bd2c481-573b-4cb9-9bf8-af180b54931f','expert','domain-arch','5','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('90803804-9842-4442-a870-0ea79eeae204','expert','org-governance','4','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('90a6609c-266b-4f4a-be08-889ef3a8e877','ai-engineer','product-collab','3','2','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('96461cfe-f503-4a1a-b2d5-2f4011bb61a4','junior-ai','auto-testing','2','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('9dc5f327-c636-462e-8de2-97251bf69ae9','ai-engineer','data-processing','3','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a357dc7c-8fc6-4ba8-aaf8-a73b995cf283','middle','engineering-quality','3','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a44625a0-e906-4b9c-a0c3-2297966c04a8','senior-platform','platform-product','4','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a45347c9-bbeb-452d-9258-e5d5e3b6d707','junior','requirements','2','2','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a77ab543-5ff3-4ae8-be15-caa439935371','senior','distributed-sys','4','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a7df5131-9fcd-4551-be02-c5481b30fe35','senior','perf-capacity','4','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a857d8a2-c3ce-44ac-bf08-d7a9c3ddff81','platform-engineer','cloud-platform-dev','3','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('a9c493e5-33ea-4735-aefc-f1383065678f','platform-architect','infra-arch','5','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('bc795183-408b-4402-9a02-0a307cf6ca7b','senior-platform','tech-influence','3','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('c2d09f08-2feb-4f17-be16-16e0e59e9e08','platform-engineer','k8s','3','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('c5371900-31d9-4546-af08-f4ce10f2db96','manager','talent-dev','3','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('c8b5370f-7271-4f8b-ae4e-50be08205db6','manager','org-communication','3','2','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('ca165817-e5af-48c4-a65a-b40e3cc127c0','senior-ai','intelligent-sys','4','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('cc1e3c60-e5e2-4900-9021-0c08f4d1457f','junior','code-quality','2','2','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('d1bee9a5-5d58-4bc8-aa69-989b8924fb1e','senior-ai','tech-influence','3','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('dec087d7-7289-4875-901b-dbbbfd24fd62','senior-ai','data-quality-gov','4','2','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e29bd47e-4161-4317-b3ca-578d17583a70','manager','resource-allocation','3','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e57d2bad-4e4b-4957-905c-6ef3d5ade92c','director','org-design','4','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e599527b-db7a-405b-aac1-8f12dac174ca','middle','sys-design-split','3','1','2','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e69a70e5-a75e-407d-9da7-fa369c4a9bc3','manager','perf-mgmt','3','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('e99bcecc-189d-4db8-8475-6875efc7ceb8','junior-platform','auto-testing','2','1','3','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('ec86efd2-5bf6-46e4-91d5-c9636cad9ff8','ai-architect','talent-dev','4','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('ed599210-9b22-418c-84c1-961ade2b10c7','junior-platform','requirements','2','2','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('ee70be60-5238-4dc4-859c-2547624bc6e7','middle','collaboration','3','3','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('f4d51546-40ee-4858-9dec-46cdf23f76f6','platform-architect','talent-dev','4','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('f8ff1ff2-3b83-40c3-ac7b-a377ecae353f','ai-architect','ai-platform-arch','5','1','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('fc4714b6-4f51-4621-896e-3d2e34bfd918','expert','talent-dev','4','1','4','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)'),('fef21aca-0ccc-4595-b1ec-96d42ad66af9','middle','java-go-eng','3','2','1','2026-09-18 10:43:41+08:00','	(1809773148953787)','2026-09-18 10:43:41+08:00','	(1809773148953787)');

-- ---- 数据：employee（4 行）----
INSERT INTO "employee" ("id","slug","name","avatar_text","avatar_tone","role","org","status","summary","summary_description","goal","next_checkin","availability","readiness","readiness_value","readiness_copy","tenure_summary","responsibilities","collaboration","updated_label","is_current_user","development_actions","management_profile","birth_year","gender","education","hire_date","_created_at","_created_by","_updated_at","_updated_by") VALUES ('21844f1a-2641-4cf7-b31a-3999b2a63b46','zhou-chen','周晨','周','amber','高级平台工程师 · T3','平台工程部 / 云基础设施组 · 北京','在职','可独立负责平台核心模块，正在补齐组织级架构治理能力','近两个季度承担跨团队平台升级，交付稳定；适合作为平台架构师后备候选，通过真实项目验证技术决策与跨域推动能力。','T4 平台架构师','2026-09-22','10 月可投入 40%','6–9 个月可进入候选评审','68','目标岗位 6 项核心能力，当前满足 4 项','在职 3 年 6 个月，经历 2 个岗位。',E'"[{\\"meta\\": \\"2026 Q3 OKR · 权重 40%\\", \\"text\\": \\"提升平台稳定性和自助服务覆盖，支撑核心业务规模增长。\\", \\"label\\": \\"业务目标\\"}, {\\"meta\\": \\"覆盖 46 项服务 · 协作 6 个团队\\", \\"text\\": \\"统一可观测平台升级，负责技术方案、迁移节奏与跨团队验收。\\", \\"label\\": \\"项目责任\\"}, {\\"meta\\": \\"规范已被 6 个研发团队采用\\", \\"text\\": \\"维护平台接入标准并带教 2 名工程师。\\", \\"label\\": \\"组织责任\\"}]"',E'"[{\\"text\\": \\"复杂技术方案共创、平台类跨团队项目\\", \\"label\\": \\"擅长合作场景\\"}, {\\"text\\": \\"先提供书面背景与关键约束，再集中决策\\", \\"label\\": \\"沟通偏好\\"}, {\\"text\\": \\"增加组织级方案评审与代理负责人机会\\", \\"label\\": \\"管理者建议\\"}]"','更新于 2026-09-14','false',E'"[{\\"proof\\": \\"证明：组织级方案、决策记录与项目复盘\\", \\"ratio\\": \\"70% 实践\\", \\"action\\": \\"担任下一次跨域平台治理项目代理负责人\\"}, {\\"proof\\": \\"证明：评审意见闭环记录\\", \\"ratio\\": \\"20% 反馈\\", \\"action\\": \\"每月与集团架构师完成一次方案评审\\"}, {\\"proof\\": \\"证明：组织级技术提案答辩\\", \\"ratio\\": \\"10% 学习\\", \\"action\\": \\"完成技术战略表达专项训练\\"}]"',E'"{\\"scope\\": \\"平台工程组 8 人（含 2 名外包）\\", \\"style\\": \\"目标导向 · 授权式\\", \\"years\\": \\"4 年\\", \\"hasTeam\\": true, \\"styleDetail\\": \\"拆解目标后按成员专长分派，重结果复盘轻过程干预；擅长跨团队资源协调。\\", \\"collaborationFit\\": \\"习惯与产品、算法团队接口协作，风格直接高效，适配项目制组织。\\"}"','1994','男','硕士 · 北京邮电大学 · 计算机系统结构','2023.03','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('348d80f0-a4e9-414d-8442-71ab8761cdc6','chen-ran','陈然','陈','green','基础架构工程师 · T3','平台工程部 / 基础设施组 · 杭州','在职','自动化和基础设施能力扎实，发展目标仍需共同确认','在基础设施自动化项目中交付表现稳定，目前承担核心项目，短期可用性有限。建议先完成发展目标沟通，再决定进入专家或管理通道。','待确认','已逾期 5 天','当前核心项目占用 80%','发展目标待确认','42','当前岗位能力满足，下一阶段目标尚未确认','在职 2 年 8 个月，经历 2 个岗位。',E'"[{\\"meta\\": \\"2026 Q3 OKR · 权重 45%\\", \\"text\\": \\"降低环境交付时间与人工运维成本。\\", \\"label\\": \\"业务目标\\"}, {\\"meta\\": \\"当前核心项目 · 投入 80%\\", \\"text\\": \\"环境交付自动化平台核心开发，负责策略引擎和异常回滚。\\", \\"label\\": \\"项目责任\\"}, {\\"meta\\": \\"27 条策略已上线\\", \\"text\\": \\"维护基础设施策略库和代码评审规范。\\", \\"label\\": \\"组织责任\\"}]"',E'"[{\\"text\\": \\"工具共建、自动化改造、复杂问题定位\\", \\"label\\": \\"擅长合作场景\\"}, {\\"text\\": \\"给出明确目标和验收标准，减少低效会议\\", \\"label\\": \\"沟通偏好\\"}, {\\"text\\": \\"尽快完成发展沟通并协调当前项目负载\\", \\"label\\": \\"管理者建议\\"}]"','更新于 2026-09-11','false',E'"[{\\"proof\\": \\"证明：验收结果与协作方反馈\\", \\"ratio\\": \\"70% 实践\\", \\"action\\": \\"完成当前平台项目并承担一次跨团队需求澄清\\"}, {\\"proof\\": \\"证明：发展目标确认记录\\", \\"ratio\\": \\"20% 反馈\\", \\"action\\": \\"与管理者完成专家和管理双通道探索\\"}, {\\"proof\\": \\"证明：方案评审通过\\", \\"ratio\\": \\"10% 学习\\", \\"action\\": \\"补充技术方案表达训练\\"}]"',E'"{\\"scope\\": \\"曾作为技术负责人牵头 4 人跨职能项目组（仿真平台）\\", \\"style\\": \\"技术牵头 · 共识式\\", \\"years\\": \\"1.5 年\\", \\"hasTeam\\": false, \\"styleDetail\\": \\"无正式管理职责，以方案评审与结对方式带动小组，重大决策倾向共识驱动。\\", \\"collaborationFit\\": \\"跨团队协作评价良好，擅长与算法、业务方对齐技术边界。\\"}"','1996','男','本科 · 华中科技大学 · 计算机科学与技术','2024.06','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('4d0ac383-ea10-423f-b29b-0af99d97ec92','zhang-san','张三','张','blue','软件开发工程师 · T1','平台研发部',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'true',NULL,E'"{\\"scope\\": \\"暂无带团队经验，担任过 3 人虚拟小组的迭代牵头人\\", \\"style\\": \\"协作型贡献者\\", \\"years\\": \\"—\\", \\"hasTeam\\": false, \\"styleDetail\\": \\"以高质量交付建立影响力，主动补位团队流程缺口。\\", \\"collaborationFit\\": \\"适应导师制与敏捷协作节奏，跨团队沟通尚在积累中。\\"}"','2001','男','本科 · 西安电子科技大学 · 软件工程','2025.07','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('b2a9c37c-c5dc-46f0-a0f5-251e8076ba9d','lin-xiao','林晓','林','green','SRE 专家 · T3','平台工程部 / 稳定性工程组 · 上海','在职','稳定性与应急治理能力突出，可短期代理 SRE 负责人','具备高压场景下的技术判断和现场协调经验。若完成一次大型保障项目的代理负责人验证，可进入正式继任评审。','SRE 负责人','2026-09-25','立即可投入 50%','可短期代理','82','岗位 7 项核心能力，当前满足 6 项','在职 4 年 2 个月，经历 3 个岗位。',E'"[{\\"meta\\": \\"2026 Q3 OKR · 权重 50%\\", \\"text\\": \\"保障核心交易链路稳定性，季度可用性达到 99.99%。\\", \\"label\\": \\"业务目标\\"}, {\\"meta\\": \\"覆盖 8 个核心系统\\", \\"text\\": \\"核心链路稳定性治理，负责 SLO、容量和应急演练。\\", \\"label\\": \\"项目责任\\"}, {\\"meta\\": \\"18 项改进已闭环\\", \\"text\\": \\"维护故障复盘机制并带教 2 名 SRE 工程师。\\", \\"label\\": \\"组织责任\\"}]"',E'"[{\\"text\\": \\"生产保障、复杂故障处置、跨团队演练\\", \\"label\\": \\"擅长合作场景\\"}, {\\"text\\": \\"紧急事项直接同步，日常决策保留书面记录\\", \\"label\\": \\"沟通偏好\\"}, {\\"text\\": \\"在下一次大促保障中担任代理负责人\\", \\"label\\": \\"管理者建议\\"}]"','更新于 2026-09-13','false',E'"[{\\"proof\\": \\"证明：资源决策、人员协调与复盘结果\\", \\"ratio\\": \\"70% 实践\\", \\"action\\": \\"在下一次大型保障中担任代理负责人\\"}, {\\"proof\\": \\"证明：反馈记录与行为改进\\", \\"ratio\\": \\"20% 反馈\\", \\"action\\": \\"由现任负责人进行双周管理复盘\\"}, {\\"proof\\": \\"证明：案例答辩\\", \\"ratio\\": \\"10% 学习\\", \\"action\\": \\"完成人员绩效与教练技术训练\\"}]"',E'"{\\"scope\\": \\"SRE 值班小队 5 人\\", \\"style\\": \\"流程严谨 · 教练式\\", \\"years\\": \\"3 年\\", \\"hasTeam\\": true, \\"styleDetail\\": \\"以值班手册与复盘机制带队，重视培养成员独立处置能力。\\", \\"collaborationFit\\": \\"与研发团队以服务等级协议为协作契约，沟通清晰有据。\\"}"','1992','女','硕士 · 上海交通大学 · 软件工程','2023.08','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)');

-- ---- 数据：employee_experience（7 行）----
INSERT INTO "employee_experience" ("id","employee_slug","period","role","org","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('3ae52e64-8b26-4dbb-852d-e2b6c9333eae','zhou-chen','2024.04–至今','高级平台工程师 · T3','平台工程部 / 云基础设施组','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('5b8dcca2-dbd8-4503-a556-c2f465d3a7a6','lin-xiao','2023.07–2024.12','高级 SRE 工程师 · T3','基础技术部','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('85162df2-cd92-4b42-835b-2c7f70d95984','lin-xiao','2022.07–2023.06','SRE 工程师 · T2','基础技术部','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('a5854ed9-74c4-4902-9067-240f2a186180','chen-ran','2025.03–至今','基础架构工程师 · T3','平台工程部 / 基础设施组','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('c5d4f8dc-0943-46a1-bffe-28b95059efed','chen-ran','2024.01–2025.02','平台开发工程师 · T2','研发效能部','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('dc7381a2-8ce5-4363-a87b-fc8ee89d578c','lin-xiao','2025.01–至今','SRE 专家 · T3','平台工程部 / 稳定性工程组','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('f263dad5-d890-4ef5-b67c-39183568bee3','zhou-chen','2023.03–2024.03','平台工程师 · T2','云平台事业部 / 容器平台组','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)');

-- ---- 数据：employee_trait（15 行）----
INSERT INTO "employee_trait" ("id","employee_slug","badge","title","detail","source","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('2485c632-db64-4a1c-a5c7-eec3b45e8fcd','zhou-chen','教','知识沉淀','持续维护平台接入规范，近半年完成 4 次内部分享与 2 次新人带教。','来源：知识库 · 导师记录','4','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('32b58486-c3dd-4055-9bea-e4c1f1b8145e','lin-xiao','稳','应急治理','近一年主导 5 次重大故障复盘，推动 18 项系统性改进按期闭环。','来源：故障复盘 · SLO 数据','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('3bbfe3b0-ef24-46ef-9245-8196e8bdcf92','chen-ran','向','方向探索中','同时对平台专家和技术管理感兴趣，尚未确认正式目标。','来源：员工自述 · 待共同确认','5','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('3cb7452c-b390-4469-baf6-ac53df686c89','zhou-chen','协','跨团队推动','能够协调研发、运维与业务团队，但组织级共识建设仍需更多验证。','来源：管理者反馈 · 协作方反馈 4 条','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('4aa410c9-62c0-4ac2-8c30-0b76e9078ac5','lin-xiao','带','带教反馈','已带教 2 名 SRE 工程师，反馈及时且目标明确。','来源：导师记录','4','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('5e75d770-1df7-4ec9-adf8-ad5caa90776c','chen-ran','实','工程落地','擅长将平台设计落到可维护工具，重视回滚与异常处理。','来源：代码与方案评审','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('690ba055-b3e8-48e3-93c4-25d3f2562bc7','lin-xiao','判','现场决策','能在信息不完整时快速识别关键路径，并明确止损顺序。','来源：专家评审 3 次','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('6a083a6b-87c3-4809-94d5-ee96acb4f953','chen-ran','协','协作直接','技术沟通清楚直接，跨团队背景同步可以更充分。','来源：协作反馈 3 条','4','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('80d48478-def8-43a4-aae1-346300e4c3ed','chen-ran','自','自动化实践','持续减少重复运维操作，近半年推动 9 条人工流程自动化。','来源：项目成果 2 项','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('9288394e-5f1c-40cc-8898-135342105160','chen-ran','稳','交付可靠','核心项目按期交付，但多项目并行时需要更早暴露资源风险。','来源：项目复盘','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('95952d6a-368d-4eb5-bebb-eb72e72c8087','zhou-chen','稳','稳定性交付','负责服务治理期间关键链路可用性保持 99.97%，故障恢复时间下降 32%。','来源：项目指标 · 2026 Q2 复盘','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('9e5fdfbc-8890-4f80-adfd-6276f96262de','zhou-chen','向','架构方向明确','员工与管理者已共同确认平台架构师方向，愿意承担跨域治理项目。','来源：发展目标 · 2026-07-08 确认','5','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('bf2ea20f-6570-48ef-8b58-3aebaa86230a','lin-xiao','协','跨团队协调','与业务研发协作稳定，适合承担大型保障项目现场负责人。','来源：协作方反馈 6 条','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('e6fed1ef-811e-4644-924b-e343fb8a97b2','lin-xiao','向','管理意愿明确','愿意承担团队管理职责，希望先通过代理项目验证。','来源：发展目标 · 2026-06-19 确认','5','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('f734aa1e-1cab-4f45-a01f-681ad8559ae6','zhou-chen','构','复杂系统拆解','能将跨域需求拆解为稳定的平台边界，近 3 个项目均承担方案设计。','来源：项目成果 3 项 · 专家评审 2 次','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)');

-- ---- 数据：employee_project（9 行）----
INSERT INTO "employee_project" ("id","employee_slug","time_range","title","responsibility","actions","outcome","impact","contribution","skills","verification","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('1759742e-5dc6-44bb-8aa3-480f94ef1fce','zhou-chen','2026.03–08','统一可观测平台升级','对 46 项核心服务的迁移质量、告警标准和跨团队验收负责。','完成现状盘点与分级设计，组织 6 个团队分批迁移，主持 3 次风险评审。','统一观测平台、分级告警规范和迁移手册均已验收，规范被 6 个团队复用。','高优告警误报量下降 41%，故障定位中位时长由 28 分钟降至 16 分钟。','主导',E'"[\\"可观测性建设 L4\\", \\"系统设计 L3\\", \\"跨团队协作 L3\\"]"','已验收 · 已复用','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('1d0a336d-c6b5-457e-a3df-27dc0a95e319','zhou-chen','2025.07–10','计费平台模块化重构','解决计费与结算耦合导致的发布阻塞和故障扩散。','牵头划分模块边界，制定接口契约并负责第一阶段核心模块改造。','结算与计费模块独立发布，关键接口测试和架构文档完成验收。','发布周期由双周缩短至每周，相关变更故障数下降 27%。','模块负责人',E'"[\\"系统设计与拆分 L3\\", \\"工程质量 L3\\"]"','已验收','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('3ff99f38-f746-4732-bd47-6163ce0046f0','lin-xiao','2025.06–09','故障演练体系建设','建立可重复执行的季度故障演练机制。','设计 6 类故障场景，组织业务研发和基础设施联合演练。','演练手册和复盘模板被 8 个系统采用。','重大故障平均恢复时长下降 24%。','机制负责人',E'"[\\"应急响应 L4\\", \\"跨团队协作 L4\\"]"','已复用','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('56dae767-ecad-4c64-bbde-9ca3be391011','chen-ran','2026.04–至今','环境交付自动化平台','负责策略引擎、异常回滚和核心交付链路。','实现环境编排、策略校验和失败回滚，处理 14 类历史异常。','核心模块已通过阶段验收，覆盖 5 类标准环境。','标准环境交付由 2 天降至 40 分钟，人工操作减少 72%。','核心开发',E'"[\\"自动化开发 L4\\", \\"基础设施即代码 L4\\"]"','阶段验收','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('5e6f4a8c-cc28-487e-8219-c6001cb95fe8','chen-ran','2025.12–2026.03','基础设施策略治理','补齐上线前基础设施合规校验。','梳理高频问题并实现 27 条策略规则和本地校验工具。','规则库和校验工具完成验收，接入 4 条发布流水线。','配置类生产问题下降 31%。','主要贡献者',E'"[\\"基础设施即代码 L4\\", \\"工程质量 L3\\"]"','已验收 · 已复用','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('7b0bb295-2ad2-4694-a8b2-197a5eecd3d3','chen-ran','2025.08–11','生产环境容器治理','识别不合规资源配置并完成存量整改。','开发扫描工具，推动 32 个服务完成资源规范整改。','资源检测工具纳入月度巡检。','资源超配成本下降 12%。','模块负责人',E'"[\\"容器与编排 L3\\", \\"数据分析 L2\\"]"','已验收','3','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('7cd5c682-d22d-402a-b21f-668479c0cf7f','lin-xiao','2025.10–11','双十一保障','负责高峰期容量判断和现场应急指挥。','完成峰值压测、风险分级与应急排班，现场处理 2 次流量突增。','保障方案通过评审，峰值期间无重大故障。','实际峰值高于预估 18% 时系统仍保持稳定。','现场负责人',E'"[\\"容量治理 L3\\", \\"现场决策 L4\\"]"','已复盘','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('8e1b761e-a515-4f51-9cbc-99c2e620b36b','lin-xiao','2026.05–08','核心链路稳定性治理','对核心交易链路 SLO、容量基线和应急预案负责。','重构 SLO 指标，推动 18 项风险整改，并组织两轮全链路演练。','SLO 看板、容量基线和预案全部验收，8 个系统接入季度复盘机制。','可用性提升至 99.99%，高优告警减少 37%。','主导',E'"[\\"SLO 设计 L4\\", \\"应急响应 L4\\"]"','已验收 · 持续使用','1','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)'),('e9deef60-e3f8-4ff8-a777-93ecbd7a0d2e','zhou-chen','2025.11–2026.02','容器平台生产集群迁移','保障 18 个核心业务在生产集群迁移期间连续可用。','设计双轨迁移与回滚方案，完成容量演练并担任迁移窗口现场负责人。','18 个业务按计划完成迁移，方案、脚本和复盘记录通过专家评审。','迁移期间核心业务零中断，后续集群交付周期缩短 35%。','核心负责人',E'"[\\"容器与编排 L4\\", \\"风险管理 L3\\"]"','已验收 · 已沉淀','2','2026-09-18 10:43:39+08:00','	(1809773148953787)','2026-09-18 10:43:39+08:00','	(1809773148953787)');

-- ---- 数据：performance_record（12 行）----
INSERT INTO "performance_record" ("id","employee_slug","period","rating","summary","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('12e635c8-be66-4231-82f9-0385f0d1b2c5','zhou-chen','2025-H1','B+','项目中期资源协调出现延迟，整体仍达成核心目标。','3','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('52c66d0b-53bc-4411-8a05-c6cc6fc34e56','zhang-san','2025-H1','—','入职试用期，评价为按时达成带教目标。','3','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('537d4af7-31d9-4777-8dd0-5b397e800264','zhang-san','2025-H2','B','新人 ramp-up 阶段，完成全部基础培训与两个迭代交付。','2','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('55405641-e75f-40a7-ae96-eb0e48b9f628','chen-ran','2025-H2','B','分布式训练支持项目中期人力不足，调整范围后达成主要目标。','2','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('82a340ee-4f1c-4418-9d7f-ab2cc830e127','lin-xiao','2025-H1','B+','跨团队推进成本优化项目，个别里程碑延期一周。','3','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('a27459f0-0f5d-425c-8cb7-fea65676c358','lin-xiao','2025-H2','A','可观测性平台建设获公司级技术奖提名。','2','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('be6bd397-b486-4606-afaa-56b6653892dc','lin-xiao','2026-H1','A','SRE 值班体系落地，MTTR 缩短一半， mentoring 两名新人独立值班。','1','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('d0749451-5a64-4cf1-bf8b-199a0feb73c0','chen-ran','2026-H1','B+','仿真平台底座按期交付，工程质量评审全票通过。','1','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('f20130e0-3f11-4a98-aefa-1c257105731f','chen-ran','2025-H1','B+','内部工具链改进获得使用团队好评。','3','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('f93a6934-563e-4961-84de-1a0220b7cb9e','zhou-chen','2026-H1','A','平台稳定性专项超出预期，全年事故率下降 40%，被评为部门关键技术贡献者。','1','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('fad40f0f-84ea-4996-9c1f-eb02d05a9b62','zhang-san','2026-H1','B+','首个正式项目按期上线，代码评审质量稳步提升。','1','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)'),('fdf1df9d-d738-4983-a6f8-eede0d7b091d','zhou-chen','2025-H2','A','主导发布系统重构按期交付，跨团队协作评价优秀。','2','2026-09-18 13:34:49+08:00','	(1809773148953787)','2026-09-18 13:34:49+08:00','	(1809773148953787)');

-- ---- 数据：skill_event（12 行）----
INSERT INTO "skill_event" ("id","employee_slug","date_label","total","title","category","level","evidence","approver","note","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('5d68c3bf-7590-4291-88b6-40156448dd47','zhang-san','2025.03','7','Git 协作流程','专业技能 / 工程实践','未点亮 → L1','代码仓库记录 + 项目复盘','陈老师','首次通过真实项目交付点亮工程实践技能。','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('7cb9f9cf-6b40-4bf9-9a72-cc55bf6d0455','zhang-san','2026.06','15','可观测性','专业技能 / 稳定性工程','未点亮 → L2','指标看板 + 告警运行记录','李经理','为核心服务补齐指标、日志和基础告警。','9','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('8bd0f995-802e-43e1-b823-d5fa2cb41c98','zhang-san','2025.06','8','服务问题排查','专业技能 / 问题解决','未点亮 → L1','故障复盘 + 值班记录','李经理','能够按标准流程定位并处理常见线上问题。','3','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('8bd37e24-5d31-473e-818b-fa933968322f','zhang-san','2025.12','11','需求理解','通用技能 / 业务理解','未点亮 → L2','需求文档 + 验收记录','李经理','能够澄清需求目标、边界和验收标准。','5','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('95e5871b-64fa-4452-8d72-bb3686c63a31','zhang-san','2026.04','13','数据处理','专业技能 / 数据与 AI','未点亮 → L2','数据管道成果 + 代码评审','陈老师','形成可复用的数据清洗与质量检查流程。','7','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('a3eeaf4e-54f0-4193-b08b-080a176cd1ed','zhang-san','2026.08','17','代码质量','专业技能 / 工程质量','未点亮 → L2','重构成果 + 专家评审','陈老师','形成持续可执行的代码质量检查方式。','11','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('a4709f80-86a6-4dd2-984d-98abb2167281','zhang-san','2025.10','10','编程语言基础等 2 项','专业技能 / 编程与工程化','新增点亮 2 项','项目代码 + 专家评审','陈老师','在连续两个版本中独立完成核心功能交付。','4','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('d5c76cf5-b579-4743-b848-244dc6d043c5','zhang-san','2026.09','18','技术方案表达','通用技能 / 沟通协作','未点亮 → L2','方案答辩 + 直属经理评估','李经理','能够清晰说明方案目标、关键取舍与实施风险。','12','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('f23a323f-01fc-4239-9d04-1c0b8d48f7aa','zhang-san','2026.05','14','技术文档','通用技能 / 沟通协作','未点亮 → L2','方案文档 + 团队反馈','李经理','文档可支持跨团队评审和后续实施。','8','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('f78cdba8-b47d-45b2-af28-061ff3fc5ff8','zhang-san','2026.07','16','容量评估','专业技能 / 系统设计','未点亮 → L1','压测报告 + 容量方案','陈老师','完成核心链路容量预估与风险说明。','10','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('f8c787fe-a7c6-4f4b-a8e8-a1b4186edef6','zhang-san','2024.12','6','首次技能基线确认','专业技能与通用技能','6 项技能正式入池','岗位基线盘点 + 直属经理评估','李经理、HRBP','完成首次能力盘点，为后续技能成长建立可追溯基线。','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('fe2236b0-b542-489d-abd8-325404d5907b','zhang-san','2026.02','12','接口设计','专业技能 / 系统设计','未点亮 → L1','接口方案 + 评审记录','陈老师','完成订单域接口拆分并通过技术评审。','6','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：skill_gap（12 行）----
INSERT INTO "skill_gap" ("id","employee_slug","source","source_label","title","description","filled","target","level_range","priority","note","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('2ed1e047-de05-469c-aee0-35fd63a20d8c','zhou-chen','profile',NULL,'组织级架构治理',NULL,NULL,NULL,NULL,NULL,'当前 L2 / 目标 L4','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('5d9aeb08-19b8-4e9b-89ac-6d58e7f9a700','zhang-san','okr','OKR','AI Agent 应用集成','专业技能 / AI 应用开发 · KR3 目标推导','1','2','L1 → L2','p1',NULL,'5','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('6ee0ad5c-bc25-41b4-9351-2c152162de2c','zhou-chen','profile',NULL,'技术战略表达',NULL,NULL,NULL,NULL,NULL,'当前 L2 / 目标 L3','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('8f399b94-23fb-4b4e-ab54-a39153075a40','zhang-san','career','职业','系统设计与模块拆分','专业技能 / 系统设计 · 中级岗位要求','1','3','L1 → L3','p0',NULL,'1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('99a9a7a5-9596-4bf1-be25-8c19962153d1','zhang-san','career','职业','技术方案表达','通用技能 / 沟通协作 · 中级岗位要求','2','3','L2 → L3','p1',NULL,'6','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('a3ef78d8-4c66-4588-b217-f803eeae16d0','lin-xiao','profile',NULL,'人员绩效管理',NULL,NULL,NULL,NULL,NULL,'当前 L2 / 目标 L3','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('ab15b054-3ce5-46bc-8f2c-66754c1ac4a1','chen-ran','profile',NULL,'发展目标确认',NULL,NULL,NULL,NULL,NULL,'需要管理者共同确认','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('b09ee924-874f-4fb4-ba19-a4b75d733e42','zhang-san','current','岗位','自动化测试与质量门禁','专业技能 / 工程质量 · 当前岗位未达标','1','2','L1 → L2','p0',NULL,'4','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('c76e3970-4c19-4439-9f3d-c19a5f03ffb2','zhang-san','okr','OKR','服务稳定性与 SLO 设计','专业技能 / 稳定性工程 · O2 目标推导','1','3','L1 → L3','p0',NULL,'2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('cda857c5-efec-43e2-ac83-696e317f96f6','lin-xiao','profile',NULL,'组织级资源协调',NULL,NULL,NULL,NULL,NULL,'待真实场景验证','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('ce70ab33-f9dc-46e5-b0d9-121596497a89','zhang-san','career','职业','Java / Go 工程化实践','专业技能 / 编程与工程化 · 中级岗位要求','2','3','L2 → L3','p1',NULL,'3','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('e61cdff8-a743-4f84-8bff-61fa3b1d5928','chen-ran','profile',NULL,'跨团队背景同步',NULL,NULL,NULL,NULL,NULL,'建议纳入下一周期行动','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：employee_skill（22 行）----
INSERT INTO "employee_skill" ("id","slug","employee_slug","skill_slug","title","category","source","source_short","source_label","current_level","target_level","confidence","status","status_label","explanation","anchor","evidence","deadline","approved_at","expiry","last_used","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('10d98686-a903-4ff8-a0a4-0e99c45d535e','communication','zhang-san','communication','技术方案表达','通用技能 / 沟通协作','verified','已亮','方案答辩 + 直属经理评估','2','2','100','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-08-06。','能够清晰说明技术方案的目标、关键取舍与实施风险。',E'"[{\\"type\\": \\"认证\\", \\"title\\": \\"技术方案表达 L2 审批记录\\", \\"detail\\": \\"2026-08-06 · 正式生效\\"}, {\\"type\\": \\"来源\\", \\"title\\": \\"方案答辩 + 直属经理评估\\", \\"detail\\": \\"原始证明与审核意见已归档\\"}]"',NULL,'2026-08-06',NULL,NULL,'10','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('23f46980-ba8a-4289-80f2-8008730312d4','requirements','zhang-san','requirements','需求理解','通用技能 / 业务理解','lifecycle','复核','技能生命周期 · 长期未使用','3','2','38','review','待复核','过去 12 个月未发现可核验的需求分析工作或相关产出，系统按规则生成复核提醒。当前 L3 仍然有效，本提醒不会自动降低等级。','L3 要求能够在复杂业务场景中澄清目标与边界，识别跨模块风险，并推动相关方形成一致验收标准。',E'"[{\\"type\\": \\"规则\\", \\"title\\": \\"连续 12 个月无相关工作记录\\", \\"detail\\": \\"规则版本：业务理解类技能 v2.1\\"}, {\\"type\\": \\"最近\\", \\"title\\": \\"会员增长需求拆解与验收方案\\", \\"detail\\": \\"2025-08-18 · 已通过直属经理确认\\"}, {\\"type\\": \\"例外\\", \\"title\\": \\"可说明岗位调整或暂无实践机会\\", \\"detail\\": \\"复核期间保留当前正式等级 L3\\"}]"','2026-09-26',NULL,NULL,NULL,'7','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('36de5070-e103-4581-a7dd-94206e5cff70','chen-ran-automation-dev','chen-ran','automation-dev','自动化开发','专业技能 / 研发效能','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"9 条流程自动化成果\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-02',NULL,'2','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('39e34c5c-5667-4628-bff9-0442d7ddcb3d','zhou-chen-k8s','zhou-chen','k8s','容器与编排','专业技能 / 平台工程','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"生产集群迁移方案 + 专家答辩\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-03',NULL,'1','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('3ae892cd-ba54-4d9b-b373-4e384b67a8d5','lin-xiao-capacity-gov','lin-xiao','capacity-gov','容量治理','专业技能 / 平台工程','verified','已亮',NULL,'3','3','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"双十一容量压测方案\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-01',NULL,'3','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('3f6021fe-7fb5-49dd-9099-f09322479f8b','programming','zhang-san','programming','编程语言基础','专业技能 / 编程与工程化','verified','已亮','项目成果 + 专家评审','2','2','100','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-07-18。','能够独立完成常规功能开发，遵循团队编码规范并处理常见异常。',E'"[{\\"type\\": \\"认证\\", \\"title\\": \\"编程语言基础 L2 审批记录\\", \\"detail\\": \\"2026-07-18 · 正式生效\\"}, {\\"type\\": \\"来源\\", \\"title\\": \\"项目成果 + 专家评审\\", \\"detail\\": \\"原始证明与审核意见已归档\\"}]"',NULL,'2026-07-18',NULL,NULL,'5','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('4b863b8f-deba-4512-a9ef-8867e774f3e8','code-quality','zhang-san','code-quality','代码质量','专业技能 / 工程质量','verified','已亮','项目成果 + 专家评审','2','2','100','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-08-28。','能够识别常见代码质量问题，完成重构并通过团队质量检查。',E'"[{\\"type\\": \\"认证\\", \\"title\\": \\"代码质量 L2 审批记录\\", \\"detail\\": \\"2026-08-28 · 正式生效\\"}, {\\"type\\": \\"来源\\", \\"title\\": \\"项目成果 + 专家评审\\", \\"detail\\": \\"原始证明与审核意见已归档\\"}]"',NULL,'2026-08-28',NULL,NULL,'6','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('584e112c-d2a9-4573-93ac-71bb953877d5','zhou-chen-observability-building','zhou-chen','observability-building','可观测性建设','专业技能 / 稳定性工程','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"统一观测平台改造，覆盖 46 项服务\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-05',NULL,'2','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('7592bb6c-1844-445a-8c48-3d95f90f719a','lin-xiao-slo-design','lin-xiao','slo-design','SLO 设计','专业技能 / 稳定性工程','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"核心服务 SLO 体系与季度复盘\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-05',NULL,'1','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('79755e3f-21c4-42cc-b4cb-d591873143ce','lin-xiao-incident-response','lin-xiao','incident-response','应急响应','专业技能 / 稳定性工程','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"五次重大故障复盘\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-04',NULL,'2','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('8662b5bd-1b30-422c-9507-cea73dfc97e6','data-processing','zhang-san','data-processing','数据处理','专业技能 / 数据与 AI','verified','已亮','项目成果 + 代码评审','2','2','100','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-05-21。','能够完成常规数据清洗、转换与质量检查，产出可复用处理流程。',E'"[{\\"type\\": \\"认证\\", \\"title\\": \\"数据处理 L2 审批记录\\", \\"detail\\": \\"2026-05-21 · 正式生效\\"}, {\\"type\\": \\"来源\\", \\"title\\": \\"项目成果 + 代码评审\\", \\"detail\\": \\"原始证明与审核意见已归档\\"}]"',NULL,'2026-05-21',NULL,NULL,'9','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('8cc1d95a-29eb-4ffa-9fd5-2d3b9d0e1307','system-design','zhang-san','system-design','系统设计与模块拆分','专业技能 / 系统设计','performance','绩效','事实中心 · 绩效成果','1','2','79','ready','待我确认','系统从 2026 上半年绩效考核提交的成果物中识别出架构设计证据。绩效结果只是佐证，仍需你确认并提交审批。','能够在明确边界下拆分中等复杂度模块，说明接口、数据流与异常处理，并通过方案评审。',E'"[{\\"type\\": \\"成果\\", \\"title\\": \\"订单路由模块重构方案\\", \\"detail\\": \\"2026 H1 绩效成果物 · 文档已归档\\"}, {\\"type\\": \\"结果\\", \\"title\\": \\"上线后故障定位耗时下降 31%\\", \\"detail\\": \\"指标来自绩效成果说明，待审批人复核口径\\"}, {\\"type\\": \\"评语\\", \\"title\\": \\"具备独立拆分模块与推动评审的能力\\", \\"detail\\": \\"直属管理者绩效评语节选\\"}]"',NULL,NULL,NULL,NULL,'2','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('a3fba9f0-6e40-4a34-a9a7-e69f7f209138','observability','zhang-san','observability','可观测性','专业技能 / 稳定性工程','verified','已亮','项目成果 + 运行记录','2','2','100','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-07-29。','能够为单个服务配置指标、日志与基础告警，并完成常见问题定位。',E'"[{\\"type\\": \\"认证\\", \\"title\\": \\"可观测性 L2 审批记录\\", \\"detail\\": \\"2026-07-29 · 正式生效\\"}, {\\"type\\": \\"来源\\", \\"title\\": \\"项目成果 + 运行记录\\", \\"detail\\": \\"原始证明与审核意见已归档\\"}]"',NULL,'2026-07-29',NULL,NULL,'8','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('a8ca23e0-87db-44c5-909a-cbe33af309ea','chen-ran-project-collab','chen-ran','project-collab','项目协作','通用技能 / 协作影响','verified','已亮',NULL,'3','3','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"核心项目跨组协作记录\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2026-11',NULL,'4','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('ad286c49-6717-46ed-b566-a5d4bf3906ec','zhou-chen-collaboration','zhou-chen','collaboration','跨团队协作','通用技能 / 协作影响','verified','已亮',NULL,'3','3','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"三团队平台升级复盘与反馈\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2026-12',NULL,'4','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('b58e3f3f-bf39-41f3-b9b7-5a4ebdb6a89f','k8s','zhang-san','k8s','容器与编排（K8s）','专业技能 / 云原生基础设施','worklog','事实','事实中心 · 日报 / 工时','1','2','86','ready','待我确认','事实中心在最近 60 天的日报、工时与项目协作记录中识别到持续的 K8s 实践，建议你核对后申请 L2。','能够独立完成常规服务的部署、配置排查与发布回滚，并能说明关键配置的作用。',E'"[{\\"type\\": \\"工时\\", \\"title\\": \\"云平台改造专项 · 累计投入 46 小时\\", \\"detail\\": \\"2026-07-14 至 2026-09-12 · 工时系统\\"}, {\\"type\\": \\"成果\\", \\"title\\": \\"支付服务 K8s 部署方案 v1.3\\", \\"detail\\": \\"含部署清单、资源配置与回滚方案\\"}, {\\"type\\": \\"协作\\", \\"title\\": \\"在项目群中完成 8 次部署问题答疑\\", \\"detail\\": \\"仅提取与技能判断相关的公开协作记录\\"}]"',NULL,NULL,NULL,NULL,'1','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('bef2a754-87da-4dd4-aedd-3e435473becf','zhou-chen-sys-design-split','zhou-chen','sys-design-split','系统设计与拆分','专业技能 / 系统设计','verified','已亮',NULL,'3','3','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"计费平台模块化重构方案\\", \\"detail\\": \\"\\"}, {\\"type\\": \\"复核\\", \\"title\\": \\"待复核\\", \\"detail\\": \\"最近使用 2025-07\\"}]"',NULL,NULL,'2027-01','2025-07','3','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('c9c2f922-99ed-412c-8b07-b723ca7e76ce','chen-ran-k8s','chen-ran','k8s','容器与编排','专业技能 / 平台工程','verified','已亮',NULL,'3','3','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"生产环境治理项目\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2026-12',NULL,'3','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('d2020e68-c2ed-4f66-92c7-be1f87108f38','collaboration','zhang-san','collaboration','跨团队协作','通用技能 / 沟通协作','performance','绩效','绩效成果识别 · 已审批生效','3','3','83','approved','已点亮','该技能已通过人工审批并正式点亮，最近一次认证生效于 2026-09-18。','能够协调多个团队解决目标冲突，形成明确决策并推动关键事项按约定交付。',E'"[{\\"type\\": \\"成果\\", \\"title\\": \\"牵头支付链路跨团队专项\\", \\"detail\\": \\"协调 4 个团队，按期完成 6 个接口改造\\"}, {\\"type\\": \\"记录\\", \\"title\\": \\"专项周会纪要与决策清单\\", \\"detail\\": \\"共 7 次会议，关键决策均有责任人与期限\\"}, {\\"type\\": \\"反馈\\", \\"title\\": \\"合作方满意度 4.7 / 5\\", \\"detail\\": \\"来自半年度协作反馈\\"}]"',NULL,'2026-09-18',NULL,NULL,'4','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('d96b6740-8635-4d57-94a3-050e0be92058','testing','zhang-san','testing','自动化测试与质量门禁','专业技能 / 工程质量','manual','自证','员工主动申请','1','2','64','returned','待补充','你已提交培训证书与考试成绩。审核人希望补充一次真实项目中的质量门禁配置，证明能力已用于工作场景。','能够为常规服务设计自动化测试，并在持续集成流程中配置覆盖率或质量门禁。',E'"[{\\"type\\": \\"培训\\", \\"title\\": \\"质量工程训练营结业证书\\", \\"detail\\": \\"2026-08-30 · 已核验\\"}, {\\"type\\": \\"考试\\", \\"title\\": \\"结业考试 92 分\\", \\"detail\\": \\"覆盖单元测试、集成测试与质量门禁\\"}, {\\"type\\": \\"待补\\", \\"title\\": \\"真实项目配置或运行记录\\", \\"detail\\": \\"审核人：请补充仓库链接与一次门禁运行结果\\"}]"',NULL,NULL,NULL,NULL,'3','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('e1682090-2cb3-4168-b54e-ca4712733956','lin-xiao-collaboration','lin-xiao','collaboration','跨团队协作','通用技能 / 协作影响','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"大型保障协作反馈\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-02',NULL,'4','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('f0738140-b4f6-4dec-ac96-0e531b8b2634','chen-ran-infra-as-code','chen-ran','infra-as-code','基础设施即代码','专业技能 / 平台工程','verified','已亮',NULL,'4','4','100','approved','已点亮',NULL,NULL,E'"[{\\"type\\": \\"来源\\", \\"title\\": \\"环境交付自动化平台\\", \\"detail\\": \\"\\"}]"',NULL,NULL,'2027-03',NULL,'1','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)');

-- ---- 数据：approval（4 行）----
INSERT INTO "approval" ("id","slug","linked_slug","kind","applicant","avatar","department","title","current_level","target_level","source_label","submitted_at","due","status","detail","employee_response","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('9994ae7e-cfc9-4ce3-8b5e-96a8cdb72b12','approval-observability',NULL,'application','林晓','林','平台研发部 · T3','可观测性建设','2','3','员工主动申请','昨天 16:40','09-16','pending','申请人提交了指标体系设计、告警降噪结果和复盘记录。建议重点核对是否达到 L3 的跨服务治理范围。',NULL,'3','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('c529b548-fe9a-45fb-91e5-3d6fc793598e','approval-collaboration','collaboration','application','张三','张','平台研发部 · T1-2','跨团队协作','2','3','绩效成果识别','今天 10:24','09-17','approved','审批测试：跨团队协作能力达标，同意升级',NULL,'2','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('cf2910ba-35ec-4fdf-8a81-fdc95e0d7554','review-requirements','requirements','downgrade','张三','张','平台研发部 · T1-2','需求理解','3','2','长期未使用复核','今天 09:10','09-26','pending','系统发现该技能连续 12 个月没有新的相关工作或可核验产出。无新记录仅代表证据新鲜度下降，请结合员工补充说明判断是否维持、延长观察或降至 L2。',NULL,'1','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)'),('e5d6ff31-68ba-4126-a444-367ba8dd4fcf','approval-automation',NULL,'application','周晨','周','基础架构部 · T2','自动化运维开发','1','2','日报 / 工时识别','09-14 18:05','09-18','pending','事实中心识别到连续 8 周的自动化脚本交付和工时投入。申请人已确认其中 3 项成果可用于本次认证。',NULL,'4','2026-09-18 10:43:40+08:00','	(1809773148953787)','2026-09-18 10:43:40+08:00','	(1809773148953787)');

-- ---- 数据：idp_plan（1 行）----
INSERT INTO "idp_plan" ("id","employee_slug","current_role_label","target_role_label","horizon","readiness","readiness_note","strengths","weaknesses","review_cadence","_created_at","_created_by","_updated_at","_updated_by") VALUES ('389a8d86-7b3b-45cb-97b1-e0a64a195fa4','zhang-san','T2 软件研发工程师 · 平台工程部','T3 平台架构师（研发 · 系统设计方向）','24 个月（2026 Q3 - 2028 Q2）','72','基于 18 项已点亮技能与 6 项在途 Gap 综合评估，工程执行已达基线，系统设计与稳定性治理是晋升 T3 的主要短板。',E'"[\\"研发工程能力（团队前 30%）\\", \\"工程质量与自动化意识\\", \\"近 6 个月点亮 5 项技能，学习节奏稳定\\"]"',E'"[\\"系统设计与模块拆分（L1，目标 L3）\\", \\"服务稳定性与 SLO 设计（L1，目标 L3）\\", \\"技术方案表达（L2，目标 L3）\\"]"','每季度末与管理者进行一次 IDP Check-in：核对里程碑、更新证据链、确认下一季度行动。两次 Check-in 之间如遇触发条件，随时发起 15 分钟快速对齐。','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：idp_phase（4 行）----
INSERT INTO "idp_phase" ("id","plan_id","range_label","title","theme","objective","milestone","outcome","focus_gaps","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('0f6322ac-7b51-47ab-afe4-7665ecc9d283','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','第 2 阶段 · 3-9 个月（2026 Q4 - 2027 Q2）','系统设计与稳定性攻坚','集中投入两项 L1 → L3 的 P0 Gap，这是 T3 评审的核心依据','两项 P0 Gap 均达到 L3 锚点，形成完整方案证据链','2027-06 月底：系统设计、SLO 设计两项申请点亮 L3','形成 2 份可验证的系统设计证据，进入 T3 评审视野',E'"[\\"系统设计与模块拆分\\", \\"服务稳定性与 SLO 设计\\"]"','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('d3783953-586b-4eaf-94d3-7e3d82a9d59a','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','第 1 阶段 · 0-3 个月（2026 Q3-Q4）','夯实工程质量基线','先把当前岗位的 P0 硬缺口补齐，避免带着质量债进入系统设计攻坚','质量门禁 L1 → L2，工程化实践完成一次可验证的落地','2026-12 月底：质量门禁技能点亮 L2','当前岗位 1 项 P0 Gap 清零，工程化实践获得可引用证据',E'"[\\"自动化测试与质量门禁\\", \\"Java / Go 工程化实践\\"]"','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('d4cde2dc-e196-44f3-bd9e-e5598701046f','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','第 3 阶段 · 9-15 个月（2027 Q2-Q4）','扩大技术影响','把能力转化为可见度：方案表达与跨团队协作是 T3 的隐性门槛','方案表达到达 L3，AI Agent 集成形成一次业务落地','2027-12 月底：方案表达点亮 L3，AI Agent 集成点亮 L2','具备跨团队影响证据，管理者的 T3 提名材料基本成型',E'"[\\"技术方案表达\\", \\"AI Agent 应用集成\\"]"','3','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('fa6ce10a-3b98-4bbe-94f1-98302cd6d01d','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','第 4 阶段 · 15-24 个月（2028 年）','T3 冲刺与巩固','以架构治理的实际成果完成 T3 评审，并维持既有技能不过期','通过 T3 平台架构师评审，进入继任梯队视野','2028-Q2：提交 T3 评审','以 24 个月的连续证据链支撑 T3 评审，Gap 池整体清零或转巩固',E'"[\\"系统设计与模块拆分（巩固）\\", \\"服务稳定性与 SLO 设计（巩固）\\"]"','4','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：idp_action（13 行）----
INSERT INTO "idp_action" ("id","phase_id","kind","title","gap","window_label","proof","sort","kind_label","_created_at","_created_by","_updated_at","_updated_by") VALUES ('03473a9c-1cae-4875-8e7a-ffd435c8abc0','fa6ce10a-3b98-4bbe-94f1-98302cd6d01d','deliver','完成 T3 评审材料：能力矩阵 + 证据链','整体晋升准备','第 20-22 个月','评审材料包','2','交付','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('3818dc71-5b94-40d0-b025-0a6a8e8b38d2','d4cde2dc-e196-44f3-bd9e-e5598701046f','deliver','牵头一个 AI Agent 辅助的研发效能工具','AI Agent 应用集成','第 10-14 个月','工具上线 + 使用数据','2','交付','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('44a588eb-b183-41f5-bdc2-53d991ae8dd8','0f6322ac-7b51-47ab-afe4-7665ecc9d283','deliver','独立完成一个子域的架构设计并落地','系统设计与模块拆分','第 6-9 个月','设计文档 + 上线结果','3','交付','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('4f17fae3-ced7-4228-90c8-be43cdde400b','fa6ce10a-3b98-4bbe-94f1-98302cd6d01d','mentor','与直属上级做 2 次 T3 模拟评审','整体晋升准备','第 22-24 个月','模拟评审反馈','3','导师','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('4f28d298-3a5b-44d4-bd72-2d9bcdc2603f','fa6ce10a-3b98-4bbe-94f1-98302cd6d01d','practice','主导一次跨团队的架构治理专项','系统设计与模块拆分','第 15-20 个月','治理报告 + 落地指标','1','实践','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('68461f70-1e2b-4611-9bd8-9616bf4be934','0f6322ac-7b51-47ab-afe4-7665ecc9d283','mentor','与架构师进行 4 次方案拆解（边界 / 容量 / 降级）','系统设计与模块拆分','每 6 周一次','导师反馈记录','2','导师','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('7df80516-a3a4-4a7b-9393-9fbbab71e8d8','d3783953-586b-4eaf-94d3-7e3d82a9d59a','practice','主导一次 Go 服务重构：目录规范与依赖治理','Java / Go 工程化实践','第 2-3 个月','合入主干 + 评审记录','3','实践','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('874fe58e-9b44-451b-b985-c08f41caf8ab','d4cde2dc-e196-44f3-bd9e-e5598701046f','mentor','向新人讲授一次系统设计课程','技术方案表达','第 12 个月','课件 + 学员评价','3','导师','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('9773112d-b107-4ca2-ac38-cd04403003b5','d3783953-586b-4eaf-94d3-7e3d82a9d59a','learn','系统设计：从模块到架构（新知社 6 节）','系统设计与模块拆分','本季度内','完成率 100% + 章节笔记','1','学习','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('9af6a36f-9a1c-4b16-8f05-34644f5fb74e','0f6322ac-7b51-47ab-afe4-7665ecc9d283','learn','Google SRE Workbook：SLO 实践（含导读）','服务稳定性与 SLO 设计','第 3-4 个月','读书笔记 + 内部分享一次','4','学习','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('9bd55f22-5935-457f-962d-3f6fb449442c','d4cde2dc-e196-44f3-bd9e-e5598701046f','practice','在部门技术评审会做 3 次方案主讲','技术方案表达','每季度 1 次','评审会材料 + 同行反馈','1','实践','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('ebf0532a-619d-4cf0-828e-2df4e66728e7','0f6322ac-7b51-47ab-afe4-7665ecc9d283','practice','负责一次核心服务 SLO 方案评审','服务稳定性与 SLO 设计','第 4-6 个月','方案文档 + 评审记录','1','实践','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('f6040147-8668-4533-aa80-ba913bad19f8','d3783953-586b-4eaf-94d3-7e3d82a9d59a','deliver','为核心服务补齐单测与质量门禁规则','自动化测试与质量门禁','第 1-2 个月','门禁上线 + 覆盖率报告','2','交付','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：idp_milestone（5 行）----
INSERT INTO "idp_milestone" ("id","plan_id","time_label","title","detail","state","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('2c448439-ab35-4752-925e-09f1bd282fd6','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','2027-12','影响力达标','方案表达 L3，AI Agent 集成落地','next','4','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('34e0d4c0-2960-47b8-87a5-a50904309ae4','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','2027-06','双 P0 攻坚完成','系统设计、SLO 设计申请点亮 L3','next','3','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('94f4d4d7-da3e-4753-970e-8667db3a0262','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','2028-Q2','T3 评审','提交评审材料包，进入架构师序列','next','5','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('9632faed-5f22-4bcb-b98e-893a23fdbcd6','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','2026-09','IDP 启动','与管理者对齐目标岗位与 24 个月路线','done','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('98875ffb-3bd1-44d8-9e7a-d8e6799f8eb0','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','2026-12','质量基线达成','自动化测试与质量门禁点亮 L2','current','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：idp_adjust_rule（4 行）----
INSERT INTO "idp_adjust_rule" ("id","plan_id","trigger_label","action","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('6bca31d4-281d-4101-bfb5-0d578f5a330f','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','提前完成阶段目标','提前启动下一阶段第一项实践行动，并将富余时间投入导师反馈补强','4','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('a6e821a1-f5f4-40ce-89d0-11af8a52122e','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','连续两个检查点未达成里程碑','下调阶段目标一档（L3 → L2），优先保证已点亮技能不回退','3','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('cb418c24-907d-4f38-a368-3487f341ea6c','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','OKR 或组织方向调整','2 周内与管理者重评 Gap 来源与优先级，必要时替换 1-2 项行动，保持阶段总数不变','1','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)'),('ea17f21b-ab49-4ea3-bd87-eb97eb67eba0','389a8d86-7b3b-45cb-97b1-e0a64a195fa4','某项技能数据临近过期（12 个月未使用）','在当前阶段插入一次实践或分享行动，刷新使用记录，避免触发降级复核','2','2026-09-18 10:43:42+08:00','	(1809773148953787)','2026-09-18 10:43:42+08:00','	(1809773148953787)');

-- ---- 数据：talent_candidate（10 行）----
INSERT INTO "talent_candidate" ("id","slug","name","avatar_text","avatar_tone","org","role","tier","available","reason","note","evidence","gap","availability","freshness","dimensions","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('10c2a786-b8ba-4f14-9272-dc27db7d658f','lu-qing','陆青','陆','green','AI 平台中心','算法工程师 · T2','potential','true','学习速度与强化学习基础达到转型门槛','已完成机器人仿真课题，建议配置一名机器人专家带教 6-8 周。',E'"[\\"机器学习 L3\\", \\"强化学习 L2\\", \\"仿真课题 · 待复核\\"]"','真实项目经验缺失','立即可投入 50%','4 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 61}, {\\"label\\": \\"成长潜力\\", \\"value\\": 91}, {\\"label\\": \\"证据可信\\", \\"value\\": 74}, {\\"label\\": \\"可用程度\\", \\"value\\": 92}]"','8','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('1a579b81-7a5d-4859-a583-5e5521fc2d34','zhou-chen','周晨','周','blue','智能汽车事业群','感知算法工程师 · T3','direct','true','视觉感知能力可直接迁移至具身场景','拥有多传感器融合与端侧部署经验，缺少机器人本体项目经历。',E'"[\\"视觉感知 L4\\", \\"多模态 L3\\", \\"端侧部署 · 已核验\\"]"','真实机器人经验不足','10 月可投入 50%','7 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 86}, {\\"label\\": \\"相关经历\\", \\"value\\": 72}, {\\"label\\": \\"证据可信\\", \\"value\\": 91}, {\\"label\\": \\"可用程度\\", \\"value\\": 82}]"','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('4508797a-e7b2-47cd-b64d-8706bdbd6f30','lin-xiao','林晓','林','green','机器人创新中心','机器人算法专家 · T4','direct','true','机器人感知与强化学习均有正式认证','曾负责机械臂视觉抓取项目，从仿真验证推进到真实硬件部署。',E'"[\\"机器人感知 L4\\", \\"强化学习 L3\\", \\"机械臂项目 · 已核验\\"]"','运动控制待验证','10 月可投入 60%','3 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 94}, {\\"label\\": \\"相关经历\\", \\"value\\": 92}, {\\"label\\": \\"证据可信\\", \\"value\\": 96}, {\\"label\\": \\"可用程度\\", \\"value\\": 78}]"','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('46358d4c-ceb5-4d71-b5cd-f4ed72dadf94','sun-ke','孙可','孙','blue','智能汽车事业群','视觉算法工程师 · T2','potential','true','感知算法扎实，近半年持续补充机器人知识','适合作为感知方向后备人选，需要补充强化学习与控制基础。',E'"[\\"视觉感知 L3\\", \\"模型工程 L3\\", \\"机器人课程认证\\"]"','强化学习与控制待培养','11 月可投入 70%','8 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 57}, {\\"label\\": \\"成长潜力\\", \\"value\\": 88}, {\\"label\\": \\"证据可信\\", \\"value\\": 81}, {\\"label\\": \\"可用程度\\", \\"value\\": 79}]"','9','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('46d12fc8-4f52-415b-bc07-05645ae64612','he-jing','何静','何','rose','机器人创新中心','运动控制工程师 · T3','direct','true','运动控制和真实硬件调试经验完整','参与双足机器人关节控制与现场调试，可补齐团队的控制侧能力。',E'"[\\"运动控制 L4\\", \\"嵌入式系统 L3\\", \\"双足机器人 · 已核验\\"]"','强化学习 L2','11 月可投入 50%','5 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 84}, {\\"label\\": \\"相关经历\\", \\"value\\": 94}, {\\"label\\": \\"证据可信\\", \\"value\\": 93}, {\\"label\\": \\"可用程度\\", \\"value\\": 71}]"','4','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('7efdea90-0590-4b22-9204-5bee80b902bc','gao-yu','高宇','高','amber','机器人创新中心','嵌入式工程师 · T2','potential','true','真实硬件经验丰富，正在转向机器人控制','硬件调试优势明显，可通过专项任务验证运动控制能力。',E'"[\\"嵌入式系统 L4\\", \\"硬件调试 L4\\", \\"运动控制 L1\\"]"','算法能力仍需培养','10 月可投入 50%','5 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 53}, {\\"label\\": \\"成长潜力\\", \\"value\\": 83}, {\\"label\\": \\"证据可信\\", \\"value\\": 90}, {\\"label\\": \\"可用程度\\", \\"value\\": 84}]"','10','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('a8145b62-9c4e-4969-befd-e481e86087d5','chen-ran','陈然','陈','amber','AI 平台中心','强化学习工程师 · T3','direct','false','强化学习与仿真训练经验突出','主导训练环境与评估体系建设，运动控制能力来自 14 个月前的项目。',E'"[\\"强化学习 L4\\", \\"仿真平台 L3\\", \\"训练评估体系\\"]"','运动控制证据较旧','当前负载 80%','14 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 88}, {\\"label\\": \\"相关经历\\", \\"value\\": 81}, {\\"label\\": \\"证据可信\\", \\"value\\": 83}, {\\"label\\": \\"可用程度\\", \\"value\\": 32}]"','3','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('b646c1e0-3698-4163-8ad0-1684efdb8e4c','wang-yan','王妍','王','rose','AI 平台中心','多模态研究员 · T3','adjacent','true','多模态理解与模型评估能力可用于智能体感知','具备视觉语言模型应用经验，尚未参与实时控制系统。',E'"[\\"多模态 L4\\", \\"模型评估 L3\\", \\"视觉语言模型\\"]"','缺少控制与硬件经验','10 月可投入 50%','2 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 72}, {\\"label\\": \\"相关经历\\", \\"value\\": 64}, {\\"label\\": \\"证据可信\\", \\"value\\": 92}, {\\"label\\": \\"可用程度\\", \\"value\\": 85}]"','6','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('dc683c0f-4580-4217-afa2-98bd97921485','zhao-ning','赵宁','赵','amber','云平台事业部','仿真平台工程师 · T3','adjacent','false','大规模仿真与数据闭环能力可支撑算法迭代','适合作为平台角色加入，但不能独立承担核心机器人算法工作。',E'"[\\"仿真平台 L4\\", \\"数据闭环 L3\\", \\"分布式训练\\"]"','核心算法能力不足','当前负载 90%','9 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 62}, {\\"label\\": \\"相关经历\\", \\"value\\": 78}, {\\"label\\": \\"证据可信\\", \\"value\\": 88}, {\\"label\\": \\"可用程度\\", \\"value\\": 24}]"','7','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('e962147b-6a7e-4994-8543-e8a541630eea','fang-yi','方毅','方','blue','智能汽车事业群','自动驾驶算法专家 · T4','adjacent','true','感知、规划和仿真能力与具身智能高度相邻','暂无机器人项目，但复杂动态环境中的决策规划经验可迁移。',E'"[\\"环境感知 L4\\", \\"决策规划 L4\\", \\"仿真评估 L3\\"]"','需补机器人系统认知','10 月可投入 40%','6 天前',E'"[{\\"label\\": \\"必需能力\\", \\"value\\": 78}, {\\"label\\": \\"相关经历\\", \\"value\\": 76}, {\\"label\\": \\"证据可信\\", \\"value\\": 95}, {\\"label\\": \\"可用程度\\", \\"value\\": 67}]"','5','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- ---- 数据：talent_shortlist_item（0 行）----
-- 空表，无数据

-- ---- 数据：succession_position（4 行）----
INSERT INTO "succession_position" ("id","slug","title","family","incumbent","incumbent_meta","immediate","developing","health","health_text","summary","risk","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('1ed611aa-058b-4303-bb81-b9544aac42f0','platform-architect','T4 平台架构师','平台工程','韩立','任职 3.2 年 · 关键岗位','0','2','risk','高风险','现任者将在 6 个月后转任集团架构委员会，当前没有可立即接任人选。','岗位连续性风险较高：需要在本季度确认代理负责人，并为两位候选补齐组织级架构治理能力。','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('9fe1911e-7d60-47a0-a65e-85b699d7f156','sre-lead','SRE 负责人','稳定性工程','顾明','任职 2.1 年 · 关键岗位','1','2','watch','需关注','已有一位可短期代理的候选人，但在组织协同和应急决策方面仍需验证。','建议让首位候选在双十一保障中担任代理负责人，完成一次真实场景验证。','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('a3e67d8b-28a3-4a0d-9521-eace24d133cb','data-lead','数据平台负责人','数据与 AI','空缺','已空缺 42 天','0','1','risk','高风险','岗位已经空缺，当前项目由两位技术负责人共同代管，决策边界不清晰。','建议立即明确临时负责人，并扩大到 AI 平台中心搜索外部组织候选。','4','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('db02d253-b517-4183-bb24-eb1737785854','devsecops-expert','DevSecOps 专家','研发效能','沈墨','任职 1.8 年 · 核心岗位','2','1','healthy','健康','继任梯队结构完整，两位候选已覆盖岗位核心能力，可在不同业务域承担代理职责。','当前无关键风险。建议维持候选人的跨业务轮岗，避免能力集中在单一产品线。','3','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- ---- 数据：succession_candidate（9 行）----
INSERT INTO "succession_candidate" ("id","position_slug","person_name","employee_slug","avatar_text","avatar_tone","role","gap","state","state_class","bucket","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('1301abea-10ba-41a8-a600-fe85c57460e0','platform-architect','周晨','zhou-chen','周','blue','高级平台工程师 · T3','缺组织级架构治理、技术战略','6–9 个月','develop','pipeline','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('189abe48-5756-422c-9a67-40f0c507d267','devsecops-expert','何静','he-jing','何','rose','安全工程专家 · T3','无关键缺口','可立即接任','','ready','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('19adf8ca-f338-42d5-8407-d2ab70628c28','devsecops-expert','陆青',NULL,'陆','green','平台工程师 · T2','缺安全治理经验','6–12 个月','develop','pipeline','3','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('472f071d-ce47-4d7d-b994-c0c145c713e2','sre-lead','陈然','chen-ran','陈','amber','基础架构工程师 · T3','缺跨团队应急协调','6–9 个月','develop','pipeline','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('8e52559a-01c2-44e4-a55c-d6db834fb1b3','sre-lead','林晓','lin-xiao','林','green','SRE 专家 · T3','需完成一次代理负责人验证','可短期代理','','ready','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('9d7849ba-1bd2-484e-ab90-517e20693582','devsecops-expert','方毅','fang-yi','方','blue','研发效能专家 · T3','无关键缺口','可立即接任','','ready','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('c0607fff-cd60-47f4-862e-f7ae74c6253c','platform-architect','林晓','lin-xiao','林','green','SRE 专家 · T3','缺跨域架构与人才培养','9–12 个月','develop','pipeline','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('cfa31b8f-4582-43ef-b8e6-71556bfeae64','data-lead','王妍',NULL,'王','rose','多模态研究员 · T3','缺平台治理与团队管理','9–12 个月','develop','pipeline','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('e84909ed-207e-4dfe-a617-2ced858fa447','sre-lead','赵宁','zhao-ning','赵','blue','SRE 工程师 · T2','缺容量治理与影响力','9–12 个月','develop','pipeline','3','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- ---- 数据：team_project（1 行）----
INSERT INTO "team_project" ("id","slug","title","period","note","_created_at","_created_by","_updated_at","_updated_by") VALUES ('fc4f09c8-6e87-4c7a-ab12-98438b0f581d','embodied-intelligence','具身智能业务探索','2026.10–2027.01',NULL,'2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- ---- 数据：team_role（4 行）----
INSERT INTO "team_role" ("id","slug","project_slug","title","headcount","allocation","skills","candidate_slugs","sort","_created_at","_created_by","_updated_at","_updated_by") VALUES ('0bfcfd29-6e67-4495-a2db-cf7abff4555a','simulation','embodied-intelligence','仿真训练平台','1','80%',E'"[{\\"name\\": \\"仿真平台 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"分布式训练 L2\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"数据闭环\\", \\"type\\": \\"bonus\\"}]"',E'"[\\"chen-ran\\", \\"zhao-ning\\", \\"fang-yi\\"]"','3','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('18a0733e-1cf3-420e-b5e4-31f62bf92963','product','embodied-intelligence','业务产品负责人','1','50%',E'"[{\\"name\\": \\"复杂项目 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"业务探索 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"机器人行业\\", \\"type\\": \\"bonus\\"}]"',E'"[\\"fang-yi\\", \\"wang-yan\\", \\"zhou-chen\\"]"','4','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('6bfb82b2-b453-413c-adc2-9cddc8569038','perception','embodied-intelligence','机器人感知算法','1','50%',E'"[{\\"name\\": \\"机器人感知 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"多模态 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"真实硬件\\", \\"type\\": \\"bonus\\"}]"',E'"[\\"lin-xiao\\", \\"zhou-chen\\", \\"wang-yan\\"]"','1','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('c050a562-64e8-4ff7-9910-1bd0385d2cbe','control','embodied-intelligence','运动控制工程师','1','50%',E'"[{\\"name\\": \\"运动控制 L3\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"嵌入式系统 L2\\", \\"type\\": \\"required\\"}, {\\"name\\": \\"强化学习\\", \\"type\\": \\"bonus\\"}]"',E'"[\\"he-jing\\", \\"gao-yu\\", \\"lin-xiao\\"]"','2','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- ---- 数据：team_assignment（2 行）----
INSERT INTO "team_assignment" ("id","role_slug","candidate_slug","_created_at","_created_by","_updated_at","_updated_by") VALUES ('176ac0a5-b73f-4922-a76d-371bd8725bc2','perception','lin-xiao','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)'),('bbeb9c0d-7126-470a-a916-9bc762896174','simulation','chen-ran','2026-09-18 10:43:43+08:00','	(1809773148953787)','2026-09-18 10:43:43+08:00','	(1809773148953787)');

-- =============================================================
-- 【可选】RLS 行级安全策略（平台耦合，默认注释）
-- 原库对 27 张表各定义 4 条 policy（108 条），依赖妙搭平台角色
-- （service_role / authenticated / anon，独立库需先 CREATE ROLE 同名角色）
-- 与会话变量 app.user_id。目标库若为单租户应用可直接不启用本段；
-- 需要行级安全时取消注释，并自行改写「修改本人数据」策略的限定条件。
-- =============================================================
/*
ALTER TABLE skill_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON skill_category AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON skill_category AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON skill_category AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON skill_category AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON skill AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON skill AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON skill AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON skill AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE skill_level_anchor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON skill_level_anchor AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON skill_level_anchor AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON skill_level_anchor AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON skill_level_anchor AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE career_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON career_sequence AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON career_sequence AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON career_sequence AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON career_sequence AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE career_node ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON career_node AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON career_node AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON career_node AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON career_node AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE career_node_skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON career_node_skill AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON career_node_skill AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON career_node_skill AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON career_node_skill AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE employee ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON employee AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON employee AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON employee AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON employee AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE employee_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON employee_experience AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON employee_experience AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON employee_experience AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON employee_experience AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE employee_trait ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON employee_trait AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON employee_trait AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON employee_trait AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON employee_trait AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE employee_project ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON employee_project AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON employee_project AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON employee_project AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON employee_project AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE performance_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON performance_record AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON performance_record AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON performance_record AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON performance_record AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE skill_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON skill_event AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON skill_event AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON skill_event AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON skill_event AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE skill_gap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON skill_gap AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON skill_gap AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON skill_gap AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON skill_gap AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE employee_skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON employee_skill AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON employee_skill AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON employee_skill AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON employee_skill AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE approval ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON approval AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON approval AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON approval AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON approval AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE idp_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON idp_plan AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON idp_plan AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON idp_plan AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON idp_plan AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE idp_phase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON idp_phase AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON idp_phase AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON idp_phase AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON idp_phase AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE idp_action ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON idp_action AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON idp_action AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON idp_action AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON idp_action AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE idp_milestone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON idp_milestone AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON idp_milestone AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON idp_milestone AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON idp_milestone AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE idp_adjust_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON idp_adjust_rule AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON idp_adjust_rule AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON idp_adjust_rule AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON idp_adjust_rule AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE talent_candidate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON talent_candidate AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON talent_candidate AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON talent_candidate AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON talent_candidate AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE talent_shortlist_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON talent_shortlist_item AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON talent_shortlist_item AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON talent_shortlist_item AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON talent_shortlist_item AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE succession_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON succession_position AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON succession_position AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON succession_position AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON succession_position AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE succession_candidate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON succession_candidate AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON succession_candidate AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON succession_candidate AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON succession_candidate AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE team_project ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON team_project AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON team_project AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON team_project AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON team_project AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE team_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON team_role AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON team_role AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON team_role AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON team_role AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
ALTER TABLE team_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_policy" ON team_assignment AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "修改全部数据" ON team_assignment AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "修改本人数据" ON team_assignment AS PERMISSIVE FOR ALL TO authenticated USING (((current_setting('app.user_id'::text) = ANY (ARRAY[]::text[])) AND (current_setting('app.user_id'::text) = ((_created_by).user_id)::text)));
CREATE POLICY "查看全部数据" ON team_assignment AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
*/

COMMIT;
