-- 历史快照独立于当前指派，成员移除、重开方案后仍可查看。
CREATE TABLE IF NOT EXISTS team_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug varchar(64) NOT NULL,
  event varchar(32) NOT NULL,
  actor_name varchar(128) NOT NULL,
  description text NOT NULL,
  candidate_slug varchar(64),
  decision varchar(16),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS team_history_project_time ON team_history(project_slug,created_at DESC);
CREATE INDEX IF NOT EXISTS team_history_candidate_decision ON team_history(project_slug,candidate_slug,decision);
-- 仅保存当前可核实的基线，不虚构过去已被覆盖的变更。
INSERT INTO team_history(project_slug,event,actor_name,description,snapshot,created_at)
SELECT p.slug,'baseline','系统','当前方案基线（更早已被覆盖的变更无法补录）',
  jsonb_build_object('title',p.title,'status',p.status,
    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('title',r.title,'headcount',r.headcount,'allocation',r.allocation)) FROM team_role r WHERE r.project_slug=p.slug),'[]'::jsonb),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('roleTitle',r.title,'candidateSlug',a.candidate_slug,'name',coalesce(e.name,a.candidate_slug),'response',a.response,'note',a.reject_note,'source',a.response_source)) FROM team_role r JOIN team_assignment a ON a.role_slug=r.slug LEFT JOIN employee e ON e.slug=a.candidate_slug WHERE r.project_slug=p.slug),'[]'::jsonb)),coalesce(p._updated_at,p._created_at,now())
FROM team_project p WHERE NOT EXISTS(SELECT 1 FROM team_history h WHERE h.project_slug=p.slug);
