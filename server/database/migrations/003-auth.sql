CREATE TABLE IF NOT EXISTS app_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES employee(id),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_external_identity (
  provider text NOT NULL CHECK (provider IN ('feishu', 'sso')),
  subject text NOT NULL,
  account_id uuid NOT NULL REFERENCES app_account(id) ON DELETE CASCADE,
  provider_user_id text,
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, account_id)
);
CREATE TABLE IF NOT EXISTS app_session (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app_account(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_session_expires_idx ON app_session(expires_at);
CREATE TABLE IF NOT EXISTS app_oauth_flow (
  state_hash text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('feishu', 'sso')),
  link_account_id uuid REFERENCES app_account(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
