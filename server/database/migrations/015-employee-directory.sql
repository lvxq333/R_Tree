ALTER TABLE employee ADD COLUMN IF NOT EXISTS department varchar(255);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS job_grade varchar(16);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS personnel_role varchar(16) NOT NULL DEFAULT 'employee';
ALTER TABLE employee ADD COLUMN IF NOT EXISTS work_location varchar(128);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS preferred_track varchar(64);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employee_job_grade_valid') THEN
    ALTER TABLE employee ADD CONSTRAINT employee_job_grade_valid CHECK (job_grade IS NULL OR job_grade IN ('T1','T2','T3','T4'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employee_personnel_role_valid') THEN
    ALTER TABLE employee ADD CONSTRAINT employee_personnel_role_valid CHECK (personnel_role IN ('employee','hr'));
  END IF;
END $$;
UPDATE employee e SET department=COALESCE(e.department,e.org),
  job_grade=COALESCE(e.job_grade,(SELECT l.level_code FROM mvp_employee_title t
    JOIN mvp_title_level l ON l.id=t.title_level_id
    WHERE t.employee_slug=e.slug AND t.status='active' ORDER BY l.level_order DESC LIMIT 1));
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS department varchar(255);
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS job_grade varchar(16);
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS personnel_role varchar(16);
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS work_location varchar(128);
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS preferred_track varchar(64);
ALTER TABLE mvp_employee_wide ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS employee_department_grade_idx ON employee(department,job_grade);
