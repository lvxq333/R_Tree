-- 审批催办：员工对超期未处理的申请发起催办，写入真实记录供审批人侧展示并留痕。
-- 限流与上限由服务端业务规则控制（24 小时内一次、单张审批单最多 3 次），不在数据库层约束。

CREATE TABLE IF NOT EXISTS approval_reminder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(96) NOT NULL UNIQUE,
  approval_slug varchar(64) NOT NULL,
  requester_slug varchar(64),
  requester_name varchar(64),
  department varchar(128),
  -- 催办送达对象：审批工作台可见该审批单的角色（当前为 hr / expert）
  target_scope varchar(32) NOT NULL DEFAULT 'approver',
  note text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS approval_reminder_approval_idx
  ON approval_reminder (approval_slug, _created_at DESC);

CREATE INDEX IF NOT EXISTS approval_reminder_requester_idx
  ON approval_reminder (requester_slug, _created_at DESC);
