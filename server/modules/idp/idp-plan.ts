import { createHash } from 'node:crypto';
import type { IdpAction, IdpGenerateRequest, IdpResponse, JudgingGapDetail, JudgingOverview, GapPoolItem, JudgingResource } from '@shared/api.interface';

export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const monthAfter = (start: string, months: number) => {
  const [year, month] = start.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const sourceFingerprint = (target: JudgingGapDetail, extras: GapPoolItem[]) => fingerprint({
  track: target.trackSlug, level: target.levelCode, requirements: target.requirements,
  resources: target.gapItems.map(item => item.resources), extras,
});
export function buildIdp(input: IdpGenerateRequest, overview: JudgingOverview, target: JudgingGapDetail,
  extras: GapPoolItem[], position: string, previous?: IdpResponse): IdpResponse {
  const now = new Date().toISOString();
  const gaps = target.gapItems.map(item => ({ key: `career:${item.skillSlug}:L${item.requiredLevel}`, source: '职业目标', skillSlug: item.skillSlug,
    title: item.skillName, priority: item.gapLevels >= 3 ? 'P0' : item.gapLevels >= 2 ? 'P1' : 'P2',
    note: `L${item.currentLevel} → L${item.requiredLevel}`, resources: item.resources,
    competencies: item.competencyNames, gapLevels: item.gapLevels }));
  for (const gap of extras) {
    if (gap.target <= gap.filled || gaps.some(item => item.title === gap.title)) continue;
    gaps.push({ key: `${gap.source}:${gap.title}`, source: gap.sourceLabel, skillSlug: '', title: gap.title,
      priority: gap.priority.toUpperCase(), note: gap.levelRange || `L${gap.filled} → L${gap.target}`,
      resources: [], competencies: gap.competencies.map(item => item.name), gapLevels: gap.gapLevels });
  }
  gaps.sort((a, b) => a.priority.localeCompare(b.priority) || b.gapLevels - a.gapLevels);
  const tasks = gaps.length ? gaps : target.requirements.filter(item => item.met).map(item => ({
    key: `maintain:${item.skillSlug}`, title: item.skillName, priority: '维持', resources: [] as JudgingResource[],
    competencies: [] as string[], source: '已达标能力', skillSlug: item.skillSlug, note: `保持 L${item.currentLevel}`, gapLevels: 0,
  }));
  const bounds = [0, Math.max(1, Math.round(input.months / 8)), Math.round(input.months * 3 / 8), Math.round(input.months * 5 / 8), input.months];
  const titles = [gaps.length ? '夯实当前岗位能力基线' : '盘点已达标能力与使用记录', '重点能力实践与证据沉淀', '扩大技术影响与协作应用', '目标职称准备与能力巩固'];
  const themes = ['优先处理关键短板，安排学习与一次可验证的小型交付。', '围绕目标要求开展实际任务，记录过程、结果与评审反馈。', '用复用、分享和跨团队协作检验能力，补充应用证据。', '核对最新资格与剩余 Gap，完善证据材料后进入正式申请流程。'];
  const phases = titles.map((title, index) => ({ id: `phase-${index + 1}`, title,
    range: `第 ${index + 1} 阶段 · ${bounds[index]}—${bounds[index + 1]} 个月（${monthAfter(input.startMonth, bounds[index])} — ${monthAfter(input.startMonth, bounds[index + 1])}）`,
    theme: themes[index], focusGaps: [] as string[], actions: [] as IdpAction[],
    objective: '', milestone: `${monthAfter(input.startMonth, bounds[index + 1])} · ${title}检查`, outcome: '' }));
  const priorActions = new Map(previous?.phases.flatMap(phase => phase.actions).filter(action => action.id).map(action => [action.id!, action]) ?? []);
  function add(phase: number, gap: (typeof tasks)[number], kind: IdpAction['kind'], title: string, proof: string, resource?: JudgingResource) {
    const id = `${input.track}:${input.level}:${gap.key}:${kind}`;
    const old = priorActions.get(id);
    phases[phase].actions.push({ id, gapKey: gap.key, kind, kindLabel: ({ learn: '学习', practice: '实践', mentor: '导师', deliver: '交付' })[kind],
      title: old && (old.customTitle || old.status === 'done' || old.status === 'in-progress') ? old.title : title,
      gap: gap.title, window: old && (old.customWindow || old.status === 'done' || old.status === 'in-progress') ? old.window : `第 ${bounds[phase] + 1}—${bounds[phase + 1]} 个月`, proof,
      customTitle: old?.customTitle, customWindow: old?.customWindow,
      status: old?.status ?? 'todo', resultNote: old?.resultNote ?? '', evidenceSlugs: old?.evidenceSlugs ?? [], evidence: old?.evidence ?? [],
      resourceUrl: resource?.url && /^https?:\/\//.test(resource.url) && !/\.local(?:[/:]|$)/.test(resource.url) ? resource.url : null,
      effort: resource?.estimatedEffort || (kind === 'learn' ? '每周预留 2 小时，按实际资源调整' : '先与项目负责人确认任务范围和投入') });
    if (!phases[phase].focusGaps.includes(gap.title)) phases[phase].focusGaps.push(gap.title);
  }
  const usedResources = new Set<string>();
  const practiceTitle = (name: string) => {
    const cases: [RegExp,string][] = [
      [/云平台|云原生/, '为一个内部服务完成云环境交付与回滚演练'],
      [/容器|编排/, '为服务补齐容器部署配置并验证故障恢复'],
      [/可观测|监控|稳定|可靠/, '为核心服务建立指标、日志和告警，完成一次故障演练'],
      [/系统设计|架构|模块/, '为一个子域完成架构与模块边界设计，组织评审并落地验证'],
      [/测试|质量/, '为核心模块补齐自动化测试和质量门禁，提交前后对比报告'],
      [/协作|沟通/, '推动一次跨团队依赖对齐，跟踪交付并收集协作者反馈'],
      [/方案|表达|影响/, '完成一次技术方案评审和团队分享，根据反馈修订方案'],
      [/AI|模型|智能/, '完成一个应用场景的模型或 Agent 集成，提交评测与验收记录'],
      [/数据/, '完成一次数据链路或分析任务，验证数据质量与业务结果'],
      [/工程|开发|编码|实现/, '完成一个服务模块的实现或重构，通过代码评审与测试验收'],
    ];
    return cases.find(([pattern]) => pattern.test(name))?.[1] ?? `围绕「${name}」完成一个岗位任务，并接受交付验收`;
  };
  for (const gap of tasks) {
    const resource = gap.resources.find(item => !usedResources.has(item.slug) && !['mentor','practice'].includes(item.kind));
    if (resource) usedResources.add(resource.slug);
    const anchors = gap.competencies.length ? `；覆盖：${gap.competencies.join('、')}` : '';
    add(0, gap, 'learn', resource?.title ?? `梳理「${gap.title}」目标锚点与实践检查单`, resource?.evidenceTemplate || `学习笔记、检查单和一次练习结果${anchors}`, resource);
    add(1, gap, 'practice', `${practiceTitle(gap.title)}（${gap.title}）`, `任务范围、本人贡献、交付物、结果与评审记录${anchors}`);
    add(2, gap, 'mentor', `就「${gap.title}」组织方案复盘与反馈`, '方案材料、导师或协作者反馈、改进前后对比');
    add(3, gap, 'deliver', `整理「${gap.title}」成果证据并核对认证要求`, '已关联的成果材料、目标锚点检查结果；是否通过以正式认证为准');
  }
  if (!tasks.length) {
    phases.forEach((phase, index) => phase.actions.push({ id: `target:${input.track}:${input.level}:stage-${index}`, kind: 'deliver', kindLabel: '交付',
      title: ['与管理者确认目标岗位和能力要求', '确认可承担的岗位实践任务', '整理任务反馈与协作成果', '核对目标资格与证据材料'][index],
      gap: target.levelName, window: `第 ${bounds[index] + 1}—${bounds[index + 1]} 个月`, proof: '经本人确认的目标要求、任务和对齐记录', status: 'todo', resultNote: '', evidenceSlugs: [] }));
  }
  // Retain unfinished work already started and completed results when the live Gap set changes.
  const ids = new Set(phases.flatMap(phase => phase.actions.map(action => action.id)));
  for (const old of priorActions.values()) if (old.id && !ids.has(old.id) && old.status !== 'todo') {
    phases[3].actions.push({ ...old, carriedOver: true, evidenceSlugs: [...(old.evidenceSlugs ?? [])] });
    if (!phases[3].focusGaps.includes(old.gap)) phases[3].focusGaps.push(old.gap);
  }
  phases.forEach(phase => {
    phase.objective = phase.focusGaps.length ? `围绕${phase.focusGaps.join('、')}完成 ${phase.actions.length} 项行动` : '确认目标与可用的实际任务';
    phase.outcome = ['学习笔记、目标锚点检查单和练习结果', '任务交付物、设计与实现材料、验证结果及评审记录', '方案复用或分享材料、协作反馈与改进记录', '目标要求检查结果、成果证据包与后续申请计划'][phases.indexOf(phase)];
  });
  const strengths = target.requirements.filter(item => item.met).map(item => `${item.skillName}（当前 L${item.currentLevel}，目标 L${item.requiredLevel} 已达标）`);
  const changes = previous ? [
    previous.positioning.targetRole !== `${target.levelCode} ${target.levelName}` ? `目标调整为 ${target.levelCode} ${target.levelName}` : '已重新核对当前认证与目标要求',
    `本次包含 ${gaps.length} 项 Gap；原计划 ${previous.gaps.length} 项`,
    `保留 ${phases.flatMap(phase => phase.actions).filter(action => action.status === 'done').length} 项已完成行动和原证据关联`,
  ] : ['首次生成个人计划，确认后保存'];
  return { positioning: {
    currentRole: overview.currentTitle ? `${overview.currentTitle.levelCode} ${overview.currentTitle.levelName}` : position || '尚未维护当前岗位',
    targetRole: `${target.levelCode} ${target.levelName}`, horizon: `${input.months} 个月（${input.startMonth} — ${monthAfter(input.startMonth, input.months)}）`,
    readiness: target.total ? Math.round(target.met / target.total * 100) : 0,
    readinessNote: `目标要求已满足 ${target.met}/${target.total} 项；结合 ${gaps.length} 项职业、OKR 或岗位 Gap 制定行动。${gaps.length ? '先补齐缺口，再沉淀可验证的成果。' : '当前无未达标 Gap，重点保持能力并准备正式评审。'}`,
    strengths: strengths.length ? strengths : ['尚无该目标的已达标要求，以现有岗位与实践记录为起点'],
    weaknesses: gaps.length ? gaps.map(gap => `${gap.title}（${gap.note}）`) : ['无未达标 Gap，持续维护使用证据'],
  }, gaps: gaps.map(({ resources, competencies, gapLevels, ...gap }) => gap), phases,
    milestones: [{ time: input.startMonth, title: 'IDP 启动与目标确认', detail: '确认目标职称、投入与行动安排', state: 'next' },
      ...phases.map((phase, index) => ({ phaseId: phase.id, time: monthAfter(input.startMonth, bounds[index + 1]), title: phase.title,
        detail: phase.objective, state: 'next' as const }))],
    adjustRules: [
      { trigger: '目标岗位或 OKR 变化', action: '重新生成草案，比较差异并确认后更新；保留已开始和已完成的行动。' },
      { trigger: '技能接近复核时间', action: '补充真实使用与实践证据，按现有认证规则处理；计划本身不延长认证有效期。' },
      { trigger: '连续检查点未达成', action: '记录原因，与管理者调整行动范围或时间；不自动下调正式技能等级。' },
      { trigger: '提前完成阶段目标', action: '核对成果证据，确认后提前安排下一阶段行动。' },
    ], reviewCadence: '每季度与管理者复盘一次；记录进展、成果、阻碍及下一季度行动，必要时随时发起对齐。',
    meta: { revision: previous?.meta?.revision ?? 0, track: input.track, level: input.level, startMonth: input.startMonth, months: input.months,
      generatedAt: now, updatedAt: now, sourceFingerprint: sourceFingerprint(target, extras), generator: 'gap-rules' },
    alignments: previous?.alignments ?? [], changes };
}
export function syncMilestones(plan: IdpResponse): void {
  if (plan.milestones[0]) plan.milestones[0].state = 'done';
  let currentAssigned = false;
  for (const point of plan.milestones.slice(1)) {
    const actions = plan.phases.find(phase => phase.id === point.phaseId)?.actions ?? [];
    if (actions.length && actions.every(action => action.status === 'done')) point.state = 'done';
    else { point.state = currentAssigned ? 'next' : 'current'; currentAssigned = true; }
  }
}
