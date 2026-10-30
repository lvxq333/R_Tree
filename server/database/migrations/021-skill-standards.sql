BEGIN;
CREATE TABLE IF NOT EXISTS mvp_position_skill_standard (
  skill_slug varchar(64) NOT NULL REFERENCES skill(slug),
  standard_version_slug varchar(64) NOT NULL,
  description text NOT NULL DEFAULT '',
  levels jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(levels)='array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(skill_slug,standard_version_slug)
);
-- 岗位新增技能必须进入员工可选择的技能目录。
INSERT INTO skill_category(slug,name,kind,sort) VALUES('position-skills','岗位能力','professional',90) ON CONFLICT(slug) DO NOTHING;
INSERT INTO skill_category(slug,name,kind,parent_slug,sort) VALUES('position-custom-skills','岗位自定义技能','professional','position-skills',91) ON CONFLICT(slug) DO NOTHING;
UPDATE skill SET category_slug='position-custom-skills' WHERE category_slug IS NULL AND slug LIKE 'position-skill-%';
COMMIT;
