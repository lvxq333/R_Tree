/** 验证样本只允许存在于专用 schema，禁止回落到 public。 */
export function validationEnabled(): boolean {
  if (process.env.SKILLTREE_VALIDATION !== 'true') return false;
  const schema = new URL(process.env.DATABASE_URL || '').searchParams.get('search_path');
  if (!schema || !/^skilltree_validation_[a-z0-9_]+$/.test(schema)) throw new Error('隔离验证必须使用专用 schema，且不能包含 public 回退');
  return true;
}
