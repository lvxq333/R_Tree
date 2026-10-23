BEGIN;

-- Existing self applications used a title without a catalog key. Only exact,
-- unique catalog names are safe to link.
UPDATE employee_skill e
   SET skill_slug = s.slug
  FROM skill s
 WHERE e.skill_slug IS NULL AND e.title = s.name
   AND (SELECT count(*) FROM skill matches WHERE matches.name = e.title) = 1;

-- Carry already approved legacy applications into the effective skill ledger.
-- Do not infer any sub-competency certification from a skill approval.
INSERT INTO mvp_employee_skill
  (slug, employee_slug, skill_slug, level, certified_at,
   source_application_slug, status, source)
SELECT 'legacy-approved-' || md5(e.slug), e.employee_slug, e.skill_slug,
       e.current_level,
       CASE WHEN e.approved_at ~ '^\d{4}-\d{2}-\d{2}$'
         THEN (e.approved_at::date::timestamp AT TIME ZONE 'Asia/Shanghai')
         ELSE e._updated_at END,
       NULL, 'active', 'migrated'
  FROM employee_skill e
 WHERE e.status = 'approved' AND e.skill_slug IS NOT NULL
   AND e.current_level BETWEEN 1 AND 5
ON CONFLICT (employee_slug, skill_slug, level) DO NOTHING;

COMMIT;
