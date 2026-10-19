import type { SkillGrowthEvent } from '@shared/api.interface';

export type ChannelKey = 'tech' | 'management';
export type SequenceKey = 'software' | 'platform' | 'ai';
export type GapFilterKey = 'all' | 'career' | 'okr' | 'current';
export type GrowthRangeKey = '6m' | '12m' | 'all';

export interface GrowthPoint {
  x: number;
  y: number;
  event: SkillGrowthEvent;
}

export const SEQUENCE_LABELS: Record<SequenceKey, string> = {
  software: '软件开发序列',
  platform: '平台工程序列',
  ai: '数据与 AI 序列',
};

export const SEQUENCE_OPTIONS: { key: SequenceKey; description: string }[] = [
  { key: 'software', description: '工程化、系统设计与技术影响力' },
  { key: 'platform', description: '云平台、稳定性与基础设施架构' },
  { key: 'ai', description: 'AI 应用、模型工程与智能系统架构' },
];

export const COMMON_SKILL_NAMES: Set<string> = new Set([
  '跨团队协作', '技术影响力', '人才培养', '任务交付', '主动沟通', '复盘改进', '项目规划',
  '风险管理', '目标与绩效管理', '资源配置', '组织沟通', '业务规划', '组织设计', '梯队建设',
]);

export function growthCurvePath(points: GrowthPoint[]): string {
  if (points.length === 0) return '';
  return points.slice(1).reduce((path: string, point: GrowthPoint, index: number): string => {
    const previous: GrowthPoint = points[index];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}
