BEGIN;
-- 独立于旧原型的共享人才清单；不迁移或覆盖旧演示推荐。
CREATE TABLE IF NOT EXISTS mvp_talent_workspace (
  account_id uuid PRIMARY KEY REFERENCES app_account(id) ON DELETE CASCADE,
  prompt text NOT NULL DEFAULT '',
  criteria jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mvp_talent_shortlist (
  account_id uuid NOT NULL REFERENCES app_account(id) ON DELETE CASCADE,
  employee_slug varchar(64) NOT NULL REFERENCES employee(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,employee_slug)
);
COMMIT;
