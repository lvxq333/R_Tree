-- ============================================================
-- MVP 核心 Schema 迁移
-- 创建 MVP 所需的 24 张新表
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 组织关系表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_org_relation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  employee_slug varchar(64) NOT NULL,
  relation_type varchar(16) NOT NULL CHECK (relation_type IN ('manager', 'expert', 'panel', 'domain_owner')),
  target_slug varchar(64) NOT NULL,
  domain varchar(64),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  source varchar(16) NOT NULL DEFAULT 'seed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_org_relation_employee ON mvp_org_relation(employee_slug, relation_type, effective_to);
CREATE INDEX IF NOT EXISTS idx_mvp_org_relation_target ON mvp_org_relation(target_slug, relation_type, effective_to);

COMMENT ON TABLE mvp_org_relation IS 'MVP 组织关系表：管理者/专家/专家组成员关系';

-- ============================================================
-- 2. 标准定义表
-- ============================================================

-- 2.1 子能力定义表
CREATE TABLE IF NOT EXISTS mvp_competency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  code varchar(32) NOT NULL,
  name varchar(128) NOT NULL,
  description text,
  kind varchar(16) NOT NULL CHECK (kind IN ('professional', 'generic')),
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_competency IS 'MVP 子能力定义表';

-- 2.2 子能力等级标准表
CREATE TABLE IF NOT EXISTS mvp_competency_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_slug varchar(64) NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  anchor text NOT NULL,
  evidence_requirement jsonb,
  exam_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competency_slug, level)
);

COMMENT ON TABLE mvp_competency_level IS 'MVP 子能力等级标准表';

-- 2.3 技能 × 等级 × 子能力要求表
CREATE TABLE IF NOT EXISTS mvp_skill_competency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_slug varchar(64) NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  competency_slug varchar(64) NOT NULL,
  required_competency_level int NOT NULL CHECK (required_competency_level BETWEEN 1 AND 5),
  standard_version_slug varchar(64) NOT NULL,
  weight int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(skill_slug, level, competency_slug, standard_version_slug)
);

COMMENT ON TABLE mvp_skill_competency IS 'MVP 技能等级子能力要求矩阵';

-- 2.4 职称序列表
CREATE TABLE IF NOT EXISTS mvp_title_track (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  name varchar(128) NOT NULL,
  category varchar(32) NOT NULL,
  path_kind varchar(16) NOT NULL DEFAULT 'single' CHECK (path_kind IN ('single', 'dual')),
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_title_track IS 'MVP 职称序列表（3 类：software / platform / ai）';

-- 2.5 职称层级表
CREATE TABLE IF NOT EXISTS mvp_title_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_slug varchar(64) NOT NULL,
  level_order int NOT NULL CHECK (level_order BETWEEN 1 AND 4),
  level_code varchar(32) NOT NULL,
  name varchar(128) NOT NULL,
  path_label varchar(32),
  standard_version_slug varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(track_slug, level_order, path_label, standard_version_slug)
);

COMMENT ON TABLE mvp_title_level IS 'MVP 职称层级表（每序列 4 层）';

-- 2.6 职称所需技能表
CREATE TABLE IF NOT EXISTS mvp_title_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_level_id uuid NOT NULL REFERENCES mvp_title_level(id) ON DELETE CASCADE,
  skill_slug varchar(64) NOT NULL,
  required_level int NOT NULL CHECK (required_level BETWEEN 1 AND 5),
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_title_requirement IS 'MVP 职称所需技能表';

-- 2.7 标准版本表
CREATE TABLE IF NOT EXISTS mvp_standard_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  version_no varchar(32) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'published', 'archived')),
  effective_at timestamptz NOT NULL,
  created_by_employee_slug varchar(64) NOT NULL,
  reviewed_by_employee_slug varchar(64),
  change_summary text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_standard_version IS 'MVP 标准版本表（发布时全量快照）';

-- ============================================================
-- 3. 员工状态表
-- ============================================================

-- 3.1 员工子能力认证表
CREATE TABLE IF NOT EXISTS mvp_employee_competency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  employee_slug varchar(64) NOT NULL,
  competency_slug varchar(64) NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  certified_at timestamptz NOT NULL,
  certified_via varchar(32) NOT NULL CHECK (certified_via IN ('ai-material', 'exam', 'approval-l3', 'approval-l4', 'approval-l5')),
  source_application_slug varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending-review', 'suspended', 'revoked')),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  review_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_slug, competency_slug, level)
);

CREATE INDEX IF NOT EXISTS idx_mvp_employee_competency_competency ON mvp_employee_competency(competency_slug, status);

COMMENT ON TABLE mvp_employee_competency IS 'MVP 员工子能力认证表';

-- 3.2 员工技能认证表（新）
CREATE TABLE IF NOT EXISTS mvp_employee_skill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  employee_slug varchar(64) NOT NULL,
  skill_slug varchar(64) NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  certified_at timestamptz NOT NULL,
  source_application_slug varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending-review', 'suspended', 'revoked')),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  review_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_slug, skill_slug, level)
);

COMMENT ON TABLE mvp_employee_skill IS 'MVP 员工技能认证表（新表，与旧 employee_skill 隔离）';

-- 3.3 员工职称表
CREATE TABLE IF NOT EXISTS mvp_employee_title (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  employee_slug varchar(64) NOT NULL,
  title_level_id uuid NOT NULL REFERENCES mvp_title_level(id) ON DELETE CASCADE,
  certified_at timestamptz NOT NULL,
  source_application_slug varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  is_cross_path boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_employee_title_employee ON mvp_employee_title(employee_slug, status);

COMMENT ON TABLE mvp_employee_title IS 'MVP 员工职称表（支持多职称）';

-- ============================================================
-- 4. 申请流程表
-- ============================================================

-- 4.1 申请单表
CREATE TABLE IF NOT EXISTS mvp_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  applicant_slug varchar(64) NOT NULL,
  target_kind varchar(16) NOT NULL CHECK (target_kind IN ('skill', 'title')),
  target_skill_slug varchar(64),
  target_level int CHECK (target_level BETWEEN 1 AND 5),
  target_title_level_id uuid REFERENCES mvp_title_level(id) ON DELETE CASCADE,
  is_cross_level boolean NOT NULL DEFAULT false,
  is_cross_path boolean NOT NULL DEFAULT false,
  standard_version_slug varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ai-evaluating', 'pending-exam', 'in-exam', 'pending-approval', 'approved', 'rejected', 'returned', 'closed')),
  submitted_at timestamptz,
  closed_at timestamptz,
  rejected_reason text,
  rejected_at timestamptz,
  appeal_count int NOT NULL DEFAULT 0 CHECK (appeal_count BETWEEN 0 AND 2),
  summary_statement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_application_applicant ON mvp_application(applicant_slug, status);
CREATE INDEX IF NOT EXISTS idx_mvp_application_status ON mvp_application(status, submitted_at);

COMMENT ON TABLE mvp_application IS 'MVP 申请单表（技能/职称申请）';

-- 4.2 申请单子能力行表
CREATE TABLE IF NOT EXISTS mvp_application_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_slug varchar(64) NOT NULL,
  competency_slug varchar(64) NOT NULL,
  required_level int NOT NULL CHECK (required_level BETWEEN 1 AND 5),
  current_status varchar(32) NOT NULL CHECK (current_status IN ('met-by-cert', 'met-by-material', 'pending-exam', 'exam-passed', 'exam-failed', 'pending-approval', 'approved', 'rejected')),
  met_by_competency_id uuid REFERENCES mvp_employee_competency(id) ON DELETE SET NULL,
  ai_evaluation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_slug, competency_slug)
);

COMMENT ON TABLE mvp_application_item IS 'MVP 申请单子能力行表';

-- 4.3 证据表
CREATE TABLE IF NOT EXISTS mvp_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  owner_employee_slug varchar(64) NOT NULL,
  kind varchar(16) NOT NULL CHECK (kind IN ('fact-ref', 'upload', 'external-link')),
  fact_event_slug varchar(64),
  file_id uuid,
  external_url varchar(512),
  title varchar(255) NOT NULL,
  description text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  ai_evaluation_status varchar(16) NOT NULL DEFAULT 'pending' CHECK (ai_evaluation_status IN ('pending', 'evaluating', 'satisfied', 'unsatisfied', 'error')),
  ai_evaluation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_evidence_owner ON mvp_evidence(owner_employee_slug, kind);

COMMENT ON TABLE mvp_evidence IS 'MVP 证据表';

-- 4.4 申请-证据-子能力关联表
CREATE TABLE IF NOT EXISTS mvp_application_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_item_id uuid NOT NULL REFERENCES mvp_application_item(id) ON DELETE CASCADE,
  evidence_slug varchar(64) NOT NULL,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_item_id, evidence_slug)
);

COMMENT ON TABLE mvp_application_evidence IS 'MVP 申请-证据-子能力关联表';

-- ============================================================
-- 5. 考核表
-- ============================================================

-- 5.1 考核会话表
CREATE TABLE IF NOT EXISTS mvp_exam (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  application_item_id uuid NOT NULL REFERENCES mvp_application_item(id) ON DELETE CASCADE,
  employee_slug varchar(64) NOT NULL,
  attempt_no int NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'submitted', 'grading', 'passed', 'failed', 'terminated')),
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds int NOT NULL DEFAULT 3600,
  deadline_at timestamptz NOT NULL,
  submitted_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  resume_token varchar(64),
  resume_expires_at timestamptz,
  page_leave_count int NOT NULL DEFAULT 0,
  terminated_reason varchar(64),
  total_score int CHECK (total_score BETWEEN 0 AND 100),
  passed boolean,
  next_attempt_available_at timestamptz,
  demo_skip_cooldown boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_item_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_mvp_exam_employee ON mvp_exam(employee_slug, status);
CREATE INDEX IF NOT EXISTS idx_mvp_exam_deadline ON mvp_exam(status, deadline_at);

COMMENT ON TABLE mvp_exam IS 'MVP 考核会话表（L2 考核，服务端计时）';

-- 5.2 考题表
CREATE TABLE IF NOT EXISTS mvp_exam_question (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_slug varchar(64) NOT NULL,
  sort int NOT NULL CHECK (sort BETWEEN 1 AND 5),
  question_kind varchar(16) NOT NULL CHECK (question_kind IN ('objective', 'subjective')),
  question_text text NOT NULL,
  options jsonb,
  correct_answer varchar(16),
  reference_answer text,
  max_score int NOT NULL DEFAULT 20,
  generated_by varchar(16) NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual')),
  prompt_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_exam_question IS 'MVP 考题表（5 题：3 客观 + 2 主观）';

-- 5.3 作答与评分表
CREATE TABLE IF NOT EXISTS mvp_exam_answer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES mvp_exam_question(id) ON DELETE CASCADE UNIQUE,
  answer_text text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  score int CHECK (score BETWEEN 0 AND 20),
  grading_feedback text,
  graded_by varchar(16) CHECK (graded_by IN ('ai', 'expert')),
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_exam_answer IS 'MVP 作答与评分表';

-- ============================================================
-- 6. 审批表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_approval_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  application_slug varchar(64) NOT NULL,
  task_kind varchar(32) NOT NULL CHECK (task_kind IN ('l3-manager', 'l4-manager', 'l4-expert', 'l5-manager', 'l5-expert', 'l5-panel', 'cross-level-expert', 'appeal-first', 'appeal-second', 'title-approval', 'recertification', 'correction')),
  assignee_employee_slug varchar(64),
  step_order int NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned', 'waiting-assign', 'skipped')),
  decision_comment text,
  decided_at timestamptz,
  waiting_assign_reason varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_approval_task_assignee ON mvp_approval_task(assignee_employee_slug, status);
CREATE INDEX IF NOT EXISTS idx_mvp_approval_task_application ON mvp_approval_task(application_slug, step_order);

COMMENT ON TABLE mvp_approval_task IS 'MVP 审批任务表（L3-L5/申诉/复核）';

-- ============================================================
-- 7. 申诉表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_appeal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  application_slug varchar(64) NOT NULL,
  appeal_no int NOT NULL CHECK (appeal_no IN (1, 2)),
  appeal_kind varchar(32) NOT NULL CHECK (appeal_kind IN ('l1-l2-material', 'l2-exam', 'l3-l5-decision')),
  trigger_task_id uuid REFERENCES mvp_approval_task(id) ON DELETE SET NULL,
  appeal_reason text NOT NULL,
  ai_questions jsonb,
  employee_response text,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_slug varchar(64),
  decision_comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_slug, appeal_no)
);

COMMENT ON TABLE mvp_appeal IS 'MVP 申诉记录表（最多 2 次）';

-- ============================================================
-- 8. 通知表
-- ============================================================

-- 8.1 站内通知表
CREATE TABLE IF NOT EXISTS mvp_notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  recipient_employee_slug varchar(64) NOT NULL,
  kind varchar(32) NOT NULL CHECK (kind IN ('candidate-evidence', 'candidate-application', 'exam-ready', 'exam-result', 'approval-pending', 'approval-result', 'appeal-result', 'recertification-due', 'evidence-auth-request', 'system-error')),
  title varchar(255) NOT NULL,
  body text NOT NULL,
  link varchar(255),
  payload jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  sent_via_feishu boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_notification_recipient_unread ON mvp_notification(recipient_employee_slug, read_at);
CREATE INDEX IF NOT EXISTS idx_mvp_notification_recipient_created ON mvp_notification(recipient_employee_slug, created_at);

COMMENT ON TABLE mvp_notification IS 'MVP 站内通知表';

-- 8.2 推荐冷却表
CREATE TABLE IF NOT EXISTS mvp_notification_cooldown (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_slug varchar(64) NOT NULL,
  dismissed_key varchar(128) NOT NULL,
  dismissed_at timestamptz NOT NULL,
  cooldown_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_slug, dismissed_key)
);

COMMENT ON TABLE mvp_notification_cooldown IS 'MVP 推荐冷却表（3 个月）';

-- ============================================================
-- 9. 事实中心表（模拟）
-- ============================================================

-- 9.1 事实事件表
CREATE TABLE IF NOT EXISTS mvp_fact_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL,
  employee_slug varchar(64) NOT NULL,
  event_kind varchar(32) NOT NULL CHECK (event_kind IN ('project-participation', 'training-complete', 'certificate-obtained', 'work-output')),
  occurred_at timestamptz NOT NULL,
  source varchar(32) NOT NULL,
  source_version varchar(32) NOT NULL,
  change_kind varchar(16) NOT NULL CHECK (change_kind IN ('created', 'updated', 'revoked')),
  payload jsonb NOT NULL,
  related_competency_slugs jsonb,
  permission_scope jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug, source_version)
);

CREATE INDEX IF NOT EXISTS idx_mvp_fact_event_employee ON mvp_fact_event(employee_slug, processed_at);
CREATE INDEX IF NOT EXISTS idx_mvp_fact_event_ingested ON mvp_fact_event(ingested_at);

COMMENT ON TABLE mvp_fact_event IS 'MVP 事实事件表（模拟事实中心）';

-- 9.2 同步日志表
CREATE TABLE IF NOT EXISTS mvp_fact_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_kind varchar(16) NOT NULL CHECK (sync_kind IN ('scheduled', 'manual', 'realtime')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  events_fetched int,
  events_processed int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_fact_sync_log IS 'MVP 事实同步日志表';

-- ============================================================
-- 10. 学习资源表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_learning_resource (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  kind varchar(16) NOT NULL CHECK (kind IN ('course', 'project', 'training')),
  title varchar(255) NOT NULL,
  description text,
  url varchar(512),
  targets_competency_slugs jsonb,
  estimated_effort varchar(64),
  evidence_template text,
  is_demo boolean NOT NULL DEFAULT true,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_learning_resource IS 'MVP 学习资源库表';

-- ============================================================
-- 11. 文件表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  uploader_employee_slug varchar(64) NOT NULL,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(64) NOT NULL,
  size_bytes int NOT NULL,
  storage_path varchar(512) NOT NULL,
  extracted_text text,
  extraction_status varchar(16) NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'ok', 'failed')),
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvp_file_uploader ON mvp_file(uploader_employee_slug);

COMMENT ON TABLE mvp_file IS 'MVP 文件元数据表（上传文件）';

-- ============================================================
-- 12. 复核表
-- ============================================================

CREATE TABLE IF NOT EXISTS mvp_recertification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  target_kind varchar(16) NOT NULL CHECK (target_kind IN ('competency', 'skill')),
  target_id uuid NOT NULL,
  employee_slug varchar(64) NOT NULL,
  triggered_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-review', 'cleared', 'failed')),
  cleared_at timestamptz,
  cleared_reason varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mvp_recertification IS 'MVP 待复核记录表';

COMMIT;

-- ============================================================
-- 完成
-- ============================================================

-- 输出创建的表数量
SELECT COUNT(*) AS mvp_tables_created
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'mvp_%';
