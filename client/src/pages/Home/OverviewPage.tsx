import { useEffect, useRef, useState } from 'react';
import { growthApi } from '@/api';
import { logger } from '@/lib/runtime';
import type {
  AbilityStructureResponse,
  AbilityAxis,
  CareerNode,
  CareerNodeSkill,
  CareerSequenceView,
  GapAction,
  GapListResponse,
  GapPoolItem,
  GrowthEventsResponse,
  GrowthRange,
  SkillGrowthEvent,
} from '@shared/api.interface';
import { useUI } from './ui-context';
import { useEmployeeWorkspace } from './employee-workspace-context';
import {
  COMMON_SKILL_NAMES,
  SEQUENCE_LABELS,
  SEQUENCE_OPTIONS,
  growthCurvePath,
  type ChannelKey,
  type GapFilterKey,
  type GrowthPoint,
  type GrowthRangeKey,
  type SequenceKey,
} from './overview-data';

const GROWTH_CHART_LEFT = 58;
const GROWTH_CHART_RIGHT = 862;
const GROWTH_CHART_TOP = 34;
const GROWTH_CHART_BOTTOM = 238;
const GROWTH_GRID_VALUES = [5, 10, 15, 20];

const GAP_TABS: { key: GapFilterKey; label: string }[] = [
  { key: 'all', label: '全部 Gap' },
  { key: 'career', label: '职业下一节点' },
  { key: 'okr', label: 'OKR 推导' },
  { key: 'current', label: '当前岗位' },
];

const GROWTH_RANGES: { key: GrowthRangeKey; label: string }[] = [
  { key: '12m', label: '近 12 个月' },
  { key: '6m', label: '近 6 个月' },
  { key: 'all', label: '全部' },
];

const GAP_SOURCE_TEXT: Record<string, string> = { career: '职业', okr: 'OKR', current: '岗位', profile: '画像' };

/* ========== 能力结构雷达图几何参数 ========== */
const RADAR_CENTER_X = 170;
const RADAR_CENTER_Y = 122;
const RADAR_RADIUS = 84;
const RADAR_LEVELS = 5;

const radarPoint = (index: number, total: number, value: number): { x: number; y: number } => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const radius = (RADAR_RADIUS * value) / RADAR_LEVELS;
  return { x: RADAR_CENTER_X + radius * Math.cos(angle), y: RADAR_CENTER_Y + radius * Math.sin(angle) };
};

const radarPolygon = (axes: AbilityAxis[], key: 'current' | 'target'): string =>
  axes
    .map((axis, index) => {
      const point = radarPoint(index, axes.length, key === 'current' ? axis.current : axis.target);
      return `${point.x},${point.y}`;
    })
    .join(' ');

const RadarChart = ({ axes }: { axes: AbilityAxis[] }) => {
  if (axes.length < 3) {
    return <div className="empty-panel" style={{ padding: '55px 20px' }}><p style={{ color: '#667085' }}>尚未生成能力结构评估</p></div>;
  }
  const labelPoint = (index: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    const x = RADAR_CENTER_X + (RADAR_RADIUS + 18) * Math.cos(angle);
    const y = RADAR_CENTER_Y + (RADAR_RADIUS + 16) * Math.sin(angle);
    const cos = Math.cos(angle);
    const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
    return { x, y: y + 4, anchor };
  };
  return (
    <svg className="radar-chart" viewBox="0 0 340 244" role="img" aria-label="能力结构雷达图：当前能力与目标要求对照">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={axes.map((_, index) => {
            const point = radarPoint(index, axes.length, level);
            return `${point.x},${point.y}`;
          }).join(' ')}
          fill={level === RADAR_LEVELS ? '#fbfaff' : 'none'}
          stroke="#e4e7f2"
          strokeWidth={1}
        />
      ))}
      {axes.map((axis, index) => {
        const point = radarPoint(index, axes.length, RADAR_LEVELS);
        return <line key={axis.name} x1={RADAR_CENTER_X} y1={RADAR_CENTER_Y} x2={point.x} y2={point.y} stroke="#e4e7f2" strokeWidth={1} />;
      })}
      <polygon points={radarPolygon(axes, 'target')} fill="rgba(87, 144, 239, .08)" stroke="#5790ef" strokeWidth={1.5} strokeDasharray="5 4" />
      <polygon points={radarPolygon(axes, 'current')} fill="rgba(101, 88, 232, .22)" stroke="#6558e8" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((axis, index) => {
        const point = radarPoint(index, axes.length, axis.current);
        return <circle key={`${axis.name}-dot`} cx={point.x} cy={point.y} r={3} fill="#6558e8" />;
      })}
      {axes.map((axis, index) => {
        const label = labelPoint(index);
        return (
          <text
            key={`${axis.name}-label`}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor}
            fontSize={11}
            fill="#5b6472"
          >
            {axis.name}
            {axis.fromBaseline ? '*' : ''}
          </text>
        );
      })}
    </svg>
  );
};

const OverviewPage = () => {
  const { navigate, showToast } = useUI();
  const { workspace, error: workspaceError } = useEmployeeWorkspace();
  const [sequences, setSequences] = useState<CareerSequenceView[] | null>(null);
  const [growthEvents, setGrowthEvents] = useState<SkillGrowthEvent[] | null>(null);
  const [gapItems, setGapItems] = useState<GapPoolItem[] | null>(null);
  const [gapActions, setGapActions] = useState<GapAction[]>([]);
  const [abilityStructure, setAbilityStructure] = useState<AbilityStructureResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelKey>('tech');
  const [sequence, setSequence] = useState<SequenceKey>('software');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('middle');
  const [sequenceMenuOpen, setSequenceMenuOpen] = useState<boolean>(false);
  const [gapFilter, setGapFilter] = useState<GapFilterKey>('all');
  const [growthRange, setGrowthRange] = useState<GrowthRangeKey>('12m');
  const [selectedGrowthDate, setSelectedGrowthDate] = useState<string>('2026.09');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.target instanceof Node && pickerRef.current?.contains(event.target)) return;
      setSequenceMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSequenceMenuOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    growthApi.getCareer()
      .then((res) => {
        if (!cancelled) {
          setSequences(res.sequences);
          // 默认聚焦偏好序列的「推荐下一站」节点；偏好序列缺失时取第一条有推荐下一站的序列
          const preferredEntry = res.preferredTrack
            ? res.sequences.flatMap(sequence => sequence.nodes.map(node => ({ sequenceKey: sequence.key, node })))
              .find(item => item.sequenceKey === res.preferredTrack && item.node.isNext)
            : undefined;
          const entry = preferredEntry
            ?? res.sequences
              .flatMap(sequence => sequence.nodes.map(node => ({ sequenceKey: sequence.key, node })))
              .find(item => item.node.isNext);
          if (entry) {
            if (['software', 'platform', 'ai'].includes(entry.sequenceKey)) {
              setSequence(entry.sequenceKey as SequenceKey);
            }
            setSelectedNodeId(entry.node.id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取职业路线失败', error);
          setLoadError('职业路线数据加载失败，请稍后重试');
        }
      });
    growthApi.listGaps()
      .then((res: GapListResponse) => {
        if (!cancelled) setGapItems(res.items);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取差距池失败', error);
          setLoadError('差距池数据加载失败，请稍后重试');
        }
      });
    growthApi.getGapActions()
      .then((res) => {
        if (!cancelled) setGapActions(res.items);
      })
      .catch((error: unknown) => {
        if (!cancelled) logger.error('获取行动建议失败', error);
      });
    growthApi.getAbilityStructure()
      .then((res: AbilityStructureResponse) => {
        if (!cancelled) setAbilityStructure(res);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取能力结构失败', error);
          setAbilityStructure({ axes: [], heldLevelCode: null, nextLevelCode: null, summary: '' });
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    growthApi.getGrowthEvents(growthRange as GrowthRange)
      .then((res: GrowthEventsResponse) => {
        if (!cancelled) setGrowthEvents(res.events);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取成长事件失败', error);
          setLoadError('成长事件数据加载失败，请稍后重试');
        }
      });
    return () => { cancelled = true; };
  }, [growthRange]);

  if (loadError || (!workspace && workspaceError)) {
    return (
      <section className="page active" id="overview">
        <div className="skill-model-note" role="alert"><span>{loadError ?? workspaceError}</span></div>
      </section>
    );
  }
  if (!sequences || !gapItems || !growthEvents || !workspace || !abilityStructure) {
    return (
      <section className="page active" id="overview">
        <div className="skill-model-note"><span>成长数据加载中…</span></div>
      </section>
    );
  }

  const { employee: currentEmployee, metrics } = workspace;
  const readyCount = metrics.candidateCount;
  const tenure = currentEmployee.tenureMonths;
  const tenureText = tenure === null ? '入职时间未维护' : `${currentEmployee.hireDate} 入职，已在职 ${Math.floor(tenure / 12)} 年 ${tenure % 12} 个月`;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greetingText = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const expertEnd = metrics.certifiedSkillCount ? metrics.maturity.expert / metrics.certifiedSkillCount * 100 : 0;
  const coreEnd = metrics.certifiedSkillCount ? (metrics.maturity.expert + metrics.maturity.core) / metrics.certifiedSkillCount * 100 : 0;
  const maturityBackground = `radial-gradient(circle, #fff 0 48%, transparent 50%), conic-gradient(#625df0 0 ${expertEnd}%, #8d56ee ${expertEnd}% ${coreEnd}%, #34b4d1 ${coreEnd}% 100%)`;
  const identityText = [
    currentEmployee.name,
    `企业：${currentEmployee.company ?? '未维护'}`,
    `部门：${currentEmployee.org || '未维护'}`,
    `当前岗位：${currentEmployee.role || '未维护'}`,
    `职级：${currentEmployee.jobGrade ?? '未维护'}`,
    `工作地点：${currentEmployee.workLocation ?? '未维护'}`,
  ].join('\n');
  const copyIdentity = async () => {
    try {
      await navigator.clipboard.writeText(identityText);
      showToast('已复制当前员工身份信息。');
    } catch {
      showToast('复制失败，请检查浏览器剪贴板权限。');
    }
  };
  const shareIdentity = async () => {
    if (!navigator.share) { await copyIdentity(); return; }
    try {
      await navigator.share({ title: `${currentEmployee.name}的技能树名片`, text: identityText });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) showToast('分享未完成，可使用“复制信息”。');
    }
  };

  const sequenceByKey = new Map<string, CareerSequenceView>(
    sequences.map((item: CareerSequenceView): [string, CareerSequenceView] => [item.key, item]),
  );
  const nodesFor = (targetChannel: ChannelKey, targetSequence: SequenceKey): CareerNode[] =>
    targetChannel === 'tech'
      ? (sequenceByKey.get(targetSequence)?.nodes ?? [])
      : (sequenceByKey.get('management')?.nodes ?? []);
  const careerNodes: CareerNode[] = nodesFor(channel, sequence);
  const selectedNode = careerNodes.find((node) => node.id === selectedNodeId)
    ?? careerNodes[1]
    ?? careerNodes[0];
  const gapCounts: Record<GapFilterKey, number> = {
    all: gapItems.length,
    career: gapItems.filter((item: GapPoolItem) => item.source === 'career').length,
    okr: gapItems.filter((item: GapPoolItem) => item.source === 'okr').length,
    current: gapItems.filter((item: GapPoolItem) => item.source === 'current').length,
  };
  const lastEvent = growthEvents[growthEvents.length - 1];
  const effectiveSelectedDate = growthEvents.some((item: SkillGrowthEvent) => item.date === selectedGrowthDate)
    ? selectedGrowthDate
    : lastEvent?.date ?? '';
  const selectedEvent = growthEvents.find((item: SkillGrowthEvent) => item.date === effectiveSelectedDate) ?? lastEvent;
  const xStep = growthEvents.length > 1
    ? (GROWTH_CHART_RIGHT - GROWTH_CHART_LEFT) / (growthEvents.length - 1)
    : 0;
  const yFor = (value: number): number =>
    GROWTH_CHART_BOTTOM - (value / 20) * (GROWTH_CHART_BOTTOM - GROWTH_CHART_TOP);
  const growthPoints: GrowthPoint[] = growthEvents.map((item: SkillGrowthEvent, index: number) => ({
    x: GROWTH_CHART_LEFT + index * xStep,
    y: yFor(item.total),
    event: item,
  }));
  const linePath = growthCurvePath(growthPoints);
  const areaPath = growthPoints.length ? `${linePath} L ${growthPoints[growthPoints.length - 1].x} ${GROWTH_CHART_BOTTOM} L ${growthPoints[0].x} ${GROWTH_CHART_BOTTOM} Z` : '';

  const handleChannelChange = (next: ChannelKey): void => {
    setChannel(next);
    const nodes = nodesFor(next, sequence);
    // 切换通道/序列后聚焦该序列的「推荐下一站」，无未达成层时聚焦最后一站。
    const nextNode = nodes.find((node) => node.isNext) ?? nodes[nodes.length - 1];
    if (nextNode) setSelectedNodeId(nextNode.id);
  };

  const handleSequenceSelect = (key: SequenceKey): void => {
    setSequence(key);
    setSequenceMenuOpen(false);
    const nodes = nodesFor('tech', key);
    const nextNode = nodes.find((node) => node.isNext) ?? nodes[nodes.length - 1];
    if (nextNode) setSelectedNodeId(nextNode.id);
  };

  const handleGrowthPointKeyDown = (event: React.KeyboardEvent<SVGGElement>, date: string): void => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setSelectedGrowthDate(date);
  };

  return (
    <section className="page active" id="overview">
      <section className="profile-hero">
        <div className="profile-avatar">{currentEmployee.avatar}</div>
        <div><h2>{greetingText}，{currentEmployee.name}</h2><p>{tenureText}</p><span>{currentEmployee.summary || '个人简介未维护'} <button aria-label="编辑个人简介">✎</button></span></div>
        <button className="hero-skill-signal" onClick={() => navigate('evidence')}>
          <i className="hero-signal-orbit" aria-hidden="true"></i><span className="hero-signal-icon">✦</span>
          <span><b><strong>{readyCount}</strong> 项技能出现点亮信号</b><small>{readyCount ? '查看已有候选技能，核对证据后发起申请' : '暂无待确认的候选技能'}</small></span>
          <em>查看 →</em>
        </button>
        <button className="hero-add" aria-label="新增成长记录">＋</button>
      </section>

      <div className="profile-metrics">
        <article title="按有效当前认证去重统计；待复核保留当前等级，候选和待补充申请不计入"><i className="metric-icon purple">▱</i><div><span>总技能</span><strong>{metrics.certifiedSkillCount}</strong></div></article>
        <article><i className="metric-icon amber">▥</i><div><span>平均技能等级</span><strong>{metrics.averageSkillLevel === null ? '—' : `L${metrics.averageSkillLevel.toFixed(1)}`}</strong></div></article>
        <article title="现有数据库未维护该指标，暂不推算"><i className="metric-icon blue">AI</i><div><span>超级员工</span><strong>{metrics.superEmployeeLevel === null ? '—' : `L${metrics.superEmployeeLevel}`}</strong></div></article>
        <article title="按近三个自然月的明确等级提升事件统计，首次点亮和降级不计为升级"><i className="metric-icon rose">↗</i><div><span>成长速度（近三月升级次数）</span><strong>{metrics.recentUpgradeCount}</strong></div></article>
      </div>

      {workspace.workFactCount === 0 && <section className="panel" style={{ padding: '20px 24px', marginBottom: 18 }}><h3>工作记录从这里开始</h3><p>事实中心已登记你的基本信息，目前有 0 条工作事实。项目、绩效和工作成果接入后，会显示在你的工作台中。</p></section>}

      <div className="profile-insights">
        <section className="panel radar-panel">
          <div className="section-head compact">
            <div><h3>能力结构分布</h3><p>{abilityStructure.summary || '依据当前员工的能力评估结果展示'}</p></div>
            <button className="radar-skill-entry" onClick={() => navigate('evidence')}>进入技能池 <span><b>{readyCount}</b> 待确认</span></button>
          </div>
          <RadarChart axes={abilityStructure.axes} />
          {abilityStructure.axes.length >= 3 && (
            <div className="chart-legend">
              <span><i className="legend-purple"></i>当前能力{abilityStructure.heldLevelCode ? `（${abilityStructure.heldLevelCode} 起）` : ''}</span>
              <span><i className="legend-blue"></i>目标要求{abilityStructure.nextLevelCode ? `（${abilityStructure.nextLevelCode}）` : ''}</span>
            </div>
          )}
          {abilityStructure.axes.some(axis => axis.fromBaseline) && (
            <p className="radar-footnote">* 该技能当前等级按职称基线（入门理解 L1）计</p>
          )}
        </section>
        <section className="panel maturity-panel">
          <div className="section-head compact"><div><h3>能力成熟度分布</h3><p>{metrics.certifiedSkillCount} 项有效认证技能</p></div></div>
          <div className="donut" style={{ background: metrics.certifiedSkillCount ? maturityBackground : '#edf0f5' }}><div><strong>{metrics.certifiedSkillCount}</strong><span>项技能</span></div></div>
          <ul>
            <li><i className="dot-expert"></i><span>专家能力（L4-L5）</span><b>{metrics.maturity.expert}</b></li>
            <li><i className="dot-core"></i><span>核心能力（L3）</span><b>{metrics.maturity.core}</b></li>
            <li><i className="dot-growth"></i><span>进阶能力（L1-L2）</span><b>{metrics.maturity.growth}</b></li>
          </ul>
        </section>
        <section className="panel identity-panel">
          <div className="section-head compact"><div><h3>身份信息</h3><p>仅本人和授权管理者可见</p></div></div>
          <dl><div><dt>企业</dt><dd>{currentEmployee.company ?? '未维护'}</dd></div><div><dt>部门</dt><dd>{currentEmployee.org || '未维护'}</dd></div><div><dt>当前岗位</dt><dd>{currentEmployee.role || '未维护'}</dd></div><div><dt>职级</dt><dd>{currentEmployee.jobGrade ?? '未维护'}</dd></div><div><dt>工作地点</dt><dd>{currentEmployee.workLocation ?? '未维护'}</dd></div></dl>
          <div className="identity-actions"><button className="primary" onClick={() => { void shareIdentity(); }}>分享名片</button><button className="ghost" onClick={() => { void copyIdentity(); }}>复制信息</button></div>
        </section>
      </div>

      <section className="panel career-panel">
        <div className="section-head">
          <div><h3>职业发展路线</h3><p>统一岗位能力要求与当前员工的有效认证等级对照</p></div>
          <div className="career-controls">
            <div className={`sequence-picker ${channel === 'tech' ? '' : 'hidden'}`} ref={pickerRef}>
              <button className="sequence-trigger" aria-expanded={sequenceMenuOpen} aria-controls="sequence-menu" onClick={() => setSequenceMenuOpen((open) => !open)}>
                <span>{SEQUENCE_LABELS[sequence]}</span><i>⌄</i>
              </button>
              {sequenceMenuOpen && (
                <div className="sequence-menu" id="sequence-menu">
                  {SEQUENCE_OPTIONS.map((option) => (
                    <button key={option.key} className={option.key === sequence ? 'active' : ''} onClick={() => handleSequenceSelect(option.key)}>
                      <b>{SEQUENCE_LABELS[option.key]}</b><small>{option.description}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="channel-switch">
              <button className={channel === 'tech' ? 'active' : ''} onClick={() => handleChannelChange('tech')}>技术序列</button>
              <button className={channel === 'management' ? 'active' : ''} onClick={() => handleChannelChange('management')}>管理通道</button>
            </div>
          </div>
        </div>
        <div className="skill-model-note"><b>技能模型</b><span>一级技能：专业技能 / 通用技能</span><i>→</i><span>二级技能：具体可评估能力</span><i>→</i><span>等级：L1-L5</span></div>
        <div className="career-route">
          {careerNodes.map((node, index) => {
            const classes: string[] = ['career-node'];
            if (node.achieved) classes.push('reached');
            if (node.achieved && (node.meta === '当前岗位' || node.meta === '当前职级')) classes.push('current');
            if (node.isNext && !node.achieved) classes.push('next-stop');
            if (node.id === selectedNode.id) classes.push('selected');
            return (
              <button key={node.id} className={classes.join(' ')} onClick={() => setSelectedNodeId(node.id)}>
                <span className="node-orb">{node.code}</span><b>{node.title}</b><small>{node.meta}</small>
              </button>
            );
          })}
        </div>
        <div className="node-detail">
          <div className="node-summary">
            <span>{selectedNode.state}</span>
            <h4>{selectedNode.title}</h4>
            <p>{selectedNode.description}</p>
            <div className="coverage-bar"><i style={{ width: `${selectedNode.coverage}%` }}></i></div>
            <small>能力满足度 {selectedNode.coverage}%</small>
          </div>
          <div className="node-skills">
            {selectedNode.skills.map((skill: CareerNodeSkill) => {
              const met = skill.current >= skill.target;
              const category = COMMON_SKILL_NAMES.has(skill.name) ? '通用技能' : '专业技能';
              const sourceText = skill.source === 'title-covered'
                ? ' · 职称覆盖'
                : skill.source === 'skill-covered'
                  ? ' · 认证覆盖'
                  : skill.source === 'title-baseline'
                    ? ' · 职称基线'
                    : '';
              return (
                <div key={skill.name} className={`node-skill ${met ? 'met' : ''}`}>
                  <div><b>{skill.name}</b><small>{category} · 当前 L{skill.current}{sourceText} · 要求 L{skill.target}</small></div>
                  <span>{met ? '已满足' : `Gap ${skill.target - skill.current} 级`}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="level-legend"><b>二级技能等级</b><span><i>L1</i>入门</span><span><i>L2</i>基础</span><span><i>L3</i>熟练</span><span><i>L4</i>精通</span><span><i>L5</i>专家</span></div>
      </section>

      <div className="growth-bottom-grid">
        <section className="panel gap-pool-panel">
          <div className="section-head"><div><h3>我的 Gap 池</h3><p>三个来源统一汇总、去重并按优先级排序</p></div></div>
          <div className="gap-source-tabs">
            {GAP_TABS.map((tab) => (
              <button key={tab.key} className={gapFilter === tab.key ? 'active' : ''} onClick={() => setGapFilter(tab.key)}>
                <b>{gapCounts[tab.key]}</b><span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="gap-pool-list">
            {gapItems.length === 0 && <p>暂无个人 Gap 记录。</p>}
            {gapItems.map((item: GapPoolItem) => (
              <article key={`${item.source}-${item.title}`} data-gap-source={item.source} className={gapFilter !== 'all' && item.source !== gapFilter ? 'is-hidden' : ''}>
                <div className={`gap-source ${item.source}`}>{GAP_SOURCE_TEXT[item.source] ?? item.sourceLabel}</div>
                <div className="gap-copy">
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  {item.competencies.length > 0 && (
                    <div className="gap-comps">
                      {item.competencies.map((comp) => (
                        <span key={`${item.title}-${comp.name}`}><em>{comp.name}</em>L{comp.level}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="five-levels">
                  {[0, 1, 2, 3, 4].map((level) => {
                    const levelClass = level < item.filled ? 'filled' : level === item.target - 1 ? 'target' : '';
                    return <i key={level} className={levelClass}></i>;
                  })}
                </div>
                <b>{item.levelRange}</b><span className={`tag ${item.priority}`}>{item.priority.toUpperCase()}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel recommendation-panel">
          <div className="section-head"><div><h3>针对 Gap 的行动建议</h3><p>课程只是其中一种方式，建议同时包含学习、实践、导师反馈和可验证交付</p></div><button className="ghost idp-entry" onClick={() => navigate('idp')}>查看完整 IDP →</button></div>
          {gapActions.length === 0
            ? <div className="empty-panel" style={{ padding: '30px 20px' }}><p>当前没有未达成的能力要求，可先查看或制定个人发展计划。</p></div>
            : (
              <div className="gap-action-list">
                {gapActions.map((action: GapAction) => (
                  <article key={action.id} className={`gap-action-card kind-${action.kind}`}>
                    <span className={`gap-action-badge ${action.kind}`}>{action.badge}</span>
                    <div className="gap-action-body">
                      <h4>{action.title}</h4>
                      <p className="gap-action-detail">{action.detail}</p>
                      <p className="gap-action-gap">对应 Gap：{action.gapTitle}</p>
                    </div>
                    <div className="gap-action-side">
                      {action.effort && <small>{action.effort}</small>}
                      <button className="gap-action-cta" onClick={() => navigate('idp')}>{action.actionLabel}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>

      <section className="panel growth-curve-panel" aria-labelledby="growth-curve-title">
        <div className="growth-curve-head">
          <div><h3 id="growth-curve-title">技能点亮轨迹</h3><p>从入职第一次点亮开始保留全部轨迹；当前有效认证以技能明细为准</p></div>
          <div className="growth-curve-summary"><span>当前有效 <b>{metrics.certifiedSkillCount}</b> 项</span><span>历史累计 <b>{lastEvent?.total ?? 0}</b> 项</span></div>
          <div className="growth-range" role="tablist" aria-label="选择成长轨迹时间范围">
            {GROWTH_RANGES.map((rangeOption) => (
              <button
                key={rangeOption.key}
                className={growthRange === rangeOption.key ? 'active' : ''}
                aria-selected={growthRange === rangeOption.key}
                onClick={() => setGrowthRange(rangeOption.key)}
              >{rangeOption.label}</button>
            ))}
          </div>
        </div>
        <div className="growth-curve-layout">
          <div className="growth-chart-wrap">
            <svg className="growth-chart" viewBox="0 0 900 300" role="img" aria-label={`${currentEmployee.name}历史累计点亮技能数量变化曲线`}>
              <defs>
                <linearGradient id="growth-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6558e8" stopOpacity=".25" /><stop offset="1" stopColor="#6558e8" stopOpacity=".02" />
                </linearGradient>
                <filter id="growth-point-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <g>
                {GROWTH_GRID_VALUES.map((value) => {
                  const gridY = yFor(value);
                  return (
                    <g key={value}>
                      <line className="growth-grid-line" x1={GROWTH_CHART_LEFT} y1={gridY} x2={GROWTH_CHART_RIGHT} y2={gridY} />
                      <text className="growth-axis-label" x={45} y={gridY + 4} textAnchor="end">{value}</text>
                    </g>
                  );
                })}
                <text className="growth-axis-label" x={14} y={20}>累计技能数</text>
              </g>
              <path fill="url(#growth-area)" d={areaPath}></path>
              <path
                key={`${growthRange}-${effectiveSelectedDate}`}
                className="is-drawing"
                fill="none"
                stroke="#6558e8"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                d={linePath}
              ></path>
              <g>
                {growthPoints.map((point) => (
                  <g
                    key={point.event.date}
                    className={`growth-point ${point.event.date === effectiveSelectedDate ? 'is-selected' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.event.date}，累计点亮 ${point.event.total} 项，${point.event.title}`}
                    transform={`translate(${point.x} ${point.y})`}
                    onClick={() => setSelectedGrowthDate(point.event.date)}
                    onKeyDown={(event) => handleGrowthPointKeyDown(event, point.event.date)}
                  >
                    <circle className="point-hit" r={18}></circle>
                    <circle className="point-halo" r={12}></circle>
                    <circle className="point-core" r={5}></circle>
                    <text className="growth-value" y={-14}>{point.event.total}</text>
                  </g>
                ))}
              </g>
              <g>
                {growthPoints.map((point, index) => {
                  const show = growthPoints.length <= 9 || index % 2 === 0 || index === growthPoints.length - 1;
                  if (!show) return null;
                  return <text key={point.event.date} className="growth-axis-label" x={point.x} y={266} textAnchor="middle">{point.event.date}</text>;
                })}
              </g>
            </svg>
          </div>
          <aside className="growth-event-detail" aria-live="polite">
            {selectedEvent ? <>
            <span className="growth-event-date">{selectedEvent.date} · 正式生效</span>
            <h4>{selectedEvent.title}</h4>
            <p>{selectedEvent.note}</p>
            <dl>
              <div><dt>等级变化</dt><dd>{selectedEvent.level}</dd></div>
              <div><dt>技能分类</dt><dd>{selectedEvent.category}</dd></div>
              <div><dt>主要依据</dt><dd>{selectedEvent.evidence}</dd></div>
              <div><dt>审批人</dt><dd>{selectedEvent.approver}</dd></div>
            </dl>
            <button onClick={() => navigate('evidence')}>查看认证记录</button>
            </> : <p>暂无历史成长记录</p>}
          </aside>
        </div>
      </section>
    </section>
  );
};

export default OverviewPage;
