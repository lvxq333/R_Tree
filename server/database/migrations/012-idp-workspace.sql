BEGIN;
ALTER TABLE idp_plan ADD COLUMN IF NOT EXISTS document jsonb;
ALTER TABLE idp_plan ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS idp_plan_draft (
  employee_slug varchar(64) PRIMARY KEY,
  draft_id uuid NOT NULL,
  base_revision integer NOT NULL,
  document jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day'
);
CREATE TABLE IF NOT EXISTS idp_plan_revision (
  plan_id uuid NOT NULL REFERENCES idp_plan(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  reason varchar(128) NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, revision)
);
COMMIT;
