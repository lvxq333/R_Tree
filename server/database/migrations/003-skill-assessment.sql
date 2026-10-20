CREATE TABLE IF NOT EXISTS mvp_assessment_standard (
  hash text PRIMARY KEY,
  skill_slug text NOT NULL,
  version text NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(skill_slug,version)
);
CREATE TABLE IF NOT EXISTS mvp_skill_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id),
  certification_slug text NOT NULL,
  skill_slug text NOT NULL,
  target_level integer NOT NULL CHECK(target_level BETWEEN 1 AND 5),
  standard_hash text NOT NULL REFERENCES mvp_assessment_standard(hash),
  input_hash text NOT NULL,
  input_snapshot jsonb NOT NULL CHECK(jsonb_typeof(input_snapshot)='object'),
  status text NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  result jsonb,
  error text,
  model text NOT NULL,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_assessment_dedup_idx ON mvp_skill_assessment(employee_id,input_hash)
  WHERE status IN ('queued','running','completed');
ALTER TABLE mvp_skill_assessment ADD COLUMN IF NOT EXISTS last_requested_at timestamptz NOT NULL DEFAULT now();
DROP INDEX IF EXISTS mvp_assessment_employee_idx;
CREATE INDEX IF NOT EXISTS mvp_assessment_employee_idx ON mvp_skill_assessment(employee_id,certification_slug,last_requested_at DESC);
CREATE INDEX IF NOT EXISTS mvp_assessment_queue_idx ON mvp_skill_assessment(created_at) WHERE status='queued';
