import { useEffect, useRef, useState } from 'react';
import { growthApi } from '@/api';
import { logger } from '@/lib/runtime';
import type {
  CareerNode,
  CareerNodeSkill,
  CareerSequenceView,
  GapListResponse,
  GapPoolItem,
  GrowthEventsResponse,
  GrowthRange,
  SkillGrowthEvent,
} from '@shared/api.interface';
import { useUI } from './ui-context';
import { useCertifications } from './certification-context';
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

const OverviewPage = () => {
  const { navigate } = useUI();
  const { readyCount } = useCertifications();
  const [sequences, setSequences] = useState<CareerSequenceView[] | null>(null);
  const [growthEvents, setGrowthEvents] = useState<SkillGrowthEvent[] | null>(null);
  const [gapItems, setGapItems] = useState<GapPoolItem[] | null>(null);
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
        if (!cancelled) setSequences(res.sequences);
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

  if (loadError) {
    return (
      <section className="page active" id="overview">
        <div className="skill-model-note"><span>{loadError}</span></div>
      </section>
    );
  }
  if (!sequences || !gapItems || !growthEvents) {
    return (
      <section className="page active" id="overview">
        <div className="skill-model-note"><span>成长数据加载中…</span></div>
      </section>
    );
  }

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
    : lastEvent.date;
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
  const areaPath = `${linePath} L ${growthPoints[growthPoints.length - 1].x} ${GROWTH_CHART_BOTTOM} L ${growthPoints[0].x} ${GROWTH_CHART_BOTTOM} Z`;

  const handleChannelChange = (next: ChannelKey): void => {
    setChannel(next);
    const nodes = nodesFor(next, sequence);
    if (nodes[1]) setSelectedNodeId(nodes[1].id);
  };

  const handleSequenceSelect = (key: SequenceKey): void => {
    setSequence(key);
    setSequenceMenuOpen(false);
    const nodes = nodesFor('tech', key);
    if (nodes[1]) setSelectedNodeId(nodes[1].id);
  };

  const handleGrowthPointKeyDown = (event: React.KeyboardEvent<SVGGElement>, date: string): void => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setSelectedGrowthDate(date);
  };

  return (
    <section className="page active" id="overview">
      <section className="profile-hero">
        <div className="profile-avatar">张</div>
        <div><h2>早上好，张三</h2><p>今天是你成长的第 1,286 天，继续加油！</p><span>持续构建可靠、易演进的平台能力。 <button aria-label="编辑个人简介">✎</button></span></div>
        <button className="hero-skill-signal" onClick={() => navigate('evidence')}>
          <i className="hero-signal-orbit" aria-hidden="true"></i><span className="hero-signal-icon">✦</span>
          <span><b><strong>{readyCount}</strong> 项技能出现点亮信号</b><small>容器与编排（K8s）依据完整度 86%，等待确认</small></span>
          <em>查看 →</em>
        </button>
        <button className="hero-add" aria-label="新增成长记录">＋</button>
      </section>

      <div className="profile-metrics">
        <article><i className="metric-icon purple">▱</i><div><span>总技能</span><strong>18</strong></div></article>
        <article><i className="metric-icon amber">▥</i><div><span>平均技能等级</span><strong>L2.8</strong></div></article>
        <article><i className="metric-icon blue">AI</i><div><span>超级员工</span><strong>L2</strong></div></article>
        <article><i className="metric-icon rose">↗</i><div><span>成长速度（近三月升级次数）</span><strong>3</strong></div></article>
      </div>

      <div className="profile-insights">
        <section className="panel radar-panel">
          <div className="section-head compact">
            <div><h3>能力结构分布</h3><p>我的水平与团队平均对比</p></div>
            <button className="radar-skill-entry" onClick={() => navigate('evidence')}>进入技能池 <span><b>{readyCount}</b> 待确认</span></button>
          </div>
          <svg className="radar-chart" viewBox="0 0 420 250" role="img" aria-label="能力结构雷达图">
            <g transform="translate(210 124)" fill="none" stroke="#d9deef">
              <polygon points="0,-92 80,-46 80,46 0,92 -80,46 -80,-46" /><polygon points="0,-69 60,-34 60,34 0,69 -60,34 -60,-34" /><polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" /><polygon points="0,-23 20,-11 20,11 0,23 -20,11 -20,-11" />
              <line x1="0" y1="0" x2="0" y2="-92" /><line x1="0" y1="0" x2="80" y2="-46" /><line x1="0" y1="0" x2="80" y2="46" /><line x1="0" y1="0" x2="0" y2="92" /><line x1="0" y1="0" x2="-80" y2="46" /><line x1="0" y1="0" x2="-80" y2="-46" />
              <polygon points="0,-73 52,-30 58,34 0,64 -62,36 -48,-28" fill="rgba(128,91,244,.20)" stroke="#8b67f6" strokeWidth="2" />
              <polygon points="0,-45 65,-37 45,26 0,48 -40,23 -30,-17" fill="rgba(73,126,242,.18)" stroke="#5790ef" strokeWidth="2" />
            </g>
            <g fill="#697386" fontSize="12" textAnchor="middle"><text x="210" y="18">研发工程能力</text><text x="345" y="79">系统设计</text><text x="346" y="186">工程质量</text><text x="210" y="239">协作与影响</text><text x="75" y="186">业务理解</text><text x="72" y="79">问题解决</text></g>
          </svg>
          <div className="chart-legend"><span><i className="legend-purple"></i>我的水平</span><span><i className="legend-blue"></i>团队平均</span></div>
        </section>
        <section className="panel maturity-panel">
          <div className="section-head compact"><div><h3>能力成熟度分布</h3><p>18 项已认证技能</p></div></div>
          <div className="donut"><div><strong>18</strong><span>项技能</span></div></div>
          <ul>
            <li><i className="dot-expert"></i><span>专家能力（L4-L5）</span><b>3</b></li>
            <li><i className="dot-core"></i><span>核心能力（L3）</span><b>7</b></li>
            <li><i className="dot-growth"></i><span>进阶能力（L1-L2）</span><b>8</b></li>
          </ul>
        </section>
        <section className="panel identity-panel">
          <div className="section-head compact"><div><h3>身份信息</h3><p>仅本人和授权管理者可见</p></div></div>
          <dl><div><dt>企业</dt><dd>示例科技集团</dd></div><div><dt>部门</dt><dd>平台研发部</dd></div><div><dt>当前岗位</dt><dd>初级软件开发工程师</dd></div><div><dt>职级</dt><dd>T1-2</dd></div><div><dt>工作地点</dt><dd>北京</dd></div></dl>
          <div className="identity-actions"><button className="primary">分享名片</button><button className="ghost">复制信息</button></div>
        </section>
      </div>

      <section className="panel career-panel">
        <div className="section-head">
          <div><h3>职业发展路线</h3><p>系统根据当前岗位、技能证据和发展偏好推荐；点击节点查看能力满足情况</p></div>
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
            if (index <= 1) classes.push('reached');
            if (index === 0) classes.push('current');
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
              return (
                <div key={skill.name} className={`node-skill ${met ? 'met' : ''}`}>
                  <div><b>{skill.name}</b><small>{category} · 当前 L{skill.current} · 要求 L{skill.target}</small></div>
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
            {gapItems.map((item: GapPoolItem) => (
              <article key={item.title} data-gap-source={item.source} className={gapFilter !== 'all' && item.source !== gapFilter ? 'is-hidden' : ''}>
                <div className={`gap-source ${item.source}`}>{item.sourceLabel}</div>
                <div className="gap-copy"><h4>{item.title}</h4><p>{item.description}</p></div>
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
          <div className="recommendation-grid">
            <article><span className="resource-label internal">新知社课程</span><h4>系统设计：从模块到架构</h4><p>对应 Gap：系统设计与模块拆分 · 建议本月完成</p><div><span>6 节 · 预计 3 小时</span><button>加入学习计划</button></div></article>
            <article><span className="resource-label external">外部资源</span><h4>Google SRE Workbook：SLO 实践</h4><p>对应 Gap：服务稳定性与 SLO 设计 · 中文导读已收录</p><div><span>文章 · 45 分钟</span><button>查看资源</button></div></article>
            <article><span className="resource-label practice">岗位实践</span><h4>负责一次核心服务 SLO 方案评审</h4><p>对应 OKR：核心服务可用性提升至 99.95%</p><div><span>证明：方案 + 评审记录</span><button>创建行动</button></div></article>
            <article><span className="resource-label mentor">导师建议</span><h4>与架构师进行 2 次方案拆解</h4><p>重点反馈：边界识别、容量预估与故障降级</p><div><span>推荐导师 3 人</span><button>查看导师</button></div></article>
          </div>
        </section>
      </div>

      <section className="panel growth-curve-panel" aria-labelledby="growth-curve-title">
        <div className="growth-curve-head">
          <div><h3 id="growth-curve-title">技能点亮轨迹</h3><p>记录正式通过审批的技能，升级和待审批申请不会提前计入曲线</p></div>
          <div className="growth-curve-summary"><span>当前已点亮 <b>18</b> 项</span><span>近 6 个月 <b>+5</b></span></div>
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
            <svg className="growth-chart" viewBox="0 0 900 300" role="img" aria-label="张三累计已点亮技能数量变化曲线">
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
          </aside>
        </div>
      </section>
    </section>
  );
};

export default OverviewPage;
