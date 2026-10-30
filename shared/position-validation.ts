import type { JobFamily, PositionInput, PositionSkillStandard } from './api.interface';

export const JOB_FAMILIES: { code: JobFamily; name: string; description: string }[] = [
  { code: 'T', name: '技术', description: '工程研发与技术能力' },
  { code: 'P', name: '产品', description: '产品规划与价值交付' },
  { code: 'M', name: '管理', description: '团队建设与组织管理' },
  { code: 'F', name: '行政', description: '组织支持与职能运营' },
];
export interface PositionValidationIssue { message: string; grade?: string; skillIndex?: number; level?: number; field: string }
const filled = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function standardIssues(value: PositionSkillStandard | undefined): { field: string; level?: number; message: string }[] {
  const issues: { field: string; level?: number; message: string }[] = [];
  if (!filled(value?.description, 4000)) issues.push({ field: 'description', message: '技能说明必填，最多4000字' });
  for (let level = 1; level <= 5; level++) {
    const entries = Array.isArray(value?.levels) ? value.levels.filter(item => item?.level === level) : [];
    if (entries.length !== 1) issues.push({ field: 'anchor', level, message: `L${level} 等级标准缺失或重复` });
    else {
      if (!filled(entries[0].anchor, 4000)) issues.push({ field: 'anchor', level, message: `L${level} 达标标准必填，最多4000字` });
      if (!filled(entries[0].evidence, 4000)) issues.push({ field: 'evidence', level, message: `L${level} 证明材料要求必填，最多4000字` });
    }
  }
  if (value && (!Array.isArray(value.levels) || value.levels.length !== 5 || typeof value.revision !== 'string'))
    issues.push({ field: 'description', message: '技能标准必须包含完整的L1–L5及版本信息' });
  return issues;
}

/** 前后端共用；纯空白不算填写，false 是明确有效的选择。 */
export function validatePosition(input: PositionInput): PositionValidationIssue[] {
  const issues: PositionValidationIssue[] = [];
  if (!input || !JOB_FAMILIES.some(f => f.code === input.family)) issues.push({ field: 'family', message: '请选择所属序列' });
  if (!filled(input?.name, 128)) issues.push({ field: 'name', message: '方向名称必填，最多128字' });
  if (!Array.isArray(input?.grades) || input.grades.length !== 4) {
    issues.push({ field: 'grades', message: '必须配置四个职级' }); return issues;
  }
  const codes = new Set<string>();
  const definitions = new Map<string, string>();
  for (const grade of input.grades) {
    if (!grade || !new RegExp(`^${input.family}[1-4]$`).test(grade.code) || codes.has(grade.code)) {
      issues.push({ field: 'grades', message: '职级编码需与所属序列一致且不可重复' }); continue;
    }
    codes.add(grade.code);
    const add = (field: string, message: string, skillIndex?: number, level?: number) =>
      issues.push({ grade: grade.code, skillIndex, level, field, message: `${grade.code} → ${skillIndex === undefined ? '' : `${grade.requirements[skillIndex]?.skillName || `技能${skillIndex + 1}`} → `}${message}` });
    if (!filled(grade.name, 128)) add('gradeName', '职级名称必填，最多128字');
    if (!Array.isArray(grade.requirements) || !grade.requirements.length || grade.requirements.length > 200) {
      add('requirements', '每个职级需配置1–200项技能要求'); continue;
    }
    const skills = new Set<string>();
    grade.requirements.forEach((r, index) => {
      if (!r || !filled(r.skillName, 128)) add('skillName', '技能名称必填，最多128字', index);
      const name = typeof r?.skillName === 'string' ? r.skillName.trim() : '';
      if (name && skills.has(name)) add('skillName', '同职级不可重复配置同一技能', index);
      skills.add(name);
      if (!Number.isInteger(r?.requiredLevel) || r.requiredLevel < 1 || r.requiredLevel > 5) add('requiredLevel', '请选择L1–L5最低技能等级', index);
      if (typeof r?.isRequired !== 'boolean') add('isRequired', '请明确选择是否必需', index);
      for (const issue of standardIssues(r?.standard)) add(issue.field, issue.message, index, issue.level);
      if (r?.standard && name) {
        const signature = JSON.stringify({ description: r.standard.description, levels: r.standard.levels });
        if (definitions.has(name) && definitions.get(name) !== signature) add('description', '同名技能应共用同一套等级标准', index);
        definitions.set(name, signature);
      }
    });
    if (!grade.requirements.some(r => r?.isRequired === true)) add('requirements', '每个职级至少需要一项必需技能');
  }
  return issues;
}
