-- 同一角色允许多名成员；保留现有指派与邀请响应。
BEGIN;
ALTER TABLE team_assignment DROP CONSTRAINT IF EXISTS team_assignment_role_slug_key;
DROP INDEX IF EXISTS team_assignment_role_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS team_assignment_role_candidate_key
  ON team_assignment(role_slug, candidate_slug);
COMMIT;
