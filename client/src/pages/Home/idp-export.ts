import type { IdpResponse } from '@shared/api.interface';
const states = {todo:'待开始','in-progress':'进行中',done:'已完成'};
export function idpText(plan: IdpResponse): string {
  return [
    '个人发展计划 · IDP',`当前：${plan.positioning.currentRole}`,`目标：${plan.positioning.targetRole}`,`周期：${plan.positioning.horizon}`,
    `目标就绪度：${plan.positioning.readiness}%（生成时）`,plan.positioning.readinessNote,
    `版本：${plan.meta?.draftId ? '草案' : plan.meta?.revision ?? '历史计划'}；更新：${plan.meta?.updatedAt ?? '未记录'}`,
    '\n现状盘点',...plan.positioning.strengths.map(item=>`优势：${item}`),...plan.positioning.weaknesses.map(item=>`重点：${item}`),
    '\nGap 输入',...plan.gaps.map(gap=>`${gap.priority} ${gap.title}：${gap.note}`),
    ...plan.phases.flatMap(phase=>[`\n${phase.range} · ${phase.title}`,phase.theme,`目标：${phase.objective}`,`里程碑：${phase.milestone}`,`成果：${phase.outcome}`,
      ...phase.actions.flatMap(action=>[`${action.kindLabel} · ${action.title}（${states[action.status ?? 'todo']}）`,
        `时间：${action.window}；对应：${action.gap}；证明：${action.proof}`,action.effort ? `投入：${action.effort}` : '',
        action.resourceUrl ? `资源：${action.resourceUrl}` : '',action.resultNote ? `成果说明：${action.resultNote}` : '',
        action.evidence?.length ? `关联证据：${action.evidence.map(item=>`${item.title}${item.url ? `（${item.url}）` : ''}`).join('、')}` : ''])]),
    '\n里程碑与检查点',plan.reviewCadence,...plan.milestones.map(point=>`${point.time} · ${point.title}：${point.detail}`),
    '\n调整机制',...plan.adjustRules.map(rule=>`${rule.trigger}：${rule.action}`),
    '\n对齐记录',...(plan.alignments?.map(item=>`${item.date} · ${item.participant}\n${item.note}`) ?? []),
    '\n行动完成不代表认证通过，技能和职称以正式认证结果为准。',
  ].filter(Boolean).join('\n');
}
export function downloadIdp(plan: IdpResponse) {
  const url = URL.createObjectURL(new Blob(['\ufeff'+idpText(plan)],{type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=`个人发展计划-v${plan.meta?.revision ?? 0}.txt`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
