-- 只用于隔离验证库。不可由正式环境迁移命令执行。
DO $$ BEGIN
  IF current_schema() !~ '^skilltree_validation_[a-z0-9_]+$' THEN
    RAISE EXCEPTION '验证材料禁止写入正式员工库';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS validation_work_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id),
  title text NOT NULL CHECK (title LIKE '[验证样本]%'),
  format text NOT NULL CHECK (format IN ('structured','unstructured')),
  body text NOT NULL,
  source_path text NOT NULL,
  source_sha256 text NOT NULL,
  test_only boolean NOT NULL DEFAULT true CHECK (test_only=true)
);
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_source_table_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_source_table_check
  CHECK (source_table IN ('employee_project','performance_record','employee_skill','mvp_mock_fact_source','validation_work_material'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_kind_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_kind_check
  CHECK (kind IN ('project','performance','legacy_evidence','git_commit','okr','employee_transfer','work_artifact'));
ALTER TABLE mvp_fact DROP CONSTRAINT IF EXISTS mvp_fact_provenance_check;
ALTER TABLE mvp_fact ADD CONSTRAINT mvp_fact_provenance_check CHECK (
  (source_table='mvp_mock_fact_source' AND provenance='simulated') OR
  (source_table='validation_work_material' AND provenance='validation_fixture') OR
  (source_table NOT IN ('mvp_mock_fact_source','validation_work_material') AND provenance='local_legacy_import')
);
CREATE TABLE IF NOT EXISTS validation_discovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id),
  input_hash text NOT NULL,
  input_snapshot jsonb NOT NULL,
  model text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(employee_id,input_hash)
);
CREATE TABLE IF NOT EXISTS validation_notice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id),
  discovery_id uuid NOT NULL REFERENCES validation_discovery(id),
  skill_slug text NOT NULL,
  certification_slug text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  citations jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(discovery_id,skill_slug)
);
ALTER TABLE validation_discovery ADD COLUMN IF NOT EXISTS model_result jsonb;
