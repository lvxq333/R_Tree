-- 员工基本信息登记与工作事实分开保存，注册不创建工作事实。
ALTER TABLE app_account ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'employee'
  CHECK (access_role IN ('employee','manager'));
CREATE UNIQUE INDEX IF NOT EXISTS app_account_username_lower_idx ON app_account(lower(username));
CREATE TABLE IF NOT EXISTS mvp_fact_employee (
  employee_id uuid PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  basic_info jsonb NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mvp_fact_employee(employee_id,basic_info)
SELECT id,jsonb_build_object('name',name,'slug',slug,'org',org,'role',role,'hireDate',hire_date) FROM employee
ON CONFLICT(employee_id) DO NOTHING;
