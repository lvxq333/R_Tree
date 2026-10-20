-- ============================================================
-- 011 清理指向不存在员工的孤儿数据
--
-- 背景：009 只精确删除了 7 名非技术序列的演示员工，但更早期的旧库演示员工
--       （zhang-san / zhou-chen / chen-ran 等）只从 employee 表移除，
--       employee_project / performance_record / employee_skill 等表里的行没有一并清理。
--       FactsService 启动时会把这些行映射成事实，映射不到员工就抛错，
--       导致服务直接启动失败（表现为启动日志「事实源存在无法映射的员工标识」）。
--
-- 做法：动态遍历所有含 employee_id / employee_slug 列的表，
--       删除这些列指向的员工已不存在的行。
--       所有 employee 关联列的语义都是「员工引用」，孤儿行没有任何归属方，
--       保留只会在事实同步、统计、审批查询里反复报错。
--
-- 幂等：重复执行为 0 行删除。
-- 安全：只删「引用已失效」的行，不触碰任何指向现存员工的数据。
-- ============================================================

BEGIN;

DO $$
DECLARE
  r record;
  removed bigint;
  total bigint := 0;
BEGIN
  FOR r IN
    SELECT table_name AS tbl, column_name AS col
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('employee_id', 'employee_slug')
     ORDER BY table_name
  LOOP
    IF r.col = 'employee_id' THEN
      EXECUTE format(
        'DELETE FROM %I x WHERE x.employee_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.id = x.employee_id)', r.tbl);
    ELSE
      EXECUTE format(
        'DELETE FROM %I x WHERE x.employee_slug IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.slug = x.employee_slug)', r.tbl);
    END IF;

    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed > 0 THEN
      RAISE NOTICE '011: % 清理 % 行孤儿数据（列 %）', r.tbl, removed, r.col;
      total := total + removed;
    END IF;
  END LOOP;

  RAISE NOTICE '011: 共清理 % 行孤儿数据', total;
END $$;

-- 校验：任何 employee 关联表都不应再有孤儿行
DO $$
DECLARE
  r record;
  leftover bigint;
  problems text := '';
BEGIN
  FOR r IN
    SELECT table_name AS tbl, column_name AS col
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('employee_id', 'employee_slug')
     ORDER BY table_name
  LOOP
    IF r.col = 'employee_id' THEN
      EXECUTE format(
        'SELECT count(*) FROM %I x WHERE x.employee_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.id = x.employee_id)', r.tbl) INTO leftover;
    ELSE
      EXECUTE format(
        'SELECT count(*) FROM %I x WHERE x.employee_slug IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.slug = x.employee_slug)', r.tbl) INTO leftover;
    END IF;

    IF leftover > 0 THEN
      problems := problems || format('%s.%s=%s; ', r.tbl, r.col, leftover);
    END IF;
  END LOOP;

  IF problems <> '' THEN
    RAISE EXCEPTION '011 校验失败，仍存在孤儿数据：%', problems;
  END IF;

  RAISE NOTICE '011: 校验通过，全库无孤儿员工引用';
END $$;

COMMIT;
