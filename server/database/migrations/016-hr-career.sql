-- HR 的专业技能与独立管理发展路径；仅补标准，不改员工认证结论。
INSERT INTO skill_category(slug,name,kind,parent_slug,sort) VALUES ('hr-practice','人力资源实务','professional','professional',8)
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,parent_slug=EXCLUDED.parent_slug;

INSERT INTO skill(slug,name,category_slug) VALUES
('hr-recruiting','招聘与人才配置','hr-practice'),
('hr-employee-relations','员工关系管理','hr-practice'),
('hr-talent-development','培训与人才发展','hr-practice'),
('hr-performance','绩效管理','hr-practice'),
('hr-org-development','组织发展','hr-practice'),
('hr-people-analytics','人力资源数据分析','hr-practice'),
('hr-compliance','劳动法规与合规','hr-practice'),
('hr-workforce-planning','人力规划','hr-practice')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,category_slug=EXCLUDED.category_slug;

INSERT INTO career_sequence(slug,label,description,channel) VALUES
('hr','人力资源管理通道','按人力资源岗位能力与有效技能认证规划发展','management')
ON CONFLICT(slug) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,channel=EXCLUDED.channel;

INSERT INTO career_node(slug,sequence_slug,code,title,sort) VALUES
('hr-h1','hr','H1','人力资源专员',1),
('hr-h2','hr','H2','资深人力资源专员',2),
('hr-m1','hr','M1','人力资源经理',3),
('hr-m2','hr','M2','人力资源总监',4)
ON CONFLICT(slug) DO UPDATE SET sequence_slug=EXCLUDED.sequence_slug,code=EXCLUDED.code,title=EXCLUDED.title,sort=EXCLUDED.sort;

INSERT INTO career_node_skill(node_slug,skill_slug,required_level,sort)
SELECT v.node_slug,v.skill_slug,v.required_level,v.sort FROM (VALUES
('hr-h1','proactive-comm',2,1),('hr-h1','hr-employee-relations',2,2),('hr-h1','hr-talent-development',2,3),('hr-h1','hr-compliance',2,4),
('hr-h2','hr-recruiting',3,1),('hr-h2','hr-performance',3,2),('hr-h2','hr-people-analytics',3,3),('hr-h2','org-communication',3,4),
('hr-m1','talent-dev',3,1),('hr-m1','perf-mgmt',3,2),('hr-m1','hr-org-development',3,3),('hr-m1','hr-workforce-planning',3,4),
('hr-m2','business-planning',4,1),('hr-m2','org-design',4,2),('hr-m2','pipeline-building',4,3),('hr-m2','resource-allocation',4,4)
) AS v(node_slug,skill_slug,required_level,sort)
WHERE NOT EXISTS (SELECT 1 FROM career_node_skill s WHERE s.node_slug=v.node_slug AND s.skill_slug=v.skill_slug);

UPDATE career_node SET title='管理基础能力' WHERE slug='junior-m' AND title='初级软件开发工程师';
