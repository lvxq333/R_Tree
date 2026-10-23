import { employeeApi } from '@/api';
import type { SkillRelationEdge } from '@shared/api.interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CertificationItem } from './certification-context';

interface SkillEntry { key: string; item: CertificationItem; litLevel: number; track: string }
interface Point { x: number; y: number }
const CENTER = { x: 560, y: 280 };
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.5;
const TRACKS = [
  { key: 'all', label: '全部星图' }, { key: 'software', label: '软件开发' },
  { key: 'platform', label: '平台工程' }, { key: 'ai', label: '数据与 AI' },
  { key: 'general', label: '通用能力' },
];
const TRACK_WORDS: Record<string, string[]> = {
  software: ['软件', '编程', '代码', '测试', '工程质量', '系统设计'],
  platform: ['平台', '容器', '云原生', '运维', '稳定性', 'SLO'],
  ai: ['数据', 'AI', '模型', '算法'],
};
function trackOf(category: string): string {
  for (const [track, words] of Object.entries(TRACK_WORDS))
    if (words.some(word => category.includes(word))) return track;
  return 'general';
}
function labelOf(item: CertificationItem, litLevel = 0): string {
  if (item.status === 'approved') return `L${item.currentLevel} · 已点亮`;
  if (item.status === 'review' || item.status === 'review_submitted') return `L${litLevel || item.currentLevel} · 待复核`;
  if (item.status === 'pending') return litLevel ? `L${litLevel} · 审批中` : '审批中';
  if (item.status === 'returned') return '待补充';
  return item.statusLabel || '待处理';
}
function actionOf(status: string): string {
  if (status === 'approved') return '查看认证记录';
  if (status === 'review' || status === 'review_submitted') return '查看复核详情';
  if (status === 'pending') return '查看审批进度';
  if (status === 'returned') return '补充证明';
  return '查看技能详情';
}
function preferredItem(items: CertificationItem[]): CertificationItem {
  return items.find(item => item.status === 'pending' || item.status === 'review' || item.status === 'review_submitted')
    ?? items.find(item => item.status === 'approved') ?? items[0];
}
function statusClass(item: CertificationItem, litLevel: number): string {
  if (item.status === 'pending') return 'is-pending';
  if (item.status === 'review' || item.status === 'review_submitted') return 'is-review';
  if (item.status === 'returned') return 'is-returned';
  if (item.status === 'ready') return 'is-ready';
  return litLevel ? 'is-lit' : 'is-unlit';
}
function titleLines(title: string): string[] {
  return title.length > 9 ? [title.slice(0, 9), title.slice(9)] : [title];
}
function relationText(edge: SkillRelationEdge): string {
  const parts = [];
  if (edge.sharedCompetencies.length) parts.push(`共同子能力：${edge.sharedCompetencies.join('、')}`);
  if (edge.sharedTitleLevels.length) parts.push(`共同职称要求：${edge.sharedTitleLevels.join('、')}`);
  return parts.join('；');
}
function relationType(edge: SkillRelationEdge): string {
  if (edge.sharedCompetencies.length && edge.sharedTitleLevels.length) return 'both';
  return edge.sharedCompetencies.length ? 'competency' : 'title';
}
function layoutGraph(skills: SkillEntry[], edges: SkillRelationEdge[]): Record<string, Point> {
  const ordered = [...skills].sort((a, b) => a.key.localeCompare(b.key));
  if (ordered.length === 1) return { [ordered[0].key]: CENTER };
  const nodes = ordered.map((skill, index) => {
    const angle = index * 2.399963229728653;
    const radius = 58 + Math.sqrt(index + 1) * 68;
    return { key: skill.key, slug: skill.item.skillSlug, track: skill.track,
      x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius * .72,
      vx: 0, vy: 0 };
  });
  const bySlug = new Map(nodes.map((node, index) => [node.slug, index]));
  const links = edges.map(edge => [bySlug.get(edge.fromSkillSlug), bySlug.get(edge.toSkillSlug)] as const)
    .filter((pair): pair is readonly [number, number] => pair[0] !== undefined && pair[1] !== undefined);
  const anchors: Record<string, Point> = {
    software: { x: 420, y: 210 }, platform: { x: 700, y: 215 },
    ai: { x: 650, y: 390 }, general: { x: 430, y: 395 },
  };
  for (let tick = 0; tick < 150; tick++) {
    const forces = nodes.map(node => ({
      x: (CENTER.x - node.x) * .008 + ((anchors[node.track]?.x ?? CENTER.x) - node.x) * .002,
      y: (CENTER.y - node.y) * .008 + ((anchors[node.track]?.y ?? CENTER.y) - node.y) * .002,
    }));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const distance = Math.max(20, Math.hypot(dx, dy));
      const push = 8500 / (distance * distance);
      forces[i].x -= dx / distance * push; forces[i].y -= dy / distance * push;
      forces[j].x += dx / distance * push; forces[j].y += dy / distance * push;
    }
    for (const [from, to] of links) {
      const dx = nodes[to].x - nodes[from].x;
      const dy = nodes[to].y - nodes[from].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const pull = (distance - 175) * .014;
      forces[from].x += dx / distance * pull; forces[from].y += dy / distance * pull;
      forces[to].x -= dx / distance * pull; forces[to].y -= dy / distance * pull;
    }
    nodes.forEach((node, index) => {
      node.vx = (node.vx + forces[index].x) * .76;
      node.vy = (node.vy + forces[index].y) * .76;
      node.x = Math.max(80, Math.min(1040, node.x + node.vx));
      node.y = Math.max(75, Math.min(485, node.y + node.vy));
    });
  }
  return Object.fromEntries(nodes.map(node => [node.key, {
    x: Math.max(75, Math.min(1045, CENTER.x + (node.x - CENTER.x) * 1.6)), y: node.y,
  }]));
}
export interface EvidenceGalaxyProps {
  certifications: CertificationItem[];
  onOpenDetail: (id: string) => void;
  onApply: (skillSlug: string | null) => void;
}
export default function EvidenceGalaxy({ certifications, onOpenDetail, onApply }: EvidenceGalaxyProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const [track, setTrack] = useState('all');
  const [edges, setEdges] = useState<SkillRelationEdge[]>([]);
  const [relationState, setRelationState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, Point>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number;
    nodeKey: string | null; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const skills = useMemo<SkillEntry[]>(() => {
    const grouped = new Map<string, CertificationItem[]>();
    for (const item of certifications) {
      const key = item.skillSlug || item.title;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped].map(([key, items]) => ({
      key, item: preferredItem(items),
      litLevel: Math.max(0, ...items.filter(item => item.status === 'approved').map(item => item.currentLevel)),
      track: trackOf(items[0].category),
    }));
  }, [certifications]);
  const slugList = useMemo(() => skills.map(skill => skill.item.skillSlug).filter((slug): slug is string => !!slug).sort().join(','), [skills]);
  useEffect(() => {
    let active = true;
    setRelationState('loading');
    employeeApi.getSkillRelations(slugList ? slugList.split(',') : [])
      .then(result => { if (active) { setEdges(result.edges); setRelationState('ready'); } })
      .catch(() => { if (active) { setEdges([]); setRelationState('error'); } });
    return () => { active = false; };
  }, [slugList]);

  const visible = skills.filter(skill => track === 'all' || skill.track === track);
  const visibleSlugs = new Set(visible.map(skill => skill.item.skillSlug).filter((slug): slug is string => !!slug));
  const visibleEdges = edges.filter(edge => visibleSlugs.has(edge.fromSkillSlug) && visibleSlugs.has(edge.toSkillSlug));
  const layoutKey = visible.map(skill => skill.key).join('|');
  const basePositions = useMemo(() => layoutGraph(visible, edges), [layoutKey, edges]);
  const pointFor = (key: string): Point => {
    const point = basePositions[key] ?? CENTER;
    const offset = nodeOffsets[key];
    return { x: point.x + (offset?.x ?? 0), y: point.y + (offset?.y ?? 0) };
  };
  const skillBySlug = new Map(visible.map(skill => [skill.item.skillSlug, skill]));
  const relationCount = (skill: SkillEntry) => edges.filter(edge =>
    edge.fromSkillSlug === skill.item.skillSlug || edge.toSkillSlug === skill.item.skillSlug).length;
  const selected = visible.find(skill => skill.key === selectedKey)
    ?? [...visible].sort((a, b) => relationCount(b) - relationCount(a)
      || Number(b.item.status === 'approved') - Number(a.item.status === 'approved'))[0];
  const inspected = visible.find(skill => skill.key === inspectedKey) ?? selected;
  const focusKey = hoveredKey ?? (visible.some(skill => skill.key === inspectedKey) ? inspectedKey : null);
  const focusSlug = visible.find(skill => skill.key === focusKey)?.item.skillSlug;
  const neighborSlugs = new Set(visibleEdges.filter(edge => edge.fromSkillSlug === focusSlug || edge.toSkillSlug === focusSlug)
    .flatMap(edge => [edge.fromSkillSlug, edge.toSkillSlug]));
  const approvedCount = new Set(certifications.filter(item => item.status === 'approved').map(item => item.skillSlug ?? item.title)).size;
  const readyCount = certifications.filter(item => item.status === 'ready').length;
  const inspect = (key: string) => setInspectedKey(key);
  const activate = (key: string) => {
    setSelectedKey(key); setInspectedKey(key);
    const point = pointFor(key);
    setViewport(current => ({ ...current, x: CENTER.x - point.x * current.scale, y: CENTER.y - point.y * current.scale }));
  };
  const inspectedDescription = inspected?.item.explanation?.trim()
    || `${inspected?.item.title ?? '该技能'}当前状态为${inspected?.item.statusLabel || '待确认'}。`;
  const svgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = svgPoint(svg, event.clientX, event.clientY);
      if (!point) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 350 : 1);
      setViewport(current => {
        const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * Math.exp(-delta * 0.0008)));
        if (scale === current.scale) return current;
        return {
          scale,
          x: point.x - (point.x - current.x) * scale / current.scale,
          y: point.y - (point.y - current.y) * scale / current.scale,
        };
      });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [selected?.key]);
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const point = svgPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    const nodeKey = event.target instanceof Element ? event.target.closest('[data-skill-key]')?.getAttribute('data-skill-key') ?? null : null;
    const offset = nodeKey ? nodeOffsets[nodeKey] : null;
    drag.current = { pointerId: event.pointerId, x: point.x, y: point.y,
      offsetX: nodeKey ? offset?.x ?? 0 : viewport.x,
      offsetY: nodeKey ? offset?.y ?? 0 : viewport.y, nodeKey, moved: false };
    suppressClick.current = false;
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const point = svgPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    if (!start.moved) {
      start.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    if (start.nodeKey) {
      const key = start.nodeKey;
      setNodeOffsets(current => ({ ...current, [key]: { x: start.offsetX + dx / viewport.scale, y: start.offsetY + dy / viewport.scale } }));
    } else setViewport(current => ({ ...current, x: start.offsetX + dx, y: start.offsetY + dy }));
  };
  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    suppressClick.current = start.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setIsDragging(false);
  };

  return <section className="skill-galaxy panel skill-constellation" aria-labelledby="skill-map-title">
    <header className="galaxy-header">
      <div><span className="cert-kicker">我的能力星图</span><h2 id="skill-map-title">技能星图</h2>
        <p>已点亮 {approvedCount} 项技能，{readyCount} 项出现新的成长信号</p></div>
      <div className="galaxy-actions"><button className="primary" onClick={() => onApply(null)}>申请点亮技能</button></div>
    </header>
    <div className="sequence-tabs" role="tablist" aria-label="选择技能序列">
      {TRACKS.map(option => <button key={option.key} role="tab" className={track === option.key ? 'active' : ''} aria-selected={track === option.key} onClick={() => {
        setTrack(option.key); setViewport({ scale: 1, x: 0, y: 0 }); setNodeOffsets({}); setHoveredKey(null); setInspectedKey(null);
      }}>{option.label}</button>)}
    </div>
    <div className="constellation-guide"><span>悬停高亮关联 · 点击查看技能 · 双击聚焦 · 拖动节点或画布 · 滚轮缩放</span>
      <div><i className="constellation-key competency" />共同子能力<i className="constellation-key title" />共同职称要求<i className="constellation-key both" />两种依据</div></div>
    {relationState === 'error' && <p className="constellation-notice">关联规则暂时无法读取；星点仍可查看，连线会在服务恢复后显示。</p>}
    {selected ? <>
      <div className={`constellation-frame${isDragging ? ' is-dragging' : ''}`}>
        <button className="constellation-reset" type="button" onClick={() => { setViewport({ scale: 1, x: 0, y: 0 }); setNodeOffsets({}); }}>重置视图</button>
        <svg ref={svgRef} className="constellation-svg" viewBox="0 0 1120 580" role="group" aria-label={`技能关联星图，共${visible.length}项技能，${visibleEdges.length}条规则关联。可拖动节点与画布、滚轮缩放。`}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
          <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          <g className="constellation-connections" aria-hidden="true">{visibleEdges.map(edge => {
            const from = skillBySlug.get(edge.fromSkillSlug);
            const to = skillBySlug.get(edge.toSkillSlug);
            if (!from || !to) return null;
            const a = pointFor(from.key), b = pointFor(to.key);
            const active = edge.fromSkillSlug === focusSlug || edge.toSkillSlug === focusSlug;
            return <line key={`${edge.fromSkillSlug}:${edge.toSkillSlug}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={`connection-${relationType(edge)}${active ? ' is-highlighted' : ''}`}><title>{relationText(edge)}</title></line>;
          })}</g>
          {visible.map(skill => {
            const point = pointFor(skill.key);
            const isFocus = skill.key === focusKey;
            const isNeighbor = !!skill.item.skillSlug && neighborSlugs.has(skill.item.skillSlug);
            return <g key={skill.key} data-skill-key={skill.key}
              className={`constellation-node ${statusClass(skill.item, skill.litLevel)}${isFocus ? ' is-focused' : ''}${focusKey && !isFocus && !isNeighbor ? ' is-muted' : ''}`}
              transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0}
              aria-label={`${skill.item.title}，${labelOf(skill.item, skill.litLevel)}，${relationCount(skill)}项规则关联`}
              onPointerEnter={() => setHoveredKey(skill.key)} onPointerLeave={() => setHoveredKey(current => current === skill.key ? null : current)}
              onClick={() => { if (!suppressClick.current) inspect(skill.key); }}
              onDoubleClick={() => { if (!suppressClick.current) activate(skill.key); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault(); if (event.shiftKey) activate(skill.key); else inspect(skill.key);
              } }}>
              <circle className="node-hit" r="34" />
              <circle className="node-glow" r="26" />
              <circle className="node-orbit" r="25" />
              <circle className="node-ring" r="20" />
              <circle className="node-core" r="9" />
              <text className="node-title" y="39">{titleLines(skill.item.title).map((line, index) => <tspan key={index} x="0" dy={index ? 14 : 0}>{line}</tspan>)}</text>
              <text className="node-status" y={titleLines(skill.item.title).length > 1 ? 68 : 54}>{labelOf(skill.item, skill.litLevel)}</text>
            </g>;
          })}
          </g>
        </svg>
      </div>
      <div className="constellation-selection" aria-live="polite"><div><b>{inspected.item.title}</b><small>{inspected.item.category} · {labelOf(inspected.item, inspected.litLevel)}</small></div>
        <p>{inspectedDescription}</p><button onClick={() => onOpenDetail(inspected.item.id)}>{actionOf(inspected.item.status)}</button></div>
    </> : <p className="constellation-notice">当前序列没有技能事项。你可以主动申请点亮技能。</p>}
  </section>;
}
