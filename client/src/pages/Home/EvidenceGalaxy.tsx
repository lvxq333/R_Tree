import { useEffect, useMemo, useRef, useState } from 'react';
import type { CertificationItem } from './certification-context';

interface GalaxyNodeDef {
  id: string;
  x: number;
  y: number;
  tracks: string;
  shape: 'halo' | 'ring' | 'orbit';
  halo: number;
  core: number;
  textY: number;
  levelY: number;
  label: string;
  ariaLabel: string;
}

interface GalaxyLineDef {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  track: string;
}

interface GalaxySkillView {
  title: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  status: string;
  explanation: string;
}

const GALAXY_NODES: GalaxyNodeDef[] = [
  { id: 'programming', x: 130, y: 120, tracks: 'software', shape: 'halo', halo: 28, core: 10, textY: 36, levelY: 52, label: '编程语言基础', ariaLabel: '编程语言基础，已点亮 L2' },
  { id: 'code-quality', x: 300, y: 88, tracks: 'software', shape: 'halo', halo: 25, core: 9, textY: 34, levelY: 50, label: '代码质量', ariaLabel: '代码质量，已点亮 L2' },
  { id: 'testing', x: 430, y: 160, tracks: 'software', shape: 'ring', halo: 18, core: 7, textY: 32, levelY: 48, label: '自动化测试', ariaLabel: '自动化测试，待补充证明' },
  { id: 'system-design', x: 610, y: 108, tracks: 'software', shape: 'orbit', halo: 23, core: 7, textY: 35, levelY: 51, label: '系统设计', ariaLabel: '系统设计，未点亮，有新建议' },
  { id: 'requirements', x: 540, y: 225, tracks: 'general software', shape: 'orbit', halo: 30, core: 11, textY: 40, levelY: 56, label: '需求理解', ariaLabel: '需求理解，当前 L3，待复核' },
  { id: 'observability', x: 170, y: 310, tracks: 'platform', shape: 'halo', halo: 24, core: 9, textY: 35, levelY: 51, label: '可观测性', ariaLabel: '可观测性，已点亮 L2' },
  { id: 'k8s', x: 345, y: 270, tracks: 'platform', shape: 'orbit', halo: 25, core: 8, textY: 38, levelY: 54, label: '容器与编排', ariaLabel: '容器与编排，未点亮，有新建议' },
  { id: 'slo', x: 520, y: 338, tracks: 'platform', shape: 'ring', halo: 17, core: 6, textY: 31, levelY: 47, label: 'SLO 设计', ariaLabel: 'SLO 设计，未点亮' },
  { id: 'automation', x: 705, y: 278, tracks: 'platform', shape: 'ring', halo: 17, core: 6, textY: 31, levelY: 47, label: '自动化运维', ariaLabel: '自动化运维，未点亮' },
  { id: 'data-processing', x: 900, y: 90, tracks: 'ai', shape: 'halo', halo: 23, core: 8, textY: 34, levelY: 50, label: '数据处理', ariaLabel: '数据处理，已点亮 L2' },
  { id: 'ai-integration', x: 765, y: 145, tracks: 'ai', shape: 'ring', halo: 17, core: 6, textY: 31, levelY: 47, label: 'AI 应用集成', ariaLabel: 'AI 应用集成，未点亮' },
  { id: 'model-evaluation', x: 925, y: 235, tracks: 'ai', shape: 'ring', halo: 17, core: 6, textY: 31, levelY: 47, label: '模型评估', ariaLabel: '模型评估，未点亮' },
  { id: 'collaboration', x: 835, y: 350, tracks: 'general', shape: 'orbit', halo: 23, core: 8, textY: 36, levelY: 52, label: '跨团队协作', ariaLabel: '跨团队协作，审批中' },
  { id: 'communication', x: 355, y: 395, tracks: 'general software', shape: 'halo', halo: 23, core: 8, textY: 34, levelY: 50, label: '技术方案表达', ariaLabel: '技术方案表达，已点亮 L2' },
];

const GALAXY_LINES: GalaxyLineDef[] = [
  { from: 'programming', to: 'code-quality', x1: 130, y1: 120, x2: 300, y2: 88, track: 'software' },
  { from: 'code-quality', to: 'testing', x1: 300, y1: 88, x2: 430, y2: 160, track: 'software' },
  { from: 'testing', to: 'system-design', x1: 430, y1: 160, x2: 610, y2: 108, track: 'software' },
  { from: 'observability', to: 'k8s', x1: 170, y1: 310, x2: 345, y2: 270, track: 'platform' },
  { from: 'k8s', to: 'slo', x1: 345, y1: 270, x2: 520, y2: 338, track: 'platform' },
  { from: 'slo', to: 'automation', x1: 520, y1: 338, x2: 705, y2: 278, track: 'platform' },
  { from: 'system-design', to: 'ai-integration', x1: 610, y1: 108, x2: 765, y2: 145, track: 'ai' },
  { from: 'ai-integration', to: 'data-processing', x1: 765, y1: 145, x2: 900, y2: 90, track: 'ai' },
  { from: 'ai-integration', to: 'model-evaluation', x1: 765, y1: 145, x2: 925, y2: 235, track: 'ai' },
  { from: 'testing', to: 'requirements', x1: 430, y1: 160, x2: 540, y2: 225, track: 'general' },
  { from: 'requirements', to: 'automation', x1: 540, y1: 225, x2: 705, y2: 278, track: 'general' },
  { from: 'requirements', to: 'ai-integration', x1: 540, y1: 225, x2: 765, y2: 145, track: 'general' },
  { from: 'requirements', to: 'communication', x1: 540, y1: 225, x2: 355, y2: 395, track: 'general' },
  { from: 'k8s', to: 'testing', x1: 345, y1: 270, x2: 430, y2: 160, track: 'platform software' },
  { from: 'automation', to: 'model-evaluation', x1: 705, y1: 278, x2: 925, y2: 235, track: 'ai platform' },
];

const GALAXY_TAIL: GalaxyLineDef = {
  from: 'automation', to: 'collaboration', x1: 705, y1: 278, x2: 835, y2: 350, track: 'general',
};

const GALAXY_PARTICLES: [number, number, number][] = [
  [74, 74, 1.4], [185, 206, 1], [266, 36, 1.2], [376, 225, 1.1], [482, 72, 1.5],
  [575, 385, 1.2], [680, 48, 1], [804, 276, 1.4], [958, 174, 1.1], [1010, 365, 1.5],
];

const GALAXY_SKILL_META: Record<string, GalaxySkillView> = {
  slo: { title: '服务稳定性与 SLO 设计', category: '平台工程', currentLevel: 0, targetLevel: 2, status: 'unlit', explanation: '尚未发现足够证据。完成一次服务 SLO 方案设计与评审后可主动申请。' },
  automation: { title: '自动化运维', category: '平台工程', currentLevel: 0, targetLevel: 2, status: 'unlit', explanation: '尚未点亮。可提交自动化脚本、应用范围和效率改善结果作为证明。' },
  'ai-integration': { title: 'AI 应用集成', category: '数据与 AI', currentLevel: 0, targetLevel: 2, status: 'unlit', explanation: '尚未点亮。完成可运行的模型服务集成并提供评估结果后可申请。' },
  'model-evaluation': { title: '模型评估', category: '数据与 AI', currentLevel: 0, targetLevel: 2, status: 'unlit', explanation: '尚未点亮。建议先完成一套包含指标、样本和误差分析的评估方案。' },
};

const SKILL_TRACKS: { key: string; label: string }[] = [
  { key: 'all', label: '全部星图' },
  { key: 'software', label: '软件开发' },
  { key: 'platform', label: '平台工程' },
  { key: 'ai', label: '数据与 AI' },
  { key: 'general', label: '通用能力' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nodeStatusClass(status: string): string {
  if (status === 'approved') return 'is-lit';
  if (status === 'pending') return 'is-pending';
  if (status === 'review' || status === 'review_submitted') return 'is-review';
  if (status === 'returned' || status === 'rejected') return 'is-returned';
  return 'is-unlit';
}

function starLevelText(skill: GalaxySkillView): string {
  if (skill.status === 'approved') return `L${skill.targetLevel} · 已点亮`;
  if (skill.status === 'pending') return '审批中';
  if (skill.status === 'review') return `L${skill.currentLevel} · 待复核`;
  if (skill.status === 'review_submitted') return `L${skill.currentLevel} · 已补证`;
  if (skill.status === 'returned') return '待补充';
  if (skill.status === 'ready') return '有新建议';
  return '未点亮';
}

export interface EvidenceGalaxyProps {
  certifications: CertificationItem[];
  onOpenDetail: (id: string) => void;
  onApply: (skillTitle: string | null) => void;
}

const EvidenceGalaxy = ({ certifications, onOpenDetail, onApply }: EvidenceGalaxyProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ tiltX: 0, tiltY: 0, zoom: 1 });
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0 });
  const [dragging, setDragging] = useState<boolean>(false);
  const [cruising, setCruising] = useState<boolean>(() =>
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [legendEmphasized, setLegendEmphasized] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<string>('requirements');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [track, setTrack] = useState<string>('all');

  const applyView = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.style.setProperty('--tilt-x', `${viewRef.current.tiltX}deg`);
    camera.style.setProperty('--tilt-y', `${viewRef.current.tiltY}deg`);
    camera.style.setProperty('--zoom', viewRef.current.zoom.toFixed(2));
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setCruising(false);
      const view = viewRef.current;
      view.zoom = clamp(view.zoom + (event.deltaY < 0 ? 0.08 : -0.08), 0.82, 1.34);
      applyView();
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, [data-skill-node]')) return;
    setCruising(false);
    dragRef.current = { dragging: true, moved: false, startX: event.clientX, startY: event.clientY };
    setDragging(true);
    stageRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    const drag = dragRef.current;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.moved = true;
    const view = viewRef.current;
    view.tiltY = clamp(view.tiltY + deltaX * 0.08, -18, 18);
    view.tiltX = clamp(view.tiltX - deltaY * 0.06, -12, 12);
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    applyView();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setDragging(false);
    const stage = stageRef.current;
    if (stage && stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };

  const handleControl = (control: string) => {
    if (control === 'cruise') {
      setCruising((prev: boolean) => !prev);
      return;
    }
    setCruising(false);
    const view = viewRef.current;
    if (control === 'zoom-in') view.zoom = clamp(view.zoom + 0.1, 0.82, 1.34);
    if (control === 'zoom-out') view.zoom = clamp(view.zoom - 0.1, 0.82, 1.34);
    if (control === 'reset') {
      view.tiltX = 0;
      view.tiltY = 0;
      view.zoom = 1;
    }
    applyView();
  };

  const getSkill = (id: string): GalaxySkillView | undefined => {
    const item = certifications.find((entry: CertificationItem) => entry.id === id);
    if (item) {
      return {
        title: item.title,
        category: item.category,
        currentLevel: item.currentLevel,
        targetLevel: item.targetLevel,
        status: item.status,
        explanation: item.explanation,
      };
    }
    return GALAXY_SKILL_META[id];
  };

  const highlightId = hoveredNode ?? selectedNode;
  const neighbors = useMemo(() => {
    const set = new Set<string>();
    for (const line of [...GALAXY_LINES, GALAXY_TAIL]) {
      if (line.from === highlightId) set.add(line.to);
      if (line.to === highlightId) set.add(line.from);
    }
    return set;
  }, [highlightId]);

  const selectionSkill = getSkill(selectedNode);

  const selectionActionLabel = (status: string): string => {
    if (status === 'approved') return '查看认证记录';
    if (status === 'review' || status === 'review_submitted') return '查看复核详情';
    if (status === 'pending') return '查看审批进度';
    if (status === 'returned') return '补充证明';
    if (status === 'ready') return '查看点亮建议';
    return '申请点亮';
  };

  const selectionLevelText = (skill: GalaxySkillView): string => {
    if (skill.status === 'approved') return `L${skill.targetLevel} · 已点亮`;
    if (skill.status === 'review' || skill.status === 'review_submitted') return `L${skill.currentLevel} · 待复核`;
    if (skill.currentLevel) return `L${skill.currentLevel} → L${skill.targetLevel}`;
    return `目标 L${skill.targetLevel}`;
  };

  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedNode(id);
  };

  const selectionInCertifications = selectionSkill
    ? certifications.some((entry: CertificationItem) => entry.id === selectedNode)
    : false;

  return (
    <section className="skill-galaxy panel" aria-labelledby="skill-map-title">
      <header className="galaxy-header">
        <div><span className="cert-kicker">我的能力星图</span><h2 id="skill-map-title">技能地图</h2><p>点亮 6 项技能，3 项出现新的成长信号</p></div>
        <div className="galaxy-actions"><button className="galaxy-help" id="galaxy-help" onClick={() => setLegendEmphasized((prev: boolean) => !prev)}>{legendEmphasized ? '已突出图例' : '图例说明'}</button><button className="primary" id="open-self-application" onClick={() => onApply(null)}>申请点亮技能</button></div>
      </header>
      <div className="sequence-tabs" role="tablist" aria-label="选择技能序列">
        {SKILL_TRACKS.map((item) => (
          <button
            key={item.key}
            className={track === item.key ? 'active' : ''}
            aria-selected={track === item.key}
            onClick={() => setTrack(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="galaxy-stage" ref={stageRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="galaxy-controls" aria-label="技能地图视角控制">
          <button aria-label="缩小技能地图" onClick={() => handleControl('zoom-out')}>−</button>
          <button className={`cruise-control ${cruising ? 'active' : ''}`} aria-pressed={cruising} onClick={() => handleControl('cruise')}>{cruising ? '暂停巡航' : '自动巡航'}</button>
          <button onClick={() => handleControl('reset')}>重置视角</button>
          <button aria-label="放大技能地图" onClick={() => handleControl('zoom-in')}>＋</button>
          <span>拖拽旋转 · 滚轮缩放</span>
        </div>
        <div
          className={`galaxy-camera ${cruising ? 'is-cruising' : ''} ${dragging ? 'is-dragging' : ''}`}
          id="galaxy-camera"
          ref={cameraRef}
        >
          <svg className="constellation-map" viewBox="0 0 1080 450" role="img" aria-label="张三的技能关系地图，技能按软件开发、平台工程、数据与 AI、通用能力连接">
            <defs>
              <radialGradient id="galaxy-core" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#6578ff" stopOpacity=".24" /><stop offset="1" stopColor="#111a32" stopOpacity="0" /></radialGradient>
              <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <ellipse cx="540" cy="225" rx="330" ry="160" fill="url(#galaxy-core)" />
            <g className="orbit-system" aria-hidden="true"><ellipse cx="540" cy="225" rx="250" ry="105" /><ellipse cx="540" cy="225" rx="390" ry="175" /><ellipse cx="540" cy="225" rx="470" ry="205" /></g>
            <g className="cosmic-particles" aria-hidden="true">
              {GALAXY_PARTICLES.map(([cx, cy, r]: [number, number, number]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
              ))}
            </g>
            <g className="constellation-lines">
              {GALAXY_LINES.map((line) => {
                const tracks = line.track.split(' ');
                const connected = line.from === highlightId || line.to === highlightId;
                const dimmed = track !== 'all' && !tracks.includes(track);
                return (
                  <line
                    key={`${line.from}-${line.to}`}
                    data-track={line.track}
                    data-from={line.from}
                    data-to={line.to}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    className={`${connected ? 'is-connected' : ''} ${dimmed ? 'is-dimmed' : ''} ${track !== 'all' && tracks.includes(track) ? 'is-active-track' : ''}`}
                  />
                );
              })}
            </g>
            {GALAXY_NODES.map((node) => {
              const skill = getSkill(node.id);
              const status = skill?.status ?? 'unlit';
              const nodeTracks = node.tracks.split(' ');
              const dimmed = track !== 'all' && !nodeTracks.includes(track);
              const className = [
                'skill-star',
                nodeStatusClass(status),
                node.id === selectedNode ? 'is-selected' : '',
                neighbors.has(node.id) ? 'is-neighbor' : '',
                dimmed ? 'is-dimmed' : '',
              ].filter(Boolean).join(' ');
              return (
                <g
                  key={node.id}
                  className={className}
                  data-skill-node={node.id}
                  data-track={node.tracks}
                  data-status={status}
                  tabIndex={0}
                  role="button"
                  aria-label={node.ariaLabel}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => setSelectedNode(node.id)}
                  onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node.id)}
                  onPointerEnter={() => setHoveredNode(node.id)}
                  onPointerLeave={() => setHoveredNode(null)}
                >
                  {node.shape === 'halo' && <circle className="star-halo" r={node.halo} />}
                  {node.shape === 'ring' && <circle className="star-ring" r={node.halo} />}
                  {node.shape === 'orbit' && <circle className="signal-orbit" r={node.halo} />}
                  <circle className="star-core" r={node.core} />
                  <text y={node.textY}>{node.label}</text>
                  <text className="star-level" y={node.levelY}>{skill ? starLevelText(skill) : '未点亮'}</text>
                </g>
              );
            })}
            <line
              className={`constellation-tail ${GALAXY_TAIL.from === highlightId || GALAXY_TAIL.to === highlightId ? 'is-connected' : ''} ${track !== 'all' && !GALAXY_TAIL.track.split(' ').includes(track) ? 'is-dimmed' : ''} ${track !== 'all' && GALAXY_TAIL.track.split(' ').includes(track) ? 'is-active-track' : ''}`}
              data-track={GALAXY_TAIL.track}
              data-from={GALAXY_TAIL.from}
              data-to={GALAXY_TAIL.to}
              x1={GALAXY_TAIL.x1}
              y1={GALAXY_TAIL.y1}
              x2={GALAXY_TAIL.x2}
              y2={GALAXY_TAIL.y2}
            />
          </svg>
        </div>
        <div className={`map-legend ${legendEmphasized ? 'is-emphasized' : ''}`} id="map-legend"><span><i className="lit-dot"></i>已点亮</span><span><i className="review-dot"></i>待复核</span><span><i className="pending-dot"></i>审批中</span><span><i className="signal-dot"></i>有新建议</span><span><i className="dark-dot"></i>未点亮</span></div>
        <div className="galaxy-selection" id="galaxy-selection" aria-live="polite">
          {selectionSkill && (
            <>
              <div><b>{selectionSkill.title}</b><small>{selectionSkill.category} · {selectionLevelText(selectionSkill)}</small></div>
              <p>{selectionSkill.explanation}</p>
              <button
                onClick={() => {
                  if (selectionInCertifications) onOpenDetail(selectedNode);
                  else onApply(selectionSkill.title);
                }}
              >
                {selectionActionLabel(selectionSkill.status)}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default EvidenceGalaxy;
