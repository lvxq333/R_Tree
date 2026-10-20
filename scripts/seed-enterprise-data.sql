-- ============================================
-- 企业级员工关系种子数据
-- 生成时间：2026-10-20T03:05:08.304Z
-- 员工数量：30
-- 组织关系：36
-- 初始技能：7
-- 统一密码：SkillTree@2026
-- ============================================

BEGIN;

-- 清空现有数据（仅用于演示环境）
-- 按照外键依赖顺序删除（先删除引用表，再删除被引用表）
DO $$ BEGIN
  DELETE FROM validation_work_material WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM validation_notice WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM validation_discovery WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_skill_assessment WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_mock_fact_source WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_fact_change WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_fact WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_fact_employee WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_org_relation WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM mvp_employee_skill WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM app_session WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM app_external_identity WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM app_oauth_flow WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM app_account WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  DELETE FROM employee WHERE true; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 插入 30 名员工
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('796f95c7-b338-4a0a-86e3-e9ae6b646e1b', 'zhang-wei', '张伟', '张', 'blue', '高级工程师', '研发技术中心-Java组', 'active', '2020-03-15', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('eb151a51-90c9-452f-af7c-18148ff5aa21', 'li-na', '李娜', '李', 'blue', '技术专家', '研发技术中心-Java组', 'active', '2018-06-01', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('438b25b5-789a-49e0-9699-18ba88f9215e', 'wang-fang', '王芳', '王', 'blue', '工程师', '研发技术中心-Java组', 'active', '2021-07-20', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('fd06c90b-d9d3-453a-8443-3cfd1a67e383', 'liu-yang', '刘洋', '刘', 'blue', '高级工程师', '研发技术中心-前端组', 'active', '2019-09-10', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('ac37163a-ded2-432c-a5e6-720c68736d91', 'chen-jing', '陈静', '陈', 'blue', '技术专家', '研发技术中心-前端组', 'active', '2017-11-05', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('3e684d1e-5eb4-469f-bc06-5a5e11cb894c', 'zhao-lei', '赵磊', '赵', 'blue', '工程师', '研发技术中心-前端组', 'active', '2022-02-14', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('683cabe4-e242-450d-95e0-ed79a4f4d79b', 'sun-qiang', '孙强', '孙', 'blue', '技术专家', '研发技术中心-Python组', 'active', '2016-04-18', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('2f953cf8-84c9-45c6-9fc2-cf6e178336e1', 'zhou-min', '周敏', '周', 'blue', '高级工程师', '研发技术中心-Python组', 'active', '2020-08-22', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('7a5c30e1-1060-478b-9608-2f9e0e93d356', 'wu-tao', '吴涛', '吴', 'blue', '工程师', '研发技术中心-Python组', 'active', '2021-12-01', 1996, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('0ad1ae67-d3e3-4026-acd7-feb55f5b1f05', 'zheng-hua', '郑华', '郑', 'blue', '测试专家', '研发技术中心-测试组', 'active', '2015-10-08', 1990, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('6502d36a-1de6-42cd-a56a-b4bfdc276515', 'wang-jun', '王军', '王', 'blue', '高级测试工程师', '研发技术中心-测试组', 'active', '2019-05-16', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('3a526316-11ae-4860-93bf-5ae955b3671e', 'li-xue', '李雪', '李', 'blue', '测试工程师', '研发技术中心-测试组', 'active', '2022-06-30', 1997, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('32e1ef2c-2e28-4d22-b7fa-5708b1939f29', 'zhang-peng', '张鹏', '张', 'blue', '运维专家', '研发技术中心-运维组', 'active', '2018-01-25', 1993, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('84542215-5792-481f-86df-27fab17cd250', 'liu-wei', '刘伟', '刘', 'blue', '高级运维工程师', '研发技术中心-运维组', 'active', '2020-04-12', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('d1f28192-2820-41d0-b4d1-a29298d7ba43', 'chen-hao', '陈浩', '陈', 'blue', '运维工程师', '研发技术中心-运维组', 'active', '2023-03-08', 1998, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('7af6cb81-8b7f-4c31-a3ea-544ca089950a', 'yang-li', '杨丽', '杨', 'blue', '数据分析专家', '数据技术中心-数据分析组', 'active', '2017-07-19', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('fb66f303-6e96-4b36-9ecf-78e3384e9019', 'huang-ming', '黄明', '黄', 'blue', '高级数据分析师', '数据技术中心-数据分析组', 'active', '2019-11-23', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('37475241-5993-42c3-879f-211e44b52e5e', 'xu-ting', '徐婷', '徐', 'blue', '数据分析师', '数据技术中心-数据分析组', 'active', '2021-09-05', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('4ce2c9ab-847f-474f-9905-7f1f7282b933', 'gao-feng', '高峰', '高', 'blue', '数据工程专家', '数据技术中心-数据工程组', 'active', '2016-08-14', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('a8710bbd-fc98-4aca-a2ba-14c98e086f3e', 'lin-xiao', '林晓', '林', 'blue', '高级数据工程师', '数据技术中心-数据工程组', 'active', '2020-02-28', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('0dbd7483-180e-4f1c-b862-00a31557d09c', 'he-jun', '何军', '何', 'blue', '数据工程师', '数据技术中心-数据工程组', 'active', '2022-10-17', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('9c693e46-7c04-4823-a980-943e78323b83', 'luo-yan', '罗燕', '罗', 'blue', '数据治理专家', '数据技术中心-数据治理组', 'active', '2018-05-09', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('71364388-3d64-4590-9732-a866ef209cff', 'song-wei', '宋伟', '宋', 'blue', '数据治理工程师', '数据技术中心-数据治理组', 'active', '2021-04-26', 1996, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('a3297579-3edf-423f-a95b-d00eaca74ce7', 'tang-li', '唐丽', '唐', 'blue', '销售总监', '业务与管理部-销售组', 'active', '2015-03-12', 1990, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('a14d0d79-7bc1-4acb-8fec-9397d18d8f0a', 'feng-gang', '冯刚', '冯', 'blue', '高级销售经理', '业务与管理部-销售组', 'active', '2018-09-20', 1993, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('9a735699-1872-4fe0-a654-2d52e375fc7f', 'cao-jing', '曹静', '曹', 'blue', '销售经理', '业务与管理部-销售组', 'active', '2020-06-15', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('26f46ad4-26ad-4f62-b32d-8fb78ac9bcb4', 'xie-min', '谢敏', '谢', 'blue', '产品总监', '业务与管理部-产品组', 'active', '2017-01-08', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('9f1a2b4d-2240-4b43-8fa8-cc5cf16d50c5', 'deng-chao', '邓超', '邓', 'blue', '高级产品经理', '业务与管理部-产品组', 'active', '2019-07-22', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('1b025121-9775-46a5-aac5-392a47549233', 'han-xue', '韩雪', '韩', 'blue', '项目经理', '业务与管理部-项目管理组', 'active', '2021-05-10', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('cb53ed84-33c1-438b-8689-4390b6b7ba48', 'kong-ming', '孔明', '孔', 'blue', '客户成功专家', '业务与管理部-客户成功组', 'active', '2016-11-30', 1991, '男', '本科', false, now(), now());

-- 插入账号（统一密码：SkillTree@2026）
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'zhang-wei', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'zhang-wei';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'li-na', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'li-na';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'wang-fang', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'wang-fang';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'liu-yang', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'liu-yang';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'chen-jing', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'chen-jing';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'zhao-lei', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'zhao-lei';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'sun-qiang', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'sun-qiang';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'zhou-min', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'zhou-min';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'wu-tao', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'wu-tao';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'zheng-hua', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'zheng-hua';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'wang-jun', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'wang-jun';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'li-xue', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'li-xue';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'zhang-peng', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'zhang-peng';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'liu-wei', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'liu-wei';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'chen-hao', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'chen-hao';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'yang-li', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'yang-li';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'huang-ming', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'huang-ming';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'xu-ting', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'xu-ting';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'gao-feng', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'gao-feng';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'lin-xiao', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'lin-xiao';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'he-jun', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'he-jun';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'luo-yan', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'luo-yan';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'song-wei', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'song-wei';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'tang-li', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'tang-li';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'feng-gang', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'feng-gang';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'cao-jing', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'cao-jing';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'xie-min', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'xie-min';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'deng-chao', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'deng-chao';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'han-xue', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'han-xue';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'kong-ming', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'kong-ming';

-- 插入员工事实
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"张伟","slug":"zhang-wei","org":"研发技术中心-Java组","role":"高级工程师","hireDate":"2020-03-15","email":"zhangwei@example.com","mobile":"13800000001"}'::jsonb, now(), now()
FROM employee WHERE slug = 'zhang-wei';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"李娜","slug":"li-na","org":"研发技术中心-Java组","role":"技术专家","hireDate":"2018-06-01","email":"lina@example.com","mobile":"13800000002"}'::jsonb, now(), now()
FROM employee WHERE slug = 'li-na';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"王芳","slug":"wang-fang","org":"研发技术中心-Java组","role":"工程师","hireDate":"2021-07-20","email":"wangfang@example.com","mobile":"13800000003"}'::jsonb, now(), now()
FROM employee WHERE slug = 'wang-fang';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"刘洋","slug":"liu-yang","org":"研发技术中心-前端组","role":"高级工程师","hireDate":"2019-09-10","email":"liuyang@example.com","mobile":"13800000004"}'::jsonb, now(), now()
FROM employee WHERE slug = 'liu-yang';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"陈静","slug":"chen-jing","org":"研发技术中心-前端组","role":"技术专家","hireDate":"2017-11-05","email":"chenjing@example.com","mobile":"13800000005"}'::jsonb, now(), now()
FROM employee WHERE slug = 'chen-jing';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"赵磊","slug":"zhao-lei","org":"研发技术中心-前端组","role":"工程师","hireDate":"2022-02-14","email":"zhaolei@example.com","mobile":"13800000006"}'::jsonb, now(), now()
FROM employee WHERE slug = 'zhao-lei';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"孙强","slug":"sun-qiang","org":"研发技术中心-Python组","role":"技术专家","hireDate":"2016-04-18","email":"sunqiang@example.com","mobile":"13800000007"}'::jsonb, now(), now()
FROM employee WHERE slug = 'sun-qiang';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"周敏","slug":"zhou-min","org":"研发技术中心-Python组","role":"高级工程师","hireDate":"2020-08-22","email":"zhoumin@example.com","mobile":"13800000008"}'::jsonb, now(), now()
FROM employee WHERE slug = 'zhou-min';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"吴涛","slug":"wu-tao","org":"研发技术中心-Python组","role":"工程师","hireDate":"2021-12-01","email":"wutao@example.com","mobile":"13800000009"}'::jsonb, now(), now()
FROM employee WHERE slug = 'wu-tao';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"郑华","slug":"zheng-hua","org":"研发技术中心-测试组","role":"测试专家","hireDate":"2015-10-08","email":"zhenghua@example.com","mobile":"13800000010"}'::jsonb, now(), now()
FROM employee WHERE slug = 'zheng-hua';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"王军","slug":"wang-jun","org":"研发技术中心-测试组","role":"高级测试工程师","hireDate":"2019-05-16","email":"wangjun@example.com","mobile":"13800000011"}'::jsonb, now(), now()
FROM employee WHERE slug = 'wang-jun';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"李雪","slug":"li-xue","org":"研发技术中心-测试组","role":"测试工程师","hireDate":"2022-06-30","email":"lixue@example.com","mobile":"13800000012"}'::jsonb, now(), now()
FROM employee WHERE slug = 'li-xue';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"张鹏","slug":"zhang-peng","org":"研发技术中心-运维组","role":"运维专家","hireDate":"2018-01-25","email":"zhangpeng@example.com","mobile":"13800000013"}'::jsonb, now(), now()
FROM employee WHERE slug = 'zhang-peng';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"刘伟","slug":"liu-wei","org":"研发技术中心-运维组","role":"高级运维工程师","hireDate":"2020-04-12","email":"liuwei@example.com","mobile":"13800000014"}'::jsonb, now(), now()
FROM employee WHERE slug = 'liu-wei';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"陈浩","slug":"chen-hao","org":"研发技术中心-运维组","role":"运维工程师","hireDate":"2023-03-08","email":"chenhao@example.com","mobile":"13800000015"}'::jsonb, now(), now()
FROM employee WHERE slug = 'chen-hao';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"杨丽","slug":"yang-li","org":"数据技术中心-数据分析组","role":"数据分析专家","hireDate":"2017-07-19","email":"yangli@example.com","mobile":"13800000016"}'::jsonb, now(), now()
FROM employee WHERE slug = 'yang-li';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"黄明","slug":"huang-ming","org":"数据技术中心-数据分析组","role":"高级数据分析师","hireDate":"2019-11-23","email":"huangming@example.com","mobile":"13800000017"}'::jsonb, now(), now()
FROM employee WHERE slug = 'huang-ming';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"徐婷","slug":"xu-ting","org":"数据技术中心-数据分析组","role":"数据分析师","hireDate":"2021-09-05","email":"xuting@example.com","mobile":"13800000018"}'::jsonb, now(), now()
FROM employee WHERE slug = 'xu-ting';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"高峰","slug":"gao-feng","org":"数据技术中心-数据工程组","role":"数据工程专家","hireDate":"2016-08-14","email":"gaofeng@example.com","mobile":"13800000019"}'::jsonb, now(), now()
FROM employee WHERE slug = 'gao-feng';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"林晓","slug":"lin-xiao","org":"数据技术中心-数据工程组","role":"高级数据工程师","hireDate":"2020-02-28","email":"linxiao@example.com","mobile":"13800000020"}'::jsonb, now(), now()
FROM employee WHERE slug = 'lin-xiao';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"何军","slug":"he-jun","org":"数据技术中心-数据工程组","role":"数据工程师","hireDate":"2022-10-17","email":"hejun@example.com","mobile":"13800000021"}'::jsonb, now(), now()
FROM employee WHERE slug = 'he-jun';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"罗燕","slug":"luo-yan","org":"数据技术中心-数据治理组","role":"数据治理专家","hireDate":"2018-05-09","email":"luoyan@example.com","mobile":"13800000022"}'::jsonb, now(), now()
FROM employee WHERE slug = 'luo-yan';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"宋伟","slug":"song-wei","org":"数据技术中心-数据治理组","role":"数据治理工程师","hireDate":"2021-04-26","email":"songwei@example.com","mobile":"13800000023"}'::jsonb, now(), now()
FROM employee WHERE slug = 'song-wei';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"唐丽","slug":"tang-li","org":"业务与管理部-销售组","role":"销售总监","hireDate":"2015-03-12","email":"tangli@example.com","mobile":"13800000024"}'::jsonb, now(), now()
FROM employee WHERE slug = 'tang-li';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"冯刚","slug":"feng-gang","org":"业务与管理部-销售组","role":"高级销售经理","hireDate":"2018-09-20","email":"fenggang@example.com","mobile":"13800000025"}'::jsonb, now(), now()
FROM employee WHERE slug = 'feng-gang';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"曹静","slug":"cao-jing","org":"业务与管理部-销售组","role":"销售经理","hireDate":"2020-06-15","email":"caojing@example.com","mobile":"13800000026"}'::jsonb, now(), now()
FROM employee WHERE slug = 'cao-jing';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"谢敏","slug":"xie-min","org":"业务与管理部-产品组","role":"产品总监","hireDate":"2017-01-08","email":"xiemin@example.com","mobile":"13800000027"}'::jsonb, now(), now()
FROM employee WHERE slug = 'xie-min';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"邓超","slug":"deng-chao","org":"业务与管理部-产品组","role":"高级产品经理","hireDate":"2019-07-22","email":"dengchao@example.com","mobile":"13800000028"}'::jsonb, now(), now()
FROM employee WHERE slug = 'deng-chao';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"韩雪","slug":"han-xue","org":"业务与管理部-项目管理组","role":"项目经理","hireDate":"2021-05-10","email":"hanxue@example.com","mobile":"13800000029"}'::jsonb, now(), now()
FROM employee WHERE slug = 'han-xue';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"孔明","slug":"kong-ming","org":"业务与管理部-客户成功组","role":"客户成功专家","hireDate":"2016-11-30","email":"kongming@example.com","mobile":"13800000030"}'::jsonb, now(), now()
FROM employee WHERE slug = 'kong-ming';

-- 插入组织关系（组长、主管、领域专家）
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e4803d99-177d-4b7b-8f11-c8c00cfb4a64', 'zhang-wei-manager-li-na', 'zhang-wei', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('5d6c43cc-c62d-41fb-8d13-e00dcba9293a', 'wang-fang-manager-li-na', 'wang-fang', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('803c2fc2-3e52-430c-b67a-fed8963d6e31', 'liu-yang-manager-chen-jing', 'liu-yang', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('46c028dd-3fcc-42d9-86e5-979346f4f41b', 'zhao-lei-manager-chen-jing', 'zhao-lei', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('fbce045d-8508-4da1-bf15-95ff729d48f6', 'zhou-min-manager-sun-qiang', 'zhou-min', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('93397911-496d-4836-9dfe-11f59400f771', 'wu-tao-manager-sun-qiang', 'wu-tao', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('b0f9ab4d-f586-4598-9985-5b323f90228f', 'wang-jun-manager-zheng-hua', 'wang-jun', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('390c86cd-26bc-42cb-90a1-ab4f675bde27', 'li-xue-manager-zheng-hua', 'li-xue', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('7ff1a6b5-72a5-4114-8ac2-23e77146d1c6', 'liu-wei-manager-zhang-peng', 'liu-wei', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('00e29f3f-a9cc-4856-b7c0-f5d421f6da2d', 'chen-hao-manager-zhang-peng', 'chen-hao', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('24aee779-6815-4c74-a404-22894531b82e', 'huang-ming-manager-yang-li', 'huang-ming', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('cb75091b-5453-47bf-8d03-471397f167a4', 'xu-ting-manager-yang-li', 'xu-ting', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('ade20534-2886-4c10-b2e6-0d1bf17353a6', 'lin-xiao-manager-gao-feng', 'lin-xiao', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('96a881fe-953a-40b0-abed-96dbb09e5f53', 'he-jun-manager-gao-feng', 'he-jun', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f568bde2-4133-4941-af44-ed7b44bc210c', 'song-wei-manager-luo-yan', 'song-wei', 'manager', 'luo-yan', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('0997f333-d069-4db0-84d4-ca63c7b73154', 'feng-gang-manager-tang-li', 'feng-gang', 'manager', 'tang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('5003c1d5-bba3-4a54-ba52-d6f1b63ec0c9', 'cao-jing-manager-tang-li', 'cao-jing', 'manager', 'tang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('67ed6048-25d3-4c09-8ce2-0fd183abf565', 'deng-chao-manager-xie-min', 'deng-chao', 'manager', 'xie-min', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('dea54e4b-fa17-422d-a8c1-4de7d4b248bf', 'zhang-wei-expert-li-na', 'zhang-wei', 'expert', 'li-na', 'java', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('c137a738-8ade-485f-8ff4-3633ba536732', 'wang-fang-expert-li-na', 'wang-fang', 'expert', 'li-na', 'java', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('85f476a9-129a-4bad-b057-5b1612675922', 'liu-yang-expert-chen-jing', 'liu-yang', 'expert', 'chen-jing', 'frontend', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('a355211b-207b-40d7-99f0-fe1438f24e41', 'zhao-lei-expert-chen-jing', 'zhao-lei', 'expert', 'chen-jing', 'frontend', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('ef19db67-d915-409d-bcdc-5ed63485bdc6', 'zhou-min-expert-sun-qiang', 'zhou-min', 'expert', 'sun-qiang', 'python', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('ab315d05-c470-4e8d-a76c-bc8d321a274d', 'wu-tao-expert-sun-qiang', 'wu-tao', 'expert', 'sun-qiang', 'python', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('bc304c38-cb06-40f6-9414-b79b7ddc2123', 'wang-jun-expert-zheng-hua', 'wang-jun', 'expert', 'zheng-hua', 'testing', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('8e60e93f-7c67-4f89-b7c6-b6ad41a0c103', 'li-xue-expert-zheng-hua', 'li-xue', 'expert', 'zheng-hua', 'testing', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('c7df1f81-404b-4f69-9820-3ea5ea868c49', 'liu-wei-expert-zhang-peng', 'liu-wei', 'expert', 'zhang-peng', 'devops', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e08550a8-b2f0-4df1-9216-2e033fda27a7', 'chen-hao-expert-zhang-peng', 'chen-hao', 'expert', 'zhang-peng', 'devops', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('41f28b98-a08c-4067-93ea-ad2accfd1687', 'huang-ming-expert-yang-li', 'huang-ming', 'expert', 'yang-li', 'data-analysis', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('31edfc7b-0f91-44c1-9b72-036a24fbe64d', 'xu-ting-expert-yang-li', 'xu-ting', 'expert', 'yang-li', 'data-analysis', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('8909f893-158c-4205-9946-9d8cef68bc9f', 'lin-xiao-expert-gao-feng', 'lin-xiao', 'expert', 'gao-feng', 'data-engineering', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('66320b6c-3db3-47b5-99f8-1bb49a4eacd9', 'he-jun-expert-gao-feng', 'he-jun', 'expert', 'gao-feng', 'data-engineering', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('04a7b012-6fa1-4f6c-ab3c-0e435d7ee79a', 'song-wei-expert-luo-yan', 'song-wei', 'expert', 'luo-yan', 'data-governance', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('825d788e-925c-44e1-85a5-43e49c9e2c02', 'feng-gang-expert-tang-li', 'feng-gang', 'expert', 'tang-li', 'sales', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('5488775a-8db4-4c7c-b7ad-0b20382a9208', 'cao-jing-expert-tang-li', 'cao-jing', 'expert', 'tang-li', 'sales', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('3e3cf741-b7d5-48aa-88fc-51ddf2f417b9', 'deng-chao-expert-xie-min', 'deng-chao', 'expert', 'xie-min', 'product', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());

-- 插入初始技能等级（用于测试认证流程）
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('0ad60d03-c192-459a-834a-c58d6b8986c1', 'zhang-wei-skill-java-l2', 'zhang-wei', 'skill-java', 2, '2025-06-15'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('a7c53564-ede6-41ee-a82f-58d3ddc6fc25', 'li-na-skill-java-l4', 'li-na', 'skill-java', 4, '2024-03-20'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('298c1e46-27bb-4177-96f7-aab2a23102b3', 'liu-yang-skill-frontend-l2', 'liu-yang', 'skill-frontend', 2, '2025-08-10'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('018e1d31-f1e2-4175-a223-cd79fa4a0266', 'chen-jing-skill-frontend-l4', 'chen-jing', 'skill-frontend', 4, '2024-01-15'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('992a8822-05bc-4436-807a-0993a642e45b', 'sun-qiang-skill-python-l4', 'sun-qiang', 'skill-python', 4, '2024-05-08'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('2d883e82-7b4e-42a5-99bb-54d9522d95ac', 'yang-li-skill-data-analysis-l4', 'yang-li', 'skill-data-analysis', 4, '2024-02-14'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('69524f0c-62f1-4d0c-84e4-3ebd82276384', 'gao-feng-skill-data-engineering-l4', 'gao-feng', 'skill-data-engineering', 4, '2024-04-22'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());

COMMIT;

-- ============================================
-- 数据摘要
-- ============================================

-- 部门分布：
--   研发技术中心: 15 人
--   数据技术中心: 8 人
--   业务与管理部: 7 人

-- 角色分布：
--   高级工程师: 9 人
--   专家: 9 人
--   工程师: 10 人
--   总监: 2 人

-- 领域专家：
--   李娜 (技术专家): java
--   陈静 (技术专家): frontend
--   孙强 (技术专家): python
--   郑华 (测试专家): testing
--   张鹏 (运维专家): devops
--   杨丽 (数据分析专家): data-analysis
--   高峰 (数据工程专家): data-engineering
--   罗燕 (数据治理专家): data-governance
--   唐丽 (销售总监): sales
--   谢敏 (产品总监): product
--   孔明 (客户成功专家): N/A

-- 测试账号示例：
--   张伟（Java 高级工程师）: zhang-wei / SkillTree@2026
--   李娜（Java 技术专家）: li-na / SkillTree@2026
--   刘洋（前端高级工程师）: liu-yang / SkillTree@2026
--   陈静（前端技术专家）: chen-jing / SkillTree@2026
--   唐丽（销售总监）: tang-li / SkillTree@2026
