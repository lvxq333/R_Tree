-- 025: 项目组页接入真实员工技能数据。
-- 1) 项目状态流转列；2) 角色技能重铺为真实员工持有的技能（带 skillSlug + 等级）；
-- 3) 清理指向不存在员工的演示指派；4) 清理历史硬编码演示自定义角色。
-- 全部语句幂等，可重复执行。

ALTER TABLE team_project ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'draft';

UPDATE team_project SET
  title = '企业级 AI 数据与模型平台专项',
  note = '候选按有效期内的已认证技能计算，投入情况需与本人确认',
  period = '2026.10–2027.01'
WHERE slug = 'embodied-intelligence';

UPDATE team_role SET
  title = '数据平台工程师',
  headcount = 1,
  allocation = '50%',
  skills = '[{"skillSlug":"data-processing","level":3,"type":"required"},{"skillSlug":"data-quality-gov","level":3,"type":"required"},{"skillSlug":"observability-building","level":2,"type":"bonus"},{"skillSlug":"collaboration","level":3,"type":"bonus"}]'::jsonb
WHERE slug = 'perception';

UPDATE team_role SET
  title = '模型工程工程师',
  headcount = 1,
  allocation = '50%',
  skills = '[{"skillSlug":"model-eng","level":3,"type":"required"},{"skillSlug":"model-eval","level":3,"type":"required"},{"skillSlug":"intelligent-sys","level":2,"type":"bonus"},{"skillSlug":"data-processing","level":2,"type":"bonus"}]'::jsonb
WHERE slug = 'control';

UPDATE team_role SET
  title = '平台架构负责人',
  headcount = 1,
  allocation = '80%',
  skills = '[{"skillSlug":"intelligent-sys","level":3,"type":"required"},{"skillSlug":"sys-design-split","level":3,"type":"required"},{"skillSlug":"platform-product","level":2,"type":"required"},{"skillSlug":"collaboration","level":4,"type":"bonus"}]'::jsonb
WHERE slug = 'simulation';

UPDATE team_role SET
  title = '业务协作负责人',
  headcount = 1,
  allocation = '50%',
  skills = '[{"skillSlug":"requirements","level":2,"type":"required"},{"skillSlug":"platform-product","level":3,"type":"required"},{"skillSlug":"collaboration","level":4,"type":"bonus"},{"skillSlug":"data-processing","level":2,"type":"bonus"}]'::jsonb
WHERE slug = 'product';

DELETE FROM team_assignment WHERE candidate_slug NOT IN (SELECT slug FROM employee);
DELETE FROM team_role WHERE slug LIKE 'custom-role-%';

INSERT INTO team_assignment(role_slug, candidate_slug) VALUES ('perception','lin-xiao')
ON CONFLICT (role_slug) DO UPDATE SET candidate_slug = EXCLUDED.candidate_slug;
