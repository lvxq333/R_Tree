-- ============================================================
-- 010 历史等级迁移支持
--
-- 目的：让旧表 employee_skill 的等级能映射进 mvp_employee_skill /
--       mvp_employee_competency，同时不伪造申请单。
--
-- 三件事：
-- 1. 允许 source_application_slug 为空（历史迁移没有申请单），并新增 source 列
--    区分 application / migrated / initial-seed；
-- 2. certified_via 增加 migrated 取值（旧认证不是走 AI 材料或考核产生的）；
-- 3. 修正种子写入的臆造技能 slug：skill 表里根本没有 skill-java / skill-frontend /
--    skill-python / skill-data-analysis / skill-data-engineering 这几个值，
--    之前没报错是因为 mvp_employee_skill.skill_slug 没有外键。
--
-- 幂等，可重复执行。
-- ============================================================

BEGIN;

-- ---------- 1. 允许无申请单 ----------
ALTER TABLE mvp_employee_skill ALTER COLUMN source_application_slug DROP NOT NULL;
ALTER TABLE mvp_employee_competency ALTER COLUMN source_application_slug DROP NOT NULL;

ALTER TABLE mvp_employee_skill ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'application';
ALTER TABLE mvp_employee_competency ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'application';

-- ---------- 2. source 取值约束 ----------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'mvp_employee_skill'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE mvp_employee_skill DROP CONSTRAINT %I', c.conname);
  END LOOP;
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'mvp_employee_competency'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE mvp_employee_competency DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE mvp_employee_skill
  ADD CONSTRAINT mvp_employee_skill_source_check
  CHECK (source IN ('application', 'migrated', 'initial-seed'));

ALTER TABLE mvp_employee_competency
  ADD CONSTRAINT mvp_employee_competency_source_check
  CHECK (source IN ('application', 'migrated', 'initial-seed'));

-- ---------- 3. certified_via 增加 migrated ----------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'mvp_employee_competency'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%certified_via%'
  LOOP
    EXECUTE format('ALTER TABLE mvp_employee_competency DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE mvp_employee_competency
  ADD CONSTRAINT mvp_employee_competency_certified_via_check
  CHECK (certified_via IN ('ai-material', 'exam', 'approval-l3', 'approval-l4', 'approval-l5', 'migrated'));

-- ---------- 4. 修正臆造的技能 slug ----------
UPDATE mvp_employee_skill SET skill_slug = 'java-go-eng', updated_at = now()
 WHERE skill_slug = 'skill-java';

UPDATE mvp_employee_skill SET skill_slug = 'data-analysis', updated_at = now()
 WHERE skill_slug = 'skill-data-analysis';

UPDATE mvp_employee_skill SET skill_slug = 'data-processing', updated_at = now()
 WHERE skill_slug = 'skill-data-engineering';

-- 前端与 Python 在现有 81 项技能里没有对应项，不臆造映射，直接移除；
-- 旧表 employee_skill 的历史记录保持不动。
-- 加 NOT EXISTS 保护：将来如果 skill 表真的补了同名技能，不会误删。
DELETE FROM mvp_employee_skill s
 WHERE s.skill_slug IN ('skill-frontend', 'skill-python')
   AND NOT EXISTS (SELECT 1 FROM skill k WHERE k.slug = s.skill_slug);

-- 种子写入的认证标为 initial-seed，与后续 migrated 区分
UPDATE mvp_employee_skill
   SET source = 'initial-seed'
 WHERE source = 'application' AND source_application_slug = 'initial-seed';

-- ---------- 5. 校验：不允许引用不存在的技能 ----------
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad
    FROM mvp_employee_skill s
    LEFT JOIN skill k ON k.slug = s.skill_slug
   WHERE k.slug IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION '010 校验失败：mvp_employee_skill 仍有 % 行引用不存在的技能', bad;
  END IF;

  SELECT count(*) INTO bad
    FROM mvp_employee_competency c
    LEFT JOIN mvp_competency m ON m.slug = c.competency_slug
   WHERE m.slug IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION '010 校验失败：mvp_employee_competency 有 % 行引用不存在的子能力', bad;
  END IF;

  RAISE NOTICE '010: 校验通过，认证表的技能与子能力引用均有效';
END $$;

COMMIT;
