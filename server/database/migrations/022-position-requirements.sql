BEGIN;
ALTER TABLE mvp_title_requirement ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true;
ALTER TABLE mvp_title_requirement ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_job_grade_valid;
ALTER TABLE employee ADD CONSTRAINT employee_job_grade_valid CHECK(job_grade IS NULL OR job_grade ~ '^[TPMF][1-4]$');
-- 保留关联ID和历史标准版本，仅校正当前有效版本的主路径编码。
UPDATE mvp_title_level l SET level_code=t.job_family||l.level_order,
  name=CASE WHEN l.name=t.name||' T'||l.level_order THEN t.name||' '||t.job_family||l.level_order ELSE l.name END
FROM mvp_title_track t
WHERE l.track_slug=t.slug AND COALESCE(l.path_label,'')=''
  AND l.standard_version_slug=(SELECT slug FROM mvp_standard_version WHERE status='published'
    ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1)
  AND l.level_code<>t.job_family||l.level_order;
UPDATE employee e SET job_grade=t.job_family||substring(e.job_grade from 2)
FROM mvp_title_track t WHERE e.preferred_track=t.slug AND e.job_grade~'^[TPMF][1-4]$'
  AND left(e.job_grade,1)<>t.job_family;
UPDATE mvp_employee_wide w SET job_grade=e.job_grade FROM employee e WHERE w.employee_slug=e.slug AND w.job_grade IS DISTINCT FROM e.job_grade;
COMMIT;
