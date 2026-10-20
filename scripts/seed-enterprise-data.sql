-- ============================================
-- 企业级员工关系种子数据
-- 生成时间：2026-10-20T06:49:29.605Z
-- 员工数量：23
-- 组织关系：31
-- 初始技能：4
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
DELETE FROM mvp_org_relation WHERE employee_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei','lin-xiao') OR target_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei','lin-xiao');
DELETE FROM mvp_employee_skill WHERE employee_slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei');
DELETE FROM app_session WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_external_identity WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_oauth_flow WHERE link_account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM app_account WHERE employee_id IN (SELECT id FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei'));
DELETE FROM employee WHERE slug IN ('zhang-wei','li-na','wang-fang','liu-yang','chen-jing','zhao-lei','sun-qiang','zhou-min','wu-tao','zheng-hua','wang-jun','li-xue','zhang-peng','liu-wei','chen-hao','yang-li','huang-ming','xu-ting','gao-feng','lin-xiao-de','he-jun','luo-yan','song-wei');

-- 插入 23 名员工
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('277b3616-3fed-4a2b-8fa6-e361af19aae9', 'zhang-wei', '张伟', '张', 'blue', '高级工程师', '研发技术中心-Java组', 'active', '2020-03-15', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('f227737f-a3f3-4962-910e-dd43088a2745', 'li-na', '李娜', '李', 'blue', '技术专家', '研发技术中心-Java组', 'active', '2018-06-01', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('540d4c5b-93ba-4b15-8b58-7831f5efa580', 'wang-fang', '王芳', '王', 'blue', '工程师', '研发技术中心-Java组', 'active', '2021-07-20', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('1004b88a-38c9-432a-9bac-84e7f532c720', 'liu-yang', '刘洋', '刘', 'blue', '高级工程师', '研发技术中心-前端组', 'active', '2019-09-10', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('934f6fd9-8543-4c1d-a16b-b84511be1380', 'chen-jing', '陈静', '陈', 'blue', '技术专家', '研发技术中心-前端组', 'active', '2017-11-05', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('851ed2eb-324e-4bc9-9dfb-ce738f682978', 'zhao-lei', '赵磊', '赵', 'blue', '工程师', '研发技术中心-前端组', 'active', '2022-02-14', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('b8f1571b-ea62-4ebb-bfe0-f739670988b4', 'sun-qiang', '孙强', '孙', 'blue', '技术专家', '研发技术中心-Python组', 'active', '2016-04-18', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('839dcb11-557b-4834-a2b3-79e22e4ba3f0', 'zhou-min', '周敏', '周', 'blue', '高级工程师', '研发技术中心-Python组', 'active', '2020-08-22', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('121bf785-ddbe-4448-8a36-2796c765c47f', 'wu-tao', '吴涛', '吴', 'blue', '工程师', '研发技术中心-Python组', 'active', '2021-12-01', 1996, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('fbb33aff-f144-443b-bacc-a62fa2e5cede', 'zheng-hua', '郑华', '郑', 'blue', '测试专家', '研发技术中心-测试组', 'active', '2015-10-08', 1990, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('14ea9746-7be9-482d-a30f-ca17b69933cb', 'wang-jun', '王军', '王', 'blue', '高级测试工程师', '研发技术中心-测试组', 'active', '2019-05-16', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('2aefd2eb-805f-4258-89a3-c79841bfe7d1', 'li-xue', '李雪', '李', 'blue', '测试工程师', '研发技术中心-测试组', 'active', '2022-06-30', 1997, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('3fad2032-5c2e-4c42-8fc9-59e8db404536', 'zhang-peng', '张鹏', '张', 'blue', '运维专家', '研发技术中心-运维组', 'active', '2018-01-25', 1993, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('9b0219ac-6753-4287-820b-bec914217123', 'liu-wei', '刘伟', '刘', 'blue', '高级运维工程师', '研发技术中心-运维组', 'active', '2020-04-12', 1995, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('8001e9f6-42cf-4f78-9ada-17de81503fd7', 'chen-hao', '陈浩', '陈', 'blue', '运维工程师', '研发技术中心-运维组', 'active', '2023-03-08', 1998, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('333be4e3-25dd-46d3-9550-3f450c3817b0', 'yang-li', '杨丽', '杨', 'blue', '数据分析专家', '数据技术中心-数据分析组', 'active', '2017-07-19', 1992, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('3e0db515-4d43-441d-bbde-0862b6e5c079', 'huang-ming', '黄明', '黄', 'blue', '高级数据分析师', '数据技术中心-数据分析组', 'active', '2019-11-23', 1994, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('62feb09d-e701-49a9-913b-d6afe25fa087', 'xu-ting', '徐婷', '徐', 'blue', '数据分析师', '数据技术中心-数据分析组', 'active', '2021-09-05', 1996, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('9b59e65c-6951-4f6f-a653-7bf1341ed1ec', 'gao-feng', '高峰', '高', 'blue', '数据工程专家', '数据技术中心-数据工程组', 'active', '2016-08-14', 1991, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('a80ad933-240e-41ce-93b2-e46f64fdfe1f', 'lin-xiao-de', '林晓（数据）', '林', 'blue', '高级数据工程师', '数据技术中心-数据工程组', 'active', '2020-02-28', 1995, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('be7dbba4-4338-4880-88ef-14f6b9b7f98b', 'he-jun', '何军', '何', 'blue', '数据工程师', '数据技术中心-数据工程组', 'active', '2022-10-17', 1997, '男', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('24559e45-a233-4985-857c-e4b06aa794d7', 'luo-yan', '罗燕', '罗', 'blue', '数据治理专家', '数据技术中心-数据治理组', 'active', '2018-05-09', 1993, '女', '本科', false, now(), now());
INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('c444b555-33ad-4afe-ab1d-d421c7dd3c83', 'song-wei', '宋伟', '宋', 'blue', '数据治理工程师', '数据技术中心-数据治理组', 'active', '2021-04-26', 1996, '男', '本科', false, now(), now());

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
VALUES ('9920cb84-92b8-4879-be39-013c956d5543', 'zhang-wei-manager-li-na', 'zhang-wei', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e56814c9-e3f4-426a-8234-b3e5494c98a6', 'wang-fang-manager-li-na', 'wang-fang', 'manager', 'li-na', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('fdcdf696-5681-46d8-ae9f-223713b692db', 'liu-yang-manager-chen-jing', 'liu-yang', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('55af55fd-a097-48e0-b71e-4ccb4db6f0aa', 'zhao-lei-manager-chen-jing', 'zhao-lei', 'manager', 'chen-jing', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('b735ca5a-1913-4212-ae6c-e63db6ad388c', 'zhou-min-manager-sun-qiang', 'zhou-min', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('60862d2b-1144-4436-af3f-a8c68ad4fb0b', 'wu-tao-manager-sun-qiang', 'wu-tao', 'manager', 'sun-qiang', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('2891dac5-02d0-419e-965d-0dfeeb68e58c', 'wang-jun-manager-zheng-hua', 'wang-jun', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('79579d9a-5cd2-4d17-a14a-a03b2dc4fcc0', 'li-xue-manager-zheng-hua', 'li-xue', 'manager', 'zheng-hua', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('44949b88-fd00-471e-b020-fb7e5e75a4c6', 'liu-wei-manager-zhang-peng', 'liu-wei', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('43d67d43-1d51-457e-84ba-f389222cdb71', 'chen-hao-manager-zhang-peng', 'chen-hao', 'manager', 'zhang-peng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('ed1cfdb1-6a01-4968-9527-4200a09f3e8e', 'huang-ming-manager-yang-li', 'huang-ming', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('3995ea1a-dee7-476e-8cb2-ab9e83403fdd', 'xu-ting-manager-yang-li', 'xu-ting', 'manager', 'yang-li', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('302db588-467e-4f81-9d8d-b3b2c3a33e0b', 'lin-xiao-de-manager-gao-feng', 'lin-xiao-de', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('ac8b407d-331a-4c30-b456-c0d6f0bd02ab', 'he-jun-manager-gao-feng', 'he-jun', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('e15107b8-6165-49b6-9c8c-12686b6da5fa', 'lin-xiao-manager-gao-feng', 'lin-xiao', 'manager', 'gao-feng', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('60b89700-9859-4a0e-b282-2773aaaecdf8', 'song-wei-manager-luo-yan', 'song-wei', 'manager', 'luo-yan', NULL, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('bc7c22d8-6e27-478e-ae70-f1501c681769', 'zhang-wei-expert-li-na', 'zhang-wei', 'expert', 'li-na', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('2e093c60-1e06-414b-a850-6ee6697d8743', 'wang-fang-expert-li-na', 'wang-fang', 'expert', 'li-na', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f27b39d2-19bd-462a-9326-7b05bd4598e3', 'liu-yang-expert-chen-jing', 'liu-yang', 'expert', 'chen-jing', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('f3c73670-bd8c-4e5e-90c9-c32e50d1a6d7', 'zhao-lei-expert-chen-jing', 'zhao-lei', 'expert', 'chen-jing', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('1d8577ac-9838-4b48-9eeb-c26a774c6412', 'zhou-min-expert-sun-qiang', 'zhou-min', 'expert', 'sun-qiang', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('14741eea-b094-4e4a-8240-c2ffd3e66821', 'wu-tao-expert-sun-qiang', 'wu-tao', 'expert', 'sun-qiang', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('3bbd2994-cf84-44b1-89ac-2bab55df7953', 'wang-jun-expert-zheng-hua', 'wang-jun', 'expert', 'zheng-hua', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('3db74b92-1964-46bb-a217-51f4027c5e04', 'li-xue-expert-zheng-hua', 'li-xue', 'expert', 'zheng-hua', 'software', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('24c0307e-0041-49a9-a92e-6d0210fd7a9b', 'liu-wei-expert-zhang-peng', 'liu-wei', 'expert', 'zhang-peng', 'platform', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('aa66e3ec-1273-4e2c-801c-4fb620c4624a', 'chen-hao-expert-zhang-peng', 'chen-hao', 'expert', 'zhang-peng', 'platform', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('823e9987-9c9e-4dbd-8b68-cfdfce9a3ef1', 'huang-ming-expert-yang-li', 'huang-ming', 'expert', 'yang-li', 'ai', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('0f979027-2c78-4620-a967-718a8c5d3138', 'xu-ting-expert-yang-li', 'xu-ting', 'expert', 'yang-li', 'ai', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('9beb46b3-ccb4-4bb9-b334-10ecacf83f90', 'lin-xiao-de-expert-gao-feng', 'lin-xiao-de', 'expert', 'gao-feng', 'ai', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('d6376cc1-a83e-4df9-af64-fce6007b3739', 'he-jun-expert-gao-feng', 'he-jun', 'expert', 'gao-feng', 'ai', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());
INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('778e3126-778b-44e7-a3e8-100a58f0a1cc', 'song-wei-expert-luo-yan', 'song-wei', 'expert', 'luo-yan', 'ai', '2026-01-01'::timestamptz, NULL, 'seed', now(), now());

-- 插入初始技能等级（用于测试认证流程）
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('3d737867-47e5-4d34-a911-8d7659f7ec53', 'zhang-wei-java-go-eng-l2', 'zhang-wei', 'java-go-eng', 2, '2025-06-15'::timestamptz, 'initial-seed', 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('922e3be5-4b9f-4b8a-a571-4d5742860b28', 'li-na-java-go-eng-l4', 'li-na', 'java-go-eng', 4, '2024-03-20'::timestamptz, 'initial-seed', 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('2f948c37-1f62-4fec-b5bd-74795de22ae2', 'yang-li-data-analysis-l4', 'yang-li', 'data-analysis', 4, '2024-02-14'::timestamptz, 'initial-seed', 'initial-seed', 'active', now(), NULL, now(), now());
INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('4f758a3c-cd5a-4382-9204-3431f91b5122', 'gao-feng-data-processing-l4', 'gao-feng', 'data-processing', 4, '2024-04-22'::timestamptz, 'initial-seed', 'initial-seed', 'active', now(), NULL, now(), now());

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
--   李娜 (技术专家): software
--   陈静 (技术专家): software
--   孙强 (技术专家): software
--   郑华 (测试专家): software
--   张鹏 (运维专家): platform
--   杨丽 (数据分析专家): ai
--   高峰 (数据工程专家): ai
--   罗燕 (数据治理专家): ai

-- 测试账号示例：
--   张伟（Java 高级工程师）: zhang-wei / SkillTree@2026
--   李娜（Java 技术专家）: li-na / SkillTree@2026
--   刘洋（前端高级工程师）: liu-yang / SkillTree@2026
--   陈静（前端技术专家）: chen-jing / SkillTree@2026
