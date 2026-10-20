-- ============================================
-- 企业级员工关系种子数据
-- 生成时间：2026-10-20T06:36:20.970Z
-- 员工数量：23
-- 组织关系：30
-- 初始技能：7
-- 统一密码：SkillTree@2026
-- ============================================

BEGIN;

-- 清空现有数据（仅用于演示环境）
-- 保留旧演示员工（zhang-san/zhou-chen/lin-xiao/chen-ran 等），
-- 因为 employee_project/performance_record/employee_skill 等旧表仍引用他们

-- 删除新员工的关联数据（按外键依赖顺序）
DELETE FROM mvp_fact_change WHERE employee_id IN (SELECT id FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM mvp_fact WHERE employee_id IN (SELECT id FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM mvp_fact_employee WHERE employee_id IN (SELECT id FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM mvp_org_relation WHERE employee_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei') OR target_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei');
DELETE FROM mvp_employee_skill WHERE employee_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei');
DELETE FROM app_session WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_external_identity WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_oauth_flow WHERE link_account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_account WHERE employee_id IN (SELECT id FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei');

-- 插入 23 名员工
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('5a079eb1-0dd7-47cf-bf84-7eb9218812fc', 'zhang-wei', '张伟', '张', 'blue', '高级工程师', '研发技术中心-Java组', 'active', '2020-03-15', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('17c4bfef-97ad-4221-a2e0-8d0e1c1cddd7', 'li-na', '李娜', '李', 'blue', '技术专家', '研发技术中心-Java组', 'active', '2018-06-01', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('ba49b1dc-8bd4-4387-97ea-c6a253db6882', 'wang-fang', '王芳', '王', 'blue', '工程师', '研发技术中心-Java组', 'active', '2021-07-20', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('a12e5e64-9d15-4666-a390-1c09662628b9', 'liu-yang', '刘洋', '刘', 'blue', '高级工程师', '研发技术中心-前端组', 'active', '2019-09-10', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('26f09b31-b9d7-4de4-a47f-3190a5bb8950', 'chen-jing', '陈静', '陈', 'blue', '技术专家', '研发技术中心-前端组', 'active', '2017-11-05', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('59a32300-b31f-4f05-88c2-b93c1709f4aa', 'zhao-lei', '赵磊', '赵', 'blue', '工程师', '研发技术中心-前端组', 'active', '2022-02-14', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('b045c40a-d758-4bc9-ad93-c1e56d725aae', 'sun-qiang', '孙强', '孙', 'blue', '技术专家', '研发技术中心-Python组', 'active', '2016-04-18', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('26a5d9a3-e813-4159-96b6-f54bb507cd44', 'zhou-min', '周敏', '周', 'blue', '高级工程师', '研发技术中心-Python组', 'active', '2020-08-22', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('f029a54d-1cee-448c-b1c3-1d3308e262c6', 'wu-tao', '吴涛', '吴', 'blue', '工程师', '研发技术中心-Python组', 'active', '2021-12-01', 1996, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('c421b067-3d6d-47ee-81ef-9cd9f03dc199', 'zheng-hua', '郑华', '郑', 'blue', '测试专家', '研发技术中心-测试组', 'active', '2015-10-08', 1990, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('4e5aeb01-2452-455d-88e4-cdff6bc6c0ae', 'wang-jun', '王军', '王', 'blue', '高级测试工程师', '研发技术中心-测试组', 'active', '2019-05-16', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('7e5d59d3-5060-42ee-bef6-48670022560d', 'li-xue', '李雪', '李', 'blue', '测试工程师', '研发技术中心-测试组', 'active', '2022-06-30', 1997, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('88c045aa-8ac2-40e5-b9a8-97a5fa523c8a', 'zhang-peng', '张鹏', '张', 'blue', '运维专家', '研发技术中心-运维组', 'active', '2018-01-25', 1993, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('44a4eb1f-f49a-4083-8a40-3ff18fd7bc4a', 'liu-wei', '刘伟', '刘', 'blue', '高级运维工程师', '研发技术中心-运维组', 'active', '2020-04-12', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('09cd1c74-c9c6-44d0-a7da-83eb66d02f1b', 'chen-hao', '陈浩', '陈', 'blue', '运维工程师', '研发技术中心-运维组', 'active', '2023-03-08', 1998, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('2fefb86b-6d82-47a1-a27f-33977050f6ff', 'yang-li', '杨丽', '杨', 'blue', '数据分析专家', '数据技术中心-数据分析组', 'active', '2017-07-19', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('07e7760d-07a9-4edb-a1cf-a4d348ddd7ed', 'huang-ming', '黄明', '黄', 'blue', '高级数据分析师', '数据技术中心-数据分析组', 'active', '2019-11-23', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('b0e8e846-9d08-4101-bfac-90f752980f18', 'xu-ting', '徐婷', '徐', 'blue', '数据分析师', '数据技术中心-数据分析组', 'active', '2021-09-05', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('e5d2fb96-1b25-42a7-9c2c-3521987f6604', 'gao-feng', '高峰', '高', 'blue', '数据工程专家', '数据技术中心-数据工程组', 'active', '2016-08-14', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('ee52043c-0df0-4509-8f65-d4aa29e386ab', 'lin-xiao-de', '林晓（数据）', '林', 'blue', '高级数据工程师', '数据技术中心-数据工程组', 'active', '2020-02-28', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('d151d9e7-132f-4a0e-ab74-6a92d3b3d235', 'he-jun', '何军', '何', 'blue', '数据工程师', '数据技术中心-数据工程组', 'active', '2022-10-17', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('04a439f4-9b64-4d33-96a5-b80554c8488b', 'luo-yan', '罗燕', '罗', 'blue', '数据治理专家', '数据技术中心-数据治理组', 'active', '2018-05-09', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('1db70543-5ac2-40be-987e-8a7171525abb', 'song-wei', '宋伟', '宋', 'blue', '数据治理工程师', '数据技术中心-数据治理组', 'active', '2021-04-26', 1996, '男', '本科', false, now(), now());

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
SELECT id, 'lin-xiao-de', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'lin-xiao-de';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'he-jun', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'he-jun';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'luo-yan', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'manager', true, now()
FROM employee WHERE slug = 'luo-yan';
INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, 'song-wei', 'scrypt:skilltree-salt-2026:d67c20616b14b3a126a8b226707afbf091faad631ae04aac5bde91758a659ff3d1f6663d9e417411ca3e44df0c763e9df5204fe968533349a4fdd098505a1952', 'employee', true, now()
FROM employee WHERE slug = 'song-wei';

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
SELECT id, '{"name":"林晓（数据）","slug":"lin-xiao-de","org":"数据技术中心-数据工程组","role":"高级数据工程师","hireDate":"2020-02-28","email":"linxiao-de@example.com","mobile":"13800000020"}'::jsonb, now(), now()
FROM employee WHERE slug = 'lin-xiao-de';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"何军","slug":"he-jun","org":"数据技术中心-数据工程组","role":"数据工程师","hireDate":"2022-10-17","email":"hejun@example.com","mobile":"13800000021"}'::jsonb, now(), now()
FROM employee WHERE slug = 'he-jun';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"罗燕","slug":"luo-yan","org":"数据技术中心-数据治理组","role":"数据治理专家","hireDate":"2018-05-09","email":"luoyan@example.com","mobile":"13800000022"}'::jsonb, now(), now()
FROM employee WHERE slug = 'luo-yan';
INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '{"name":"宋伟","slug":"song-wei","org":"数据技术中心-数据治理组","role":"数据治理工程师","hireDate":"2021-04-26","email":"songwei@example.com","mobile":"13800000023"}'::jsonb, now(), now()
FROM employee WHERE slug = 'song-wei';

-- 插入组织关系（组长、主管、领域专家）
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('6efe56ef-ee41-4602-9354-7ba8188bc78c', 'zhang-wei-manager-li-na', 'zhang-wei', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('be6f0459-ab83-42b9-8da9-737db2f928fd', 'wang-fang-manager-li-na', 'wang-fang', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('b9ffe05e-8d59-42c8-aebe-8fb58d39de71', 'liu-yang-manager-chen-jing', 'liu-yang', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e69087ff-ead6-4ea8-af83-360d81bdd206', 'zhao-lei-manager-chen-jing', 'zhao-lei', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('d73b1acb-6b8f-413e-961a-39ea5a2daa48', 'zhou-min-manager-sun-qiang', 'zhou-min', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('7b26e2ce-3b1e-4edd-9540-80ecd41333af', 'wu-tao-manager-sun-qiang', 'wu-tao', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('abff06f3-5f02-485d-95da-d880b71de5f3', 'wang-jun-manager-zheng-hua', 'wang-jun', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('0c9d3971-7202-463c-af85-f3b98d6ec559', 'li-xue-manager-zheng-hua', 'li-xue', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('057ce22e-d07a-4396-8b5b-c3202169e7d0', 'liu-wei-manager-zhang-peng', 'liu-wei', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('1a82601b-3fa9-4df0-b676-3040f9159d03', 'chen-hao-manager-zhang-peng', 'chen-hao', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f68784bc-d408-41a3-9f51-331560af898b', 'huang-ming-manager-yang-li', 'huang-ming', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('fceae6d8-6413-4568-879e-69d27b3bc781', 'xu-ting-manager-yang-li', 'xu-ting', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('0db4c611-da89-4bb5-97ed-4b14f58cf46d', 'lin-xiao-de-manager-gao-feng', 'lin-xiao-de', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('14fb4c52-9249-4c11-8d19-6a7df7e9b5f7', 'he-jun-manager-gao-feng', 'he-jun', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('8d479a67-b355-4197-8be4-affd09afa173', 'song-wei-manager-luo-yan', 'song-wei', 'manager', 'luo-yan', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('be88cb53-84fe-4e32-8baa-a62c0315aa1d', 'zhang-wei-expert-li-na', 'zhang-wei', 'expert', 'li-na', 'java', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f314484d-877c-4a50-841a-b5f53b64ae1a', 'wang-fang-expert-li-na', 'wang-fang', 'expert', 'li-na', 'java', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('fa00871a-47cc-40b1-a20e-2c766478b014', 'liu-yang-expert-chen-jing', 'liu-yang', 'expert', 'chen-jing', 'frontend', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('4ae9629a-84f7-4fa9-ac57-633d0f2b2d17', 'zhao-lei-expert-chen-jing', 'zhao-lei', 'expert', 'chen-jing', 'frontend', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('6c235732-02a2-41f6-9b54-5a93bb56dbe7', 'zhou-min-expert-sun-qiang', 'zhou-min', 'expert', 'sun-qiang', 'python', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e007b477-9717-4182-ba0f-2d8ad7ee7cf2', 'wu-tao-expert-sun-qiang', 'wu-tao', 'expert', 'sun-qiang', 'python', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('38b7fd0f-64ff-4edd-84a8-0ef0ad575eef', 'wang-jun-expert-zheng-hua', 'wang-jun', 'expert', 'zheng-hua', 'testing', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('12853103-4b27-4c51-a6ab-c4cad5f5ef91', 'li-xue-expert-zheng-hua', 'li-xue', 'expert', 'zheng-hua', 'testing', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f2dd6401-4c9c-45ef-9d03-74dd07d0f153', 'liu-wei-expert-zhang-peng', 'liu-wei', 'expert', 'zhang-peng', 'devops', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('32502f40-047b-41ef-a936-e2b76490a0c3', 'chen-hao-expert-zhang-peng', 'chen-hao', 'expert', 'zhang-peng', 'devops', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('d0d3f4d8-f839-47e3-adf1-af0c36fd0e9f', 'huang-ming-expert-yang-li', 'huang-ming', 'expert', 'yang-li', 'data-analysis', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('2a0093a0-ee85-4604-8db6-ef60aaa598d8', 'xu-ting-expert-yang-li', 'xu-ting', 'expert', 'yang-li', 'data-analysis', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('bd5f4e75-9fb7-4740-911d-8051552525ad', 'lin-xiao-de-expert-gao-feng', 'lin-xiao-de', 'expert', 'gao-feng', 'data-engineering', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('484b48bf-4f07-41c0-99dd-07772a82561b', 'he-jun-expert-gao-feng', 'he-jun', 'expert', 'gao-feng', 'data-engineering', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('a4ad1648-4716-43b9-90e0-dbd2f4ec6422', 'song-wei-expert-luo-yan', 'song-wei', 'expert', 'luo-yan', 'data-governance', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());

-- 插入初始技能等级（用于测试认证流程）
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('069b10cc-fc8c-4701-a869-ac99370aacfe', 'zhang-wei-skill-java-l2', 'zhang-wei', 'skill-java', 2, '2025-06-15'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('2690124a-016a-4f29-82f6-a50634d19b6d', 'li-na-skill-java-l4', 'li-na', 'skill-java', 4, '2024-03-20'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('20b29851-257b-40f8-9a14-b55c26346751', 'liu-yang-skill-frontend-l2', 'liu-yang', 'skill-frontend', 2, '2025-08-10'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('1c2120f4-dab3-459e-a31e-7aa170d34810', 'chen-jing-skill-frontend-l4', 'chen-jing', 'skill-frontend', 4, '2024-01-15'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('d2b91933-d8b3-4671-910e-eba042db5f94', 'sun-qiang-skill-python-l4', 'sun-qiang', 'skill-python', 4, '2024-05-08'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('18964330-7a6d-4529-af4a-f871e1ae1176', 'yang-li-skill-data-analysis-l4', 'yang-li', 'skill-data-analysis', 4, '2024-02-14'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('2041c7aa-3849-4e38-bc70-c252372ee6f7', 'gao-feng-skill-data-engineering-l4', 'gao-feng', 'skill-data-engineering', 4, '2024-04-22'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());

COMMIT;

-- ============================================
-- 数据摘要
-- ============================================

-- 部门分布：
--   研发技术中心: 15 人
--   数据技术中心: 8 人

-- 角色分布：
--   高级工程师: 7 人
--   专家: 8 人
--   工程师: 8 人

-- 领域专家：
--   李娜 (技术专家): java
--   陈静 (技术专家): frontend
--   孙强 (技术专家): python
--   郑华 (测试专家): testing
--   张鹏 (运维专家): devops
--   杨丽 (数据分析专家): data-analysis
--   高峰 (数据工程专家): data-engineering
--   罗燕 (数据治理专家): data-governance

-- 测试账号示例：
--   张伟（Java 高级工程师）: zhang-wei / SkillTree@2026
--   李娜（Java 技术专家）: li-na / SkillTree@2026
--   刘洋（前端高级工程师）: liu-yang / SkillTree@2026
--   陈静（前端技术专家）: chen-jing / SkillTree@2026
