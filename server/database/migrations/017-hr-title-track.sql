-- HR 的职称发展序列：把 016 中的 hr 职业通道（career_node H1/H2/M1/M2）
-- 纳入 mvp_title_track / mvp_title_level / mvp_title_requirement 标准体系，
-- 使 HR 用户在 IDP、资格视图等处可以选择人力资源序列的目标职称。
-- level_code 沿用 T1–T4（与现有 t[1-6] 规则校验兼容），名称对应 H1/H2/M1/M2。

INSERT INTO mvp_title_track(slug, name, category, path_kind, status)
VALUES ('hr', '人力资源管理通道', '人力资源', 'single', 'published')
ON CONFLICT(slug) DO UPDATE
SET name = EXCLUDED.name, category = EXCLUDED.category,
    path_kind = EXCLUDED.path_kind, status = 'published', updated_at = now();

INSERT INTO mvp_title_level(track_slug, level_order, level_code, name, path_label, standard_version_slug)
SELECT v.track_slug, v.level_order, v.level_code, v.name, '',
       COALESCE((SELECT slug FROM mvp_standard_version
                 WHERE status = 'published' AND effective_at <= now()
                 ORDER BY effective_at DESC LIMIT 1), 'v2026-q4')
FROM (VALUES
  ('hr', 1, 'T1', '人力资源专员'),
  ('hr', 2, 'T2', '资深人力资源专员'),
  ('hr', 3, 'T3', '人力资源经理'),
  ('hr', 4, 'T4', '人力资源总监')
) AS v(track_slug, level_order, level_code, name)
ON CONFLICT(track_slug, level_order, path_label, standard_version_slug) DO UPDATE
SET level_code = EXCLUDED.level_code, name = EXCLUDED.name, updated_at = now();

-- 能力要求直接来自 016 维护的 hr 职业通道技能要求（career_node_skill）。
INSERT INTO mvp_title_requirement(title_level_id, skill_slug, required_level, is_auto)
SELECT tl.id, ns.skill_slug, ns.required_level, false
FROM mvp_title_level tl
JOIN (VALUES ('T1', 'H1'), ('T2', 'H2'), ('T3', 'M1'), ('T4', 'M2')) AS m(level_code, node_code)
  ON m.level_code = tl.level_code
JOIN career_node n ON n.sequence_slug = 'hr' AND n.code = m.node_code
JOIN career_node_skill ns ON ns.node_slug = n.slug
WHERE tl.track_slug = 'hr'
ON CONFLICT DO NOTHING;
