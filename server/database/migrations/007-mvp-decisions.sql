-- ============================================================
-- 007 · MVP 决策落地（M0）
-- 依据：docs/mvp-dev-plan.md 决策 D1 / D6 / D11 与 0.3 实现红线
-- 幂等：可重复执行
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- D1 职称层级：种子统一 4 层，结构允许 1~6（后期改可变层数无需迁移）
-- ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'mvp_title_level'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%level_order%'
  LOOP
    EXECUTE format('ALTER TABLE mvp_title_level DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE mvp_title_level
    ADD CONSTRAINT mvp_title_level_level_order_check
    CHECK (level_order BETWEEN 1 AND 6);
END $$;

COMMENT ON COLUMN mvp_title_level.level_order IS '职称层级序号：种子统一 1-4 层；结构允许 1-6，后期改可变层数无需迁移';

-- ------------------------------------------------------------
-- D6 / 申诉：区分 AI 重判、主管判定、专家复核，并保留 AI 重判依据
-- ------------------------------------------------------------
ALTER TABLE mvp_appeal ADD COLUMN IF NOT EXISTS decided_kind varchar(16);
ALTER TABLE mvp_appeal ADD COLUMN IF NOT EXISTS ai_rejudge jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mvp_appeal_decided_kind_check') THEN
    ALTER TABLE mvp_appeal
      ADD CONSTRAINT mvp_appeal_decided_kind_check
      CHECK (decided_kind IS NULL OR decided_kind IN ('ai', 'manager', 'expert'));
  END IF;
END $$;

COMMENT ON COLUMN mvp_appeal.decided_kind IS '判定主体：ai=AI 重判（L1/L2 材料申诉首次）、manager=直属主管（第二次）、expert=未参与原驳回的领域专家（L3-L5 或考题异议）';
COMMENT ON COLUMN mvp_appeal.ai_rejudge IS 'AI 重判结果：{verdict,reasoning,gaps,model,promptVersion,rulesVersion,evaluatedAt}';

-- ------------------------------------------------------------
-- D11 标准版本三级发布：专家编写 → 负责人审核 → 管理员发布
-- ------------------------------------------------------------
ALTER TABLE mvp_standard_version ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'refined';
ALTER TABLE mvp_standard_version ADD COLUMN IF NOT EXISTS published_by_employee_slug varchar(64);
ALTER TABLE mvp_standard_version ADD COLUMN IF NOT EXISTS published_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mvp_standard_version_source_check') THEN
    ALTER TABLE mvp_standard_version
      ADD CONSTRAINT mvp_standard_version_source_check
      CHECK (source IN ('refined', 'ai-draft', 'assumed'));
  END IF;
END $$;

COMMENT ON COLUMN mvp_standard_version.source IS '标准来源：refined=人工精编、ai-draft=AI 草稿、assumed=MVP 假定标准';
COMMENT ON COLUMN mvp_standard_version.reviewed_by_employee_slug IS '领域负责人审核人（三级流程第二步）';
COMMENT ON COLUMN mvp_standard_version.published_by_employee_slug IS '发布人（三级流程最后一步，管理员）';
COMMENT ON COLUMN mvp_standard_version.published_at IS '发布时间；发布时写入 snapshot 全量快照';

COMMIT;
