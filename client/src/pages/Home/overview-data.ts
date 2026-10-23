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

export function growthCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.slice(1).reduce((path: string, point: { x: number; y: number }, index: number): string => {
    const previous = points[index];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}


/** Marker labels and Y coordinates both use lighting ordinals; boundary points only extend the line. */
export function buildGrowthChart(events: SkillGrowthEvent[], range: GrowthRangeKey, now = new Date()) {
  const left = 58, right = 862, top = 34, bottom = 238;
  const end = now.getTime();
  const eventTime = (event: SkillGrowthEvent) => Date.parse(event.occurredAt ?? `${event.date.replace('.', '-')}-01T00:00:00+08:00`);
  const changes: (GrowthPoint & { ordinal: number; at: number })[] = [];
  let total = 0;
  for (const event of [...events].sort((a, b) => eventTime(a) - eventTime(b))) {
    const at = eventTime(event);
    if (!Number.isFinite(at) || at > end || event.total <= total) continue;
    changes.push({ event, ordinal: changes.length + 1, at, x: 0, y: 0 });
    total = event.total;
  }
  const shanghai = new Date(end + 8 * 3600_000);
  const months = range === '6m' ? 6 : 12;
  // Calendar-month windows in Shanghai, including the current month.
  const cutoff = Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth() - months + 1, 1) - 8 * 3600_000;
  const start = range === 'all' ? (changes[0]?.at ?? cutoff) : cutoff;
  const duration = Math.max(86400_000, end - start);
  const xFor = (at: number) => left + (at - start) / duration * (right - left);
  // 同一自然日内的多个点亮事件：在相邻不同日期之间线性内插 x，
  // 体现事件先后顺序同时保持紧凑，避免同日点亮叠成一条竖线。
  const day = 86400_000;
  for (const point of changes) point.x = xFor(point.at);
  for (let i = 0; i < changes.length; ) {
    let j = i;
    while (j + 1 < changes.length && Math.floor(changes[j + 1].at / day) === Math.floor(changes[i].at / day)) j++;
    if (j > i) {
      const prevX = i > 0 ? changes[i - 1].x : left;
      const nextAt = j + 1 < changes.length ? changes[j + 1].at : Math.min(end, changes[j].at + day);
      const nextX = Math.max(xFor(nextAt), prevX);
      for (let k = i; k <= j; k++) changes[k].x = prevX + (nextX - prevX) * (k - i + 1) / (j - i + 2);
    }
    i = j + 1;
  }
  const maxOrdinal = Math.max(1, changes.length);
  const step = maxOrdinal <= 12 ? 1 : Math.ceil(maxOrdinal / 6);
  const yMax = Math.ceil((maxOrdinal + 1) / step) * step;
  const yFor = (value: number) => bottom - value / yMax * (bottom - top);
  const points = changes.filter(point => point.at >= start).map(point => ({ ...point, y: yFor(point.ordinal) }));
  const previous = changes.filter(point => point.at < start).at(-1);
  const linePoints: { x: number; y: number }[] = previous ? [{ x: left, y: yFor(previous.ordinal) }, ...points] : [...points];
  const last = linePoints.at(-1);
  if (last && last.x < right) linePoints.push({ x: right, y: last.y });
  const linePath = growthCurvePath(linePoints);
  const areaPath = linePoints.length > 1 ? `${linePath} L ${right} ${bottom} L ${linePoints[0].x} ${bottom} Z` : '';
  const ticks = Array.from({ length: 6 }, (_, index) => {
    const at = start + duration * index / 5;
    const date = new Date(at + 8 * 3600_000);
    return { x: left + (right - left) * index / 5, label: index === 5 ? '至今' : `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}` };
  }).filter((tick, index, all) => index === all.length - 1 || all.findIndex(item => item.label === tick.label) === index);
  const tailStart = points.at(-1)?.x ?? (previous ? left : right);
  return {
    points, changes, linePath, areaPath, ticks, yFor,
    gridValues: Array.from({ length: yMax / step + 1 }, (_, index) => index * step),
    tail: last && right - tailStart >= 100 ? { x: (tailStart + right) / 2, y: last.y - 16 } : null,
  };
}
