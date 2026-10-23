-- One row per employee. Rebuilt transactionally by the fact importer.
CREATE TABLE IF NOT EXISTS mvp_employee_wide (
  employee_id uuid PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  employee_slug varchar(64) NOT NULL UNIQUE,
  name varchar(64) NOT NULL,
  role varchar(128),
  org varchar(255),
  status varchar(32),
  hire_date varchar(16),
  summary text,
  fact_count integer NOT NULL DEFAULT 0,
  project_count integer NOT NULL DEFAULT 0,
  performance_count integer NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  other_fact_count integer NOT NULL DEFAULT 0,
  latest_fact_at timestamptz,
  fact_titles jsonb NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mvp_employee_wide_org_idx ON mvp_employee_wide(org, name);

-- Manager-entered facts remain a source; the importer records every revision in mvp_fact_change.
CREATE TABLE IF NOT EXISTS mvp_manual_fact_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('project','performance','work_artifact')),
  title text NOT NULL,
  occurred_at timestamptz NOT NULL,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mvp_manual_fact_employee_idx ON mvp_manual_fact_source(employee_id, revoked_at);

ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_source_table_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_source_table_check CHECK
  (source_table IN ('employee_project','performance_record','employee_skill','mvp_mock_fact_source','validation_work_material','mvp_manual_fact_source'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_kind_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_kind_check CHECK
  (kind IN ('project','performance','legacy_evidence','git_commit','okr','employee_transfer','work_artifact'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_provenance_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_provenance_check CHECK (
  (source_table='mvp_mock_fact_source' AND provenance='simulated') OR
  (source_table='validation_work_material' AND provenance='validation_fixture') OR
  (source_table='mvp_manual_fact_source' AND provenance='manager_entered') OR
  (source_table NOT IN ('mvp_mock_fact_source','validation_work_material','mvp_manual_fact_source') AND provenance='local_legacy_import')
);
