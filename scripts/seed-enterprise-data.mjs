/**
 * 企业级员工关系种子数据生成脚本
 *
 * 用途：生成 23 名员工的完整企业数据（研发技术中心 15 + 数据技术中心 8），包括：
 * - 员工基本信息（姓名、部门、岗位、入职日期等）
 * - 组织关系（组长、主管、领域专家）
 * - 账号密码（用于测试登录）
 * - 初始技能等级（用于测试认证流程）
 *
 * 运行方式：node scripts/seed-enterprise-data.mjs
 */

import { randomUUID } from 'node:crypto';
import { scryptSync } from 'node:crypto';

// ============================================================
// 1. 员工基本信息（23 人，只覆盖 MVP 三条技术序列）
// ============================================================

const EMPLOYEES = [
  // ===== 研发技术中心 (15 人) =====
  { slug: 'zhang-wei', name: '张伟', gender: '男', birthYear: 1995, org: '研发技术中心-Java组', role: '高级工程师', hireDate: '2020-03-15', email: 'zhangwei@example.com', mobile: '13800000001' },
  { slug: 'li-na', name: '李娜', gender: '女', birthYear: 1993, org: '研发技术中心-Java组', role: '技术专家', hireDate: '2018-06-01', email: 'lina@example.com', mobile: '13800000002' },
  { slug: 'wang-fang', name: '王芳', gender: '女', birthYear: 1996, org: '研发技术中心-Java组', role: '工程师', hireDate: '2021-07-20', email: 'wangfang@example.com', mobile: '13800000003' },
  { slug: 'liu-yang', name: '刘洋', gender: '男', birthYear: 1994, org: '研发技术中心-前端组', role: '高级工程师', hireDate: '2019-09-10', email: 'liuyang@example.com', mobile: '13800000004' },
  { slug: 'chen-jing', name: '陈静', gender: '女', birthYear: 1992, org: '研发技术中心-前端组', role: '技术专家', hireDate: '2017-11-05', email: 'chenjing@example.com', mobile: '13800000005' },
  { slug: 'zhao-lei', name: '赵磊', gender: '男', birthYear: 1997, org: '研发技术中心-前端组', role: '工程师', hireDate: '2022-02-14', email: 'zhaolei@example.com', mobile: '13800000006' },
  { slug: 'sun-qiang', name: '孙强', gender: '男', birthYear: 1991, org: '研发技术中心-Python组', role: '技术专家', hireDate: '2016-04-18', email: 'sunqiang@example.com', mobile: '13800000007' },
  { slug: 'zhou-min', name: '周敏', gender: '女', birthYear: 1995, org: '研发技术中心-Python组', role: '高级工程师', hireDate: '2020-08-22', email: 'zhoumin@example.com', mobile: '13800000008' },
  { slug: 'wu-tao', name: '吴涛', gender: '男', birthYear: 1996, org: '研发技术中心-Python组', role: '工程师', hireDate: '2021-12-01', email: 'wutao@example.com', mobile: '13800000009' },
  { slug: 'zheng-hua', name: '郑华', gender: '男', birthYear: 1990, org: '研发技术中心-测试组', role: '测试专家', hireDate: '2015-10-08', email: 'zhenghua@example.com', mobile: '13800000010' },
  { slug: 'wang-jun', name: '王军', gender: '男', birthYear: 1994, org: '研发技术中心-测试组', role: '高级测试工程师', hireDate: '2019-05-16', email: 'wangjun@example.com', mobile: '13800000011' },
  { slug: 'li-xue', name: '李雪', gender: '女', birthYear: 1997, org: '研发技术中心-测试组', role: '测试工程师', hireDate: '2022-06-30', email: 'lixue@example.com', mobile: '13800000012' },
  { slug: 'zhang-peng', name: '张鹏', gender: '男', birthYear: 1993, org: '研发技术中心-运维组', role: '运维专家', hireDate: '2018-01-25', email: 'zhangpeng@example.com', mobile: '13800000013' },
  { slug: 'liu-wei', name: '刘伟', gender: '男', birthYear: 1995, org: '研发技术中心-运维组', role: '高级运维工程师', hireDate: '2020-04-12', email: 'liuwei@example.com', mobile: '13800000014' },
  { slug: 'chen-hao', name: '陈浩', gender: '男', birthYear: 1998, org: '研发技术中心-运维组', role: '运维工程师', hireDate: '2023-03-08', email: 'chenhao@example.com', mobile: '13800000015' },

  // ===== 数据技术中心 (8 人) =====
  { slug: 'yang-li', name: '杨丽', gender: '女', birthYear: 1992, org: '数据技术中心-数据分析组', role: '数据分析专家', hireDate: '2017-07-19', email: 'yangli@example.com', mobile: '13800000016' },
  { slug: 'huang-ming', name: '黄明', gender: '男', birthYear: 1994, org: '数据技术中心-数据分析组', role: '高级数据分析师', hireDate: '2019-11-23', email: 'huangming@example.com', mobile: '13800000017' },
  { slug: 'xu-ting', name: '徐婷', gender: '女', birthYear: 1996, org: '数据技术中心-数据分析组', role: '数据分析师', hireDate: '2021-09-05', email: 'xuting@example.com', mobile: '13800000018' },
  { slug: 'gao-feng', name: '高峰', gender: '男', birthYear: 1991, org: '数据技术中心-数据工程组', role: '数据工程专家', hireDate: '2016-08-14', email: 'gaofeng@example.com', mobile: '13800000019' },
  { slug: 'lin-xiao-de', name: '林晓（数据）', gender: '女', birthYear: 1995, org: '数据技术中心-数据工程组', role: '高级数据工程师', hireDate: '2020-02-28', email: 'linxiao-de@example.com', mobile: '13800000020' },
  { slug: 'he-jun', name: '何军', gender: '男', birthYear: 1997, org: '数据技术中心-数据工程组', role: '数据工程师', hireDate: '2022-10-17', email: 'hejun@example.com', mobile: '13800000021' },
  { slug: 'luo-yan', name: '罗燕', gender: '女', birthYear: 1993, org: '数据技术中心-数据治理组', role: '数据治理专家', hireDate: '2018-05-09', email: 'luoyan@example.com', mobile: '13800000022' },
  { slug: 'song-wei', name: '宋伟', gender: '男', birthYear: 1996, org: '数据技术中心-数据治理组', role: '数据治理工程师', hireDate: '2021-04-26', email: 'songwei@example.com', mobile: '13800000023' },

  // ===== 业务与管理部（7 人）已于 2026-10-20 移除 =====
  // 销售 / 产品 / 项目管理 / 客户成功不在 MVP 的三条技术序列内，
  // 保留会让职称判定、跨路径专家复核出现无法归属的员工，故整段删除。
  // 原 7 人：tang-li 唐丽、feng-gang 冯刚、cao-jing 曹静、
  //          xie-min 谢敏、deng-chao 邓超、han-xue 韩雪、kong-ming 孔明
];

// ============================================================
// 2. 组织关系定义
// ============================================================

const ORG_RELATIONS = [
  // ===== 研发技术中心 =====
  // Java 组：李娜(技术专家) 是组长，张伟/王芳 是组员
  { employee: 'zhang-wei', relationType: 'manager', target: 'li-na', domain: null },
  { employee: 'wang-fang', relationType: 'manager', target: 'li-na', domain: null },

  // 前端组：陈静(技术专家) 是组长，刘洋/赵磊 是组员
  { employee: 'liu-yang', relationType: 'manager', target: 'chen-jing', domain: null },
  { employee: 'zhao-lei', relationType: 'manager', target: 'chen-jing', domain: null },

  // Python 组：孙强(技术专家) 是组长，周敏/吴涛 是组员
  { employee: 'zhou-min', relationType: 'manager', target: 'sun-qiang', domain: null },
  { employee: 'wu-tao', relationType: 'manager', target: 'sun-qiang', domain: null },

  // 测试组：郑华(测试专家) 是组长，王军/李雪 是组员
  { employee: 'wang-jun', relationType: 'manager', target: 'zheng-hua', domain: null },
  { employee: 'li-xue', relationType: 'manager', target: 'zheng-hua', domain: null },

  // 运维组：张鹏(运维专家) 是组长，刘伟/陈浩 是组员
  { employee: 'liu-wei', relationType: 'manager', target: 'zhang-peng', domain: null },
  { employee: 'chen-hao', relationType: 'manager', target: 'zhang-peng', domain: null },

  // ===== 数据技术中心 =====
  // 数据分析组：杨丽(数据分析专家) 是组长，黄明/徐婷 是组员
  { employee: 'huang-ming', relationType: 'manager', target: 'yang-li', domain: null },
  { employee: 'xu-ting', relationType: 'manager', target: 'yang-li', domain: null },

  // 数据工程组：高峰(数据工程专家) 是组长，林晓（数据）/何军 是组员
  { employee: 'lin-xiao-de', relationType: 'manager', target: 'gao-feng', domain: null },
  { employee: 'he-jun', relationType: 'manager', target: 'gao-feng', domain: null },

  // 数据治理组：罗燕(数据治理专家) 是组长，宋伟 是组员
  { employee: 'song-wei', relationType: 'manager', target: 'luo-yan', domain: null },

  // ===== 业务与管理部（已移除）=====
  // 销售组（唐丽/冯刚/曹静）、产品组（谢敏/邓超）、项目管理组（韩雪）、
  // 客户成功组（孔明）不在 MVP 三条技术序列内，员工与关系一并删除。

  // ===== 领域专家关系 =====
  // Java 领域专家：李娜
  { employee: 'zhang-wei', relationType: 'expert', target: 'li-na', domain: 'java' },
  { employee: 'wang-fang', relationType: 'expert', target: 'li-na', domain: 'java' },

  // 前端领域专家：陈静
  { employee: 'liu-yang', relationType: 'expert', target: 'chen-jing', domain: 'frontend' },
  { employee: 'zhao-lei', relationType: 'expert', target: 'chen-jing', domain: 'frontend' },

  // Python 领域专家：孙强
  { employee: 'zhou-min', relationType: 'expert', target: 'sun-qiang', domain: 'python' },
  { employee: 'wu-tao', relationType: 'expert', target: 'sun-qiang', domain: 'python' },

  // 测试领域专家：郑华
  { employee: 'wang-jun', relationType: 'expert', target: 'zheng-hua', domain: 'testing' },
  { employee: 'li-xue', relationType: 'expert', target: 'zheng-hua', domain: 'testing' },

  // 运维领域专家：张鹏
  { employee: 'liu-wei', relationType: 'expert', target: 'zhang-peng', domain: 'devops' },
  { employee: 'chen-hao', relationType: 'expert', target: 'zhang-peng', domain: 'devops' },

  // 数据分析领域专家：杨丽
  { employee: 'huang-ming', relationType: 'expert', target: 'yang-li', domain: 'data-analysis' },
  { employee: 'xu-ting', relationType: 'expert', target: 'yang-li', domain: 'data-analysis' },

  // 数据工程领域专家：高峰
  { employee: 'lin-xiao-de', relationType: 'expert', target: 'gao-feng', domain: 'data-engineering' },
  { employee: 'he-jun', relationType: 'expert', target: 'gao-feng', domain: 'data-engineering' },

  // 数据治理领域专家：罗燕
  { employee: 'song-wei', relationType: 'expert', target: 'luo-yan', domain: 'data-governance' },

  // 销售 / 产品领域的专家关系随业务与管理部一并移除
];

// ============================================================
// 3. 账号密码定义（统一密码：SkillTree@2026）
// ============================================================

const DEFAULT_PASSWORD = 'SkillTree@2026';

function hashPassword(password) {
  const salt = 'skilltree-salt-2026'; // 固定 salt，仅用于演示
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

const ACCOUNTS = EMPLOYEES.map(emp => ({
  username: emp.slug,
  password: DEFAULT_PASSWORD,
  passwordHash: hashPassword(DEFAULT_PASSWORD),
  employeeSlug: emp.slug,
  accessRole: emp.role.includes('专家') || emp.role.includes('总监') ? 'manager' : 'employee',
}));

// ============================================================
// 4. 初始技能等级（用于测试认证流程）
// ============================================================

const INITIAL_SKILLS = [
  // 张伟（Java 高级工程师）：已有 Java L2
  { employee: 'zhang-wei', skill: 'skill-java', level: 2, certifiedAt: '2025-06-15' },

  // 李娜（Java 技术专家）：已有 Java L4
  { employee: 'li-na', skill: 'skill-java', level: 4, certifiedAt: '2024-03-20' },

  // 刘洋（前端高级工程师）：已有前端 L2
  { employee: 'liu-yang', skill: 'skill-frontend', level: 2, certifiedAt: '2025-08-10' },

  // 陈静（前端技术专家）：已有前端 L4
  { employee: 'chen-jing', skill: 'skill-frontend', level: 4, certifiedAt: '2024-01-15' },

  // 孙强（Python 技术专家）：已有 Python L4
  { employee: 'sun-qiang', skill: 'skill-python', level: 4, certifiedAt: '2024-05-08' },

  // 杨丽（数据分析专家）：已有数据分析 L4
  { employee: 'yang-li', skill: 'skill-data-analysis', level: 4, certifiedAt: '2024-02-14' },

  // 高峰（数据工程专家）：已有数据工程 L4
  { employee: 'gao-feng', skill: 'skill-data-engineering', level: 4, certifiedAt: '2024-04-22' },
];

// ============================================================
// 5. 生成 SQL 语句
// ============================================================

function generateSQL() {
  const statements = [];

  // 开始事务
  statements.push('BEGIN;');
  statements.push('');

  // 清空现有数据（仅用于演示环境）
  // 注意：保留旧的 4 名演示员工（zhang-san/zhou-chen/lin-xiao/chen-ran 等），
  // 因为 employee_project/performance_record/employee_skill 等旧表仍引用他们，
  // facts.service.ts 启动时会同步这些旧数据。
  statements.push('-- 清空现有数据（仅用于演示环境）');
  statements.push('-- 保留旧演示员工（zhang-san/zhou-chen/lin-xiao/chen-ran 等），');
  statements.push('-- 因为 employee_project/performance_record/employee_skill 等旧表仍引用他们');
  statements.push('');

  // 新员工 slug 列表
  const newEmployeeSlugs = EMPLOYEES.map(e => `'${e.slug}'`).join(',');

  statements.push('-- 删除新员工的关联数据（按外键依赖顺序）');
  statements.push(`DELETE FROM mvp_fact_change WHERE employee_id IN (SELECT id FROM employee WHERE slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM mvp_fact WHERE employee_id IN (SELECT id FROM employee WHERE slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM mvp_fact_employee WHERE employee_id IN (SELECT id FROM employee WHERE slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM mvp_org_relation WHERE employee_slug IN (${newEmployeeSlugs}) OR target_slug IN (${newEmployeeSlugs});`);
  statements.push(`DELETE FROM mvp_employee_skill WHERE employee_slug IN (${newEmployeeSlugs});`);
  statements.push(`DELETE FROM app_session WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM app_external_identity WHERE account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM app_oauth_flow WHERE link_account_id IN (SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE e.slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM app_account WHERE employee_id IN (SELECT id FROM employee WHERE slug IN (${newEmployeeSlugs}));`);
  statements.push(`DELETE FROM employee WHERE slug IN (${newEmployeeSlugs});`);
  statements.push('');

  // 插入员工
  statements.push(`-- 插入 ${EMPLOYEES.length} 名员工`);
  for (const emp of EMPLOYEES) {
    const id = randomUUID();
    statements.push(`INSERT INTO employee(id, slug, name, avatar_text, avatar_tone, role, org, status, hire_date, birth_year, gender, education, is_current_user, _created_at, _updated_at)
VALUES ('${id}', '${emp.slug}', '${emp.name}', '${emp.name[0]}', 'blue', '${emp.role}', '${emp.org}', 'active', '${emp.hireDate}', ${emp.birthYear}, '${emp.gender}', '本科', false, now(), now());`);
  }
  statements.push('');

  // 插入账号
  statements.push('-- 插入账号（统一密码：SkillTree@2026）');
  for (const acc of ACCOUNTS) {
    statements.push(`INSERT INTO app_account(employee_id, username, password_hash, access_role, enabled, created_at)
SELECT id, '${acc.username}', '${acc.passwordHash}', '${acc.accessRole}', true, now()
FROM employee WHERE slug = '${acc.employeeSlug}';`);
  }
  statements.push('');

  // 插入员工事实
  statements.push('-- 插入员工事实');
  for (const emp of EMPLOYEES) {
    const basicInfo = JSON.stringify({
      name: emp.name,
      slug: emp.slug,
      org: emp.org,
      role: emp.role,
      hireDate: emp.hireDate,
      email: emp.email,
      mobile: emp.mobile,
    });
    statements.push(`INSERT INTO mvp_fact_employee(employee_id, basic_info, registered_at, updated_at)
SELECT id, '${basicInfo}'::jsonb, now(), now()
FROM employee WHERE slug = '${emp.slug}';`);
  }
  statements.push('');

  // 插入组织关系
  statements.push('-- 插入组织关系（组长、主管、领域专家）');
  for (const rel of ORG_RELATIONS) {
    const id = randomUUID();
    const slug = `${rel.employee}-${rel.relationType}-${rel.target}`;
    statements.push(`INSERT INTO mvp_org_relation(id, slug, employee_slug, relation_type, target_slug, domain, effective_from, effective_to, source, created_at, updated_at)
VALUES ('${id}', '${slug}', '${rel.employee}', '${rel.relationType}', '${rel.target}', ${rel.domain ? `'${rel.domain}'` : 'NULL'}, '2026-01-01'::timestamptz, NULL, 'seed', now(), now());`);
  }
  statements.push('');

  // 插入初始技能
  statements.push('-- 插入初始技能等级（用于测试认证流程）');
  for (const skill of INITIAL_SKILLS) {
    const id = randomUUID();
    const slug = `${skill.employee}-${skill.skill}-l${skill.level}`;
    statements.push(`INSERT INTO mvp_employee_skill(id, slug, employee_slug, skill_slug, level, certified_at, source_application_slug, status, last_used_at, review_due_at, created_at, updated_at)
VALUES ('${id}', '${slug}', '${skill.employee}', '${skill.skill}', ${skill.level}, '${skill.certifiedAt}'::timestamptz, 'initial-seed', 'active', now(), NULL, now(), now());`);
  }
  statements.push('');

  // 提交事务
  statements.push('COMMIT;');

  return statements.join('\n');
}

// ============================================================
// 6. 输出
// ============================================================

const sql = generateSQL();

console.log('-- ============================================');
console.log('-- 企业级员工关系种子数据');
console.log('-- 生成时间：' + new Date().toISOString());
console.log('-- 员工数量：' + EMPLOYEES.length);
console.log('-- 组织关系：' + ORG_RELATIONS.length);
console.log('-- 初始技能：' + INITIAL_SKILLS.length);
console.log('-- 统一密码：' + DEFAULT_PASSWORD);
console.log('-- ============================================');
console.log('');
console.log(sql);
console.log('');
console.log('-- ============================================');
console.log('-- 数据摘要');
console.log('-- ============================================');
console.log('');
console.log('-- 部门分布：');
const deptCount = {};
EMPLOYEES.forEach(emp => {
  const dept = emp.org.split('-')[0];
  deptCount[dept] = (deptCount[dept] || 0) + 1;
});
Object.entries(deptCount).forEach(([dept, count]) => {
  console.log(`--   ${dept}: ${count} 人`);
});
console.log('');
console.log('-- 角色分布：');
const roleCount = {};
EMPLOYEES.forEach(emp => {
  const role = emp.role.includes('专家') ? '专家' : emp.role.includes('总监') ? '总监' : emp.role.includes('高级') ? '高级工程师' : '工程师';
  roleCount[role] = (roleCount[role] || 0) + 1;
});
Object.entries(roleCount).forEach(([role, count]) => {
  console.log(`--   ${role}: ${count} 人`);
});
console.log('');
console.log('-- 领域专家：');
const experts = EMPLOYEES.filter(emp => emp.role.includes('专家') || emp.role.includes('总监'));
experts.forEach(exp => {
  const domain = ORG_RELATIONS.find(rel => rel.target === exp.slug && rel.relationType === 'expert')?.domain || 'N/A';
  console.log(`--   ${exp.name} (${exp.role}): ${domain}`);
});
console.log('');
console.log('-- 测试账号示例：');
console.log('--   张伟（Java 高级工程师）: zhang-wei / SkillTree@2026');
console.log('--   李娜（Java 技术专家）: li-na / SkillTree@2026');
console.log('--   刘洋（前端高级工程师）: liu-yang / SkillTree@2026');
console.log('--   陈静（前端技术专家）: chen-jing / SkillTree@2026');
