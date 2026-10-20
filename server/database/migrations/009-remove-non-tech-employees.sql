-- ============================================================
-- 009 移除不在 MVP 三条技术序列内的演示员工
--
-- 背景：MVP 职称序列收缩为 software / platform / ai 三条技术序列后，
--       销售、产品、项目管理、客户成功的 7 名演示员工没有可归属的序列，
--       会让职称判定、跨路径专家复核出现无法归属的申请人。
--       经确认直接删除这 7 人及其账号、组织关系、事实等全部关联数据。
--
-- 7 人：tang-li 唐丽、feng-gang 冯刚、cao-jing 曹静、
--       xie-min 谢敏、deng-chao 邓超、han-xue 韩雪、kong-ming 孔明
--
-- 幂等：按 slug 精确删除，重复执行无副作用。
-- 注意：种子脚本 scripts/seed-enterprise-data.mjs 已同步移除这 7 人，
--       重跑种子不会把他们带回来。
-- ============================================================

BEGIN;

DO $$
DECLARE
  affected integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _drop_emp(slug varchar(64) PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _drop_emp(slug)
  VALUES ('tang-li'), ('feng-gang'), ('cao-jing'), ('xie-min'),
         ('deng-chao'), ('han-xue'), ('kong-ming')
  ON CONFLICT DO NOTHING;

  -- 1. 登录态与第三方绑定
  DELETE FROM app_session
   WHERE account_id IN (
     SELECT a.id FROM app_account a
       JOIN employee e ON e.id = a.employee_id
       JOIN _drop_emp d ON d.slug = e.slug);

  DELETE FROM app_external_identity
   WHERE account_id IN (
     SELECT a.id FROM app_account a
       JOIN employee e ON e.id = a.employee_id
       JOIN _drop_emp d ON d.slug = e.slug);

  DELETE FROM app_oauth_flow
   WHERE link_account_id IN (
     SELECT a.id FROM app_account a
       JOIN employee e ON e.id = a.employee_id
       JOIN _drop_emp d ON d.slug = e.slug);

  DELETE FROM app_account
   WHERE employee_id IN (
     SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);

  -- 2. 考核（答案 → 题目 → 考试）
  DELETE FROM mvp_exam_answer
   WHERE question_id IN (
     SELECT q.id FROM mvp_exam_question q
       JOIN mvp_exam x ON x.slug = q.exam_slug
       JOIN _drop_emp d ON d.slug = x.employee_slug);

  DELETE FROM mvp_exam_question
   WHERE exam_slug IN (
     SELECT x.slug FROM mvp_exam x JOIN _drop_emp d ON d.slug = x.employee_slug);

  DELETE FROM mvp_exam
   WHERE employee_slug IN (SELECT slug FROM _drop_emp);

  -- 3. 申请与审批链（证据 → 项 → 申诉 → 审批任务 → 申请）
  DELETE FROM mvp_application_evidence
   WHERE application_item_id IN (
     SELECT i.id FROM mvp_application_item i
       JOIN mvp_application a ON a.slug = i.application_slug
       JOIN _drop_emp d ON d.slug = a.applicant_slug);

  DELETE FROM mvp_application_item
   WHERE application_slug IN (
     SELECT a.slug FROM mvp_application a JOIN _drop_emp d ON d.slug = a.applicant_slug);

  DELETE FROM mvp_appeal
   WHERE application_slug IN (
     SELECT a.slug FROM mvp_application a JOIN _drop_emp d ON d.slug = a.applicant_slug)
      OR decided_by_employee_slug IN (SELECT slug FROM _drop_emp);

  DELETE FROM mvp_approval_task
   WHERE application_slug IN (
     SELECT a.slug FROM mvp_application a JOIN _drop_emp d ON d.slug = a.applicant_slug)
      OR assignee_employee_slug IN (SELECT slug FROM _drop_emp);

  DELETE FROM mvp_application
   WHERE applicant_slug IN (SELECT slug FROM _drop_emp);

  -- 4. 认证、证据、通知等员工侧数据
  DELETE FROM mvp_recertification WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_notification WHERE recipient_employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_notification_cooldown WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_file WHERE uploader_employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_evidence WHERE owner_employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_employee_competency WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_employee_skill WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_employee_title WHERE employee_slug IN (SELECT slug FROM _drop_emp);

  -- 5. 事实中心（uuid 关联）
  DELETE FROM mvp_fact_change
   WHERE employee_id IN (SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);
  DELETE FROM mvp_skill_assessment
   WHERE employee_id IN (SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);
  DELETE FROM mvp_mock_fact_source
   WHERE employee_id IN (SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);
  DELETE FROM mvp_fact_event WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM mvp_fact
   WHERE employee_id IN (SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);
  DELETE FROM mvp_fact_employee
   WHERE employee_id IN (SELECT e.id FROM employee e JOIN _drop_emp d ON d.slug = e.slug);

  -- 6. 组织关系（作为本人、或作为他人主管/专家）
  DELETE FROM mvp_org_relation
   WHERE employee_slug IN (SELECT slug FROM _drop_emp)
      OR target_slug IN (SELECT slug FROM _drop_emp);

  -- 7. 旧表（当前无数据，保留以兼容旧演示数据）
  DELETE FROM succession_candidate WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM skill_gap WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM skill_event WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM performance_record WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM idp_plan WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM employee_trait WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM employee_project WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM employee_experience WHERE employee_slug IN (SELECT slug FROM _drop_emp);
  DELETE FROM employee_skill WHERE employee_slug IN (SELECT slug FROM _drop_emp);

  -- 8. 员工本体
  DELETE FROM employee WHERE slug IN (SELECT slug FROM _drop_emp);

  GET DIAGNOSTICS affected = ROW_COUNT;

  RAISE NOTICE '009: 本次删除 employee 行数 = %（重复执行为 0）', affected;
END $$;

-- 校验：这 7 个 slug 在各个入口都不应再出现
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover FROM employee
   WHERE slug IN ('tang-li','feng-gang','cao-jing','xie-min','deng-chao','han-xue','kong-ming');
  IF leftover > 0 THEN
    RAISE EXCEPTION '009 校验失败：employee 仍残留 % 行', leftover;
  END IF;

  SELECT count(*) INTO leftover FROM mvp_org_relation
   WHERE employee_slug IN ('tang-li','feng-gang','cao-jing','xie-min','deng-chao','han-xue','kong-ming')
      OR target_slug IN ('tang-li','feng-gang','cao-jing','xie-min','deng-chao','han-xue','kong-ming');
  IF leftover > 0 THEN
    RAISE EXCEPTION '009 校验失败：mvp_org_relation 仍残留 % 行', leftover;
  END IF;

  RAISE NOTICE '009: 校验通过，7 名非技术序列员工已移除';
END $$;

COMMIT;
