BEGIN;
-- 关键岗位名录：由 HR 手工维护，决定梯队盘点的对象。
-- 以（序列, 职级）为单位记录，不绑定标准版本，标准换版后仍沿用同一名录。
CREATE TABLE IF NOT EXISTS mvp_key_position (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(96) NOT NULL UNIQUE,
  track_slug varchar(64) NOT NULL REFERENCES mvp_title_track(slug) ON DELETE CASCADE,
  level_code varchar(8) NOT NULL,
  criticality varchar(16) NOT NULL DEFAULT 'key',
  reason varchar(255),
  impact varchar(255),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mvp_key_position_criticality_check CHECK (criticality IN ('core','key','normal')),
  CONSTRAINT mvp_key_position_level_valid CHECK (level_code ~ '^[TPMF][1-4]$')
);
CREATE UNIQUE INDEX IF NOT EXISTS mvp_key_position_track_level_key ON mvp_key_position(track_slug, level_code);
CREATE INDEX IF NOT EXISTS idx_mvp_key_position_track ON mvp_key_position(track_slug);
COMMIT;
