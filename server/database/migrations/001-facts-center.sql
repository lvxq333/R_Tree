-- Additive local MVP migration; the 27 legacy tables are never modified.
CREATE TABLE IF NOT EXISTS mvp_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee(id),
  source_table text NOT NULL CHECK (source_table IN ('employee_project','performance_record','employee_skill')),
  source_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('project','performance','legacy_evidence')),
  title text NOT NULL,
  occurrence_label text,
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('active','deleted')),
  provenance text NOT NULL DEFAULT 'local_legacy_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_key)
);
CREATE INDEX IF NOT EXISTS mvp_fact_employee_idx ON mvp_fact(employee_id, status, kind, id);
CREATE TABLE IF NOT EXISTS mvp_fact_change (
  cursor bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fact_id uuid NOT NULL REFERENCES mvp_fact(id),
  employee_id uuid NOT NULL REFERENCES employee(id),
  version integer NOT NULL,
  operation text NOT NULL CHECK (operation IN ('created','updated','deleted')),
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fact_id, version)
);
CREATE INDEX IF NOT EXISTS mvp_fact_change_employee_idx ON mvp_fact_change(employee_id, cursor);
CREATE TABLE IF NOT EXISTS mvp_fact_sync (
  adapter text PRIMARY KEY,
  last_checked_at timestamptz NOT NULL,
  last_changed_at timestamptz,
  source_count integer NOT NULL,
  changed_count integer NOT NULL
);
