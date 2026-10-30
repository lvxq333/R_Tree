BEGIN;
ALTER TABLE mvp_title_track ADD COLUMN IF NOT EXISTS job_family varchar(1);
UPDATE mvp_title_track SET job_family=CASE WHEN slug='hr' THEN 'F' ELSE 'T' END WHERE job_family IS NULL;
ALTER TABLE mvp_title_track ALTER COLUMN job_family SET DEFAULT 'T';
ALTER TABLE mvp_title_track ALTER COLUMN job_family SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mvp_title_track_job_family_check') THEN
    ALTER TABLE mvp_title_track ADD CONSTRAINT mvp_title_track_job_family_check CHECK(job_family IN ('T','P','F','M'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS position_active_name ON mvp_title_track(job_family,name) WHERE status<>'archived';
INSERT INTO mvp_title_track(slug,name,category,pipeline,job_family,status) VALUES
 ('embedded-software','嵌入式软件','技术','tech','T','published'),
 ('java-software','Java软件','技术','tech','T','published'),
 ('cpp-engineer','C++开发工程师','技术','tech','T','published'),
 ('data-product','数据产品','产品','tech','P','published'),
 ('app-product-manager','应用产品经理','产品','tech','P','published'),
 ('administration','行政管理','行政','management','F','published'),
 ('team-management','团队管理','管理','management','M','published')
ON CONFLICT(slug) DO NOTHING;
-- 新方向先留空技能要求，由管理者手动设置或导入正式标准，不生成虚构技能标准。
INSERT INTO mvp_title_level(track_slug,level_order,level_code,name,path_label,standard_version_slug)
SELECT t.slug,g.n,'T'||g.n,t.name||' T'||g.n,'',v.slug
FROM mvp_title_track t CROSS JOIN generate_series(1,4) g(n)
CROSS JOIN LATERAL(SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1) v
WHERE t.slug IN ('embedded-software','java-software','cpp-engineer','data-product','app-product-manager','administration','team-management')
ON CONFLICT DO NOTHING;
COMMIT;
