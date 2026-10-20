-- 008 三序列口径修正（幂等，可重复执行）
-- 背景：MVP 只做 software / platform / ai 三条技术序列。
-- 原库内三条序列的 T1 都叫「初级软件开发工程师」，页面上无法区分序列，改为按序列命名。
-- platform、ai 的 T1 slug 保持不变（career_node_skill.node_slug 引用它），只改显示名。

BEGIN;

UPDATE career_node
   SET title = '初级平台工程师',
       _updated_at = now()
 WHERE slug = 'junior-platform'
   AND title IS DISTINCT FROM '初级平台工程师';

UPDATE career_node
   SET title = '初级 AI 工程师',
       _updated_at = now()
 WHERE slug = 'junior-ai'
   AND title IS DISTINCT FROM '初级 AI 工程师';

-- 校验：三条序列各 4 层，T1 名称互不相同
DO $$
DECLARE
  dup int;
  missing int;
BEGIN
  SELECT count(*) INTO missing
    FROM (VALUES ('software'), ('platform'), ('ai')) AS s(seq)
   WHERE (SELECT count(*) FROM career_node n WHERE n.sequence_slug = s.seq) <> 4;
  IF missing <> 0 THEN
    RAISE EXCEPTION '三序列中存在层数不等于 4 的序列，共 % 条', missing;
  END IF;

  SELECT count(*) INTO dup
    FROM (SELECT title FROM career_node WHERE code = 'T1' AND sequence_slug IN ('software', 'platform', 'ai')
          GROUP BY title HAVING count(*) > 1) t;
  IF dup <> 0 THEN
    RAISE EXCEPTION 'T1 名称仍有重复，共 % 组', dup;
  END IF;
END $$;

COMMIT;
