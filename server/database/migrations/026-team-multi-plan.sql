-- 026: 项目组队多方案化
-- 1) 清空旧的固定演示方案（用户决策：清空重来，各部门从空白开始建方案）
DELETE FROM team_assignment;
DELETE FROM team_role;
DELETE FROM team_project;

-- 2) 方案归属与创建人（隔离维度：创建时手选部门；可见=本部门方案+本人创建；HR 全可见）
ALTER TABLE team_project ADD COLUMN IF NOT EXISTS department varchar(128);
ALTER TABLE team_project ADD COLUMN IF NOT EXISTS creator_slug varchar(64);
ALTER TABLE team_project ADD COLUMN IF NOT EXISTS creator_name varchar(64);

-- 3) 成员邀请响应状态（员工在平台内接受/拒绝；飞书通知走 mvp_notification 记录预留）
ALTER TABLE team_assignment ADD COLUMN IF NOT EXISTS response varchar(16) NOT NULL DEFAULT 'pending';
ALTER TABLE team_assignment ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE team_assignment ADD COLUMN IF NOT EXISTS reject_note varchar(255);

-- 4) 通知类型白名单放行 team-invite（组队邀请通知，飞书通道预留）
ALTER TABLE mvp_notification DROP CONSTRAINT IF EXISTS mvp_notification_kind_check;
ALTER TABLE mvp_notification ADD CONSTRAINT mvp_notification_kind_check CHECK (kind::text = ANY (ARRAY[
  'candidate-evidence'::varchar, 'candidate-application'::varchar, 'exam-ready'::varchar,
  'exam-result'::varchar, 'approval-pending'::varchar, 'approval-result'::varchar,
  'appeal-result'::varchar, 'recertification-due'::varchar, 'evidence-auth-request'::varchar,
  'system-error'::varchar, 'team-invite'::varchar
]));
