-- 演示响应与员工本人响应分别标记，已有记录保持为员工响应。
ALTER TABLE team_assignment ADD COLUMN IF NOT EXISTS response_source varchar(16) NOT NULL DEFAULT 'employee';
