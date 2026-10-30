-- 职称序列的「发展管道」分组。
-- IDP 制定目标时改为 管道 → 序列 → 职级 三级收敛，而不是把全部序列 × 全部职级
-- 平铺成一个下拉框（4 序列 × 4 职级 = 16 项，且随序列增加线性膨胀）。
-- tech：软件开发序列 / 平台工程序列 / 数据与 AI 序列；
-- management：人力资源管理通道（当前唯一的管理类序列，该分支跳过「序列」这一级）。
-- 后续新增序列默认归入 tech，需要跨管道时用 UPDATE 调整即可，前端层级无需改动。

ALTER TABLE mvp_title_track ADD COLUMN IF NOT EXISTS pipeline text;

UPDATE mvp_title_track SET pipeline = 'management' WHERE slug = 'hr';
UPDATE mvp_title_track SET pipeline = 'tech' WHERE pipeline IS NULL;

ALTER TABLE mvp_title_track ALTER COLUMN pipeline SET DEFAULT 'tech';
ALTER TABLE mvp_title_track ALTER COLUMN pipeline SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mvp_title_track_pipeline_check') THEN
    ALTER TABLE mvp_title_track
      ADD CONSTRAINT mvp_title_track_pipeline_check CHECK (pipeline IN ('tech', 'management'));
  END IF;
END $$;

COMMENT ON COLUMN mvp_title_track.pipeline IS '发展管道：tech 技术管道 / management 管理管道，目标选择的第一级';
