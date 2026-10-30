BEGIN;
ALTER TABLE mvp_notification DROP CONSTRAINT IF EXISTS mvp_notification_kind_check;
ALTER TABLE mvp_notification ADD CONSTRAINT mvp_notification_kind_check CHECK (kind IN
 ('candidate-evidence','candidate-application','exam-ready','exam-result','approval-pending','approval-result',
  'appeal-result','recertification-due','evidence-auth-request','system-error','team-invite','integration-test'));

CREATE TABLE IF NOT EXISTS app_feishu_delivery (
  notification_slug varchar(64) PRIMARY KEY REFERENCES mvp_notification(slug) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  bridge_id text UNIQUE,
  request jsonb,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_feishu_inbox (
  event_id bigint PRIMARY KEY,
  notification_slug varchar(64) NOT NULL,
  decision text NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION enqueue_feishu_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only newly created notifications enter delivery. Never replay historical demo notifications.
  IF coalesce(NEW.payload->>'source','') <> 'mock' AND NEW.dismissed_at IS NULL THEN
    INSERT INTO app_feishu_delivery(notification_slug) VALUES(NEW.slug) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feishu_notification_insert ON mvp_notification;
CREATE TRIGGER feishu_notification_insert AFTER INSERT ON mvp_notification
  FOR EACH ROW EXECUTE FUNCTION enqueue_feishu_notification();

-- Legacy approval workflow also creates real, individually addressed notifications.
CREATE OR REPLACE FUNCTION notify_feishu_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE applicant_employee employee%ROWTYPE; target record; notice_kind text;
BEGIN
  SELECT e.* INTO applicant_employee FROM employee e JOIN employee_skill s ON s.employee_slug=e.slug
    WHERE s.slug=NEW.linked_slug LIMIT 1;
  IF applicant_employee.slug IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.status='pending' THEN
    FOR target IN SELECT e.slug FROM employee e WHERE e.status='active' AND
      (e.personnel_role='hr' OR (e.job_grade='T4' AND
        (coalesce(e.department,e.org)=applicant_employee.org OR EXISTS
         (SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=applicant_employee.slug
           AND r.target_slug=e.slug AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))))
    LOOP
      INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body,payload)
      VALUES('fn-'||gen_random_uuid(),target.slug,'approval-pending','待处理技能申请：'||NEW.title,
        applicant_employee.name||' 提交了技能申请，请在技能树核对材料并处理。',
        jsonb_build_object('approvalSlug',NEW.slug,'source','application'));
    END LOOP;
  ELSIF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status<>'pending' THEN
    INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body,payload)
    VALUES('fn-'||gen_random_uuid(),applicant_employee.slug,'approval-result','技能申请处理结果：'||NEW.title,
      '申请状态已更新为：'||NEW.status||'。请在技能树查看处理详情。',
      jsonb_build_object('approvalSlug',NEW.slug,'source','application'));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feishu_approval_change ON approval;
CREATE TRIGGER feishu_approval_change AFTER INSERT OR UPDATE OF status ON approval
 FOR EACH ROW EXECUTE FUNCTION notify_feishu_approval();

CREATE OR REPLACE FUNCTION notify_feishu_reminder() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target record;
BEGIN
 FOR target IN SELECT DISTINCT reviewer.slug AS recipient_employee_slug
   FROM approval a JOIN employee_skill s ON s.slug=a.linked_slug
   JOIN employee applicant ON applicant.slug=s.employee_slug CROSS JOIN employee reviewer
   WHERE a.slug=NEW.approval_slug AND a.status='pending' AND reviewer.status='active' AND
     (reviewer.personnel_role='hr' OR (reviewer.job_grade='T4' AND
       (coalesce(reviewer.department,reviewer.org)=applicant.org OR EXISTS
        (SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=applicant.slug AND r.target_slug=reviewer.slug
         AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))))
 LOOP
   INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body,payload)
   VALUES('fn-'||gen_random_uuid(),target.recipient_employee_slug,'approval-pending','技能申请催办',
     coalesce(NEW.requester_name,'申请人')||' 提醒你处理技能申请。请在技能树查看。',
     jsonb_build_object('approvalSlug',NEW.approval_slug,'reminderSlug',NEW.slug,'source','application'));
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feishu_reminder_insert ON approval_reminder;
CREATE TRIGGER feishu_reminder_insert AFTER INSERT ON approval_reminder
 FOR EACH ROW EXECUTE FUNCTION notify_feishu_reminder();
COMMIT;
