-- Local simulation only: never overwrite employee profiles or legacy business rows.
CREATE TABLE IF NOT EXISTS mvp_mock_fact_source (
  source_key text PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employee(id),
  kind text NOT NULL CHECK (kind IN ('git_commit','okr','employee_transfer')),
  title text NOT NULL,
  occurrence_label text NOT NULL,
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object' AND content @> '{"isSimulated":true}'::jsonb),
  is_simulated boolean NOT NULL DEFAULT true CHECK (is_simulated = true)
);
CREATE INDEX IF NOT EXISTS mvp_mock_fact_employee_idx ON mvp_mock_fact_source(employee_id,kind);
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_source_table_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_source_table_check
  CHECK (source_table IN ('employee_project','performance_record','employee_skill','mvp_mock_fact_source'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_kind_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_kind_check
  CHECK (kind IN ('project','performance','legacy_evidence','git_commit','okr','employee_transfer'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_provenance_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_provenance_check CHECK (
  (source_table='mvp_mock_fact_source' AND provenance='simulated') OR
  (source_table<>'mvp_mock_fact_source' AND provenance='local_legacy_import')
);
