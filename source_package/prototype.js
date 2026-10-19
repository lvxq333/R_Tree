const pages = [...document.querySelectorAll('.page')];
const titleMap = {
  overview: ['成长概览', '聚焦目标、差距与下一步行动', '更新成长计划'],
  evidence: ['技能池', '查看当前技能、成长信号与点亮进度', '申请点亮技能'],
  manager: ['团队概览', '看见能力供需、梯队风险与培养动作', '导出盘点摘要'],
  approval: ['认证与复核', '核对证据与等级锚点，处理技能升级、维持与降级', '批量处理'],
  talent: ['人才搜索', '从项目需要出发，找到有依据、可协调的候选人', '保存人才需求'],
  profile: ['员工画像', '查看核心特征、能力依据与发展方向', '导出画像摘要'],
  succession: ['梯队与继任', '识别关键岗位风险，推动继任准备与培养动作', '导出梯队盘点'],
  team: ['项目组队', '按角色覆盖能力，同时检查投入与组织冲突', '保存组队方案']
};

let currentPage = 'overview';

function showPage(id) {
  currentPage = id;
  pages.forEach(page => page.classList.toggle('active', page.id === id));
  const [title, subtitle, action] = titleMap[id] || titleMap.overview;
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#page-subtitle').textContent = subtitle;
  document.querySelector('#primary-action').textContent = action;
  const managerSurface = ['manager', 'approval', 'talent', 'succession', 'team', 'profile'].includes(id);
  const lookupTrigger = document.querySelector('#employee-lookup-trigger');
  if (lookupTrigger) lookupTrigger.classList.toggle('hidden', !managerSurface);
  const freshness = document.querySelector('#data-freshness');
  if (freshness) freshness.textContent = id === 'profile' ? '画像更新于 2 天前' : '数据更新于 2 天前';
  try { window.history.replaceState(null, '', `#${id}`); } catch (error) { /* file preview may restrict history */ }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-page]');
  if (trigger) {
    if (trigger.classList.contains('nav-item')) {
      trigger.closest('nav').querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      trigger.classList.add('active');
    }
    showPage(trigger.dataset.page);
  }
});

const roleSwitch = document.querySelector('#role-switch');
const roleMenu = document.querySelector('#role-menu');
roleSwitch.addEventListener('click', () => roleMenu.classList.toggle('hidden'));
roleMenu.addEventListener('click', event => {
  const item = event.target.closest('[data-role]');
  if (!item) return;
  const manager = item.dataset.role === 'manager';
  document.querySelector('#employee-nav').classList.toggle('hidden', manager);
  document.querySelector('#manager-nav').classList.toggle('hidden', !manager);
  const currentNav = document.querySelector(manager ? '#manager-nav' : '#employee-nav');
  currentNav.querySelectorAll('.nav-item').forEach((navItem, index) => navItem.classList.toggle('active', index === 0));
  roleSwitch.firstChild.textContent = manager ? '管理者工作台 ' : '员工工作台 ';
  roleMenu.classList.add('hidden');
  document.querySelector('#employee-lookup-trigger').classList.toggle('hidden', !manager);
  showPage(manager ? 'manager' : 'overview');
});

const technicalSequences = {
  software: [
    {
      id: 'junior', code: 'T1', title: '初级软件开发工程师', meta: '当前岗位', state: '当前岗位', coverage: 92,
      description: '当前岗位基线共 6 项核心能力，5 项已满足，1 项需要复核。',
      skills: [['编程语言基础', 2, 2], ['代码质量', 2, 2], ['自动化测试', 1, 2], ['需求理解', 2, 2]]
    },
    {
      id: 'middle', code: 'T2', title: '中级软件开发工程师', meta: '推荐下一站', state: '推荐下一站', coverage: 67,
      description: '需满足 6 项核心能力，当前已满足 4 项。预计 9-12 个月可达成。',
      skills: [['Java / Go 工程化', 2, 3], ['系统设计与拆分', 1, 3], ['工程质量', 2, 3], ['跨团队协作', 3, 3]]
    },
    {
      id: 'senior', code: 'T3', title: '高级软件开发工程师', meta: '远期方向', state: '远期发展节点', coverage: 39,
      description: '该节点强调复杂系统设计、性能治理和跨团队技术影响力。',
      skills: [['分布式系统设计', 1, 4], ['性能与容量治理', 2, 4], ['技术方案决策', 2, 4], ['技术影响力', 1, 3]]
    },
    {
      id: 'expert', code: 'T4', title: '资深 / 专家工程师', meta: '长期方向', state: '长期发展节点', coverage: 18,
      description: '该节点要求形成跨业务域架构能力和组织级技术影响力。',
      skills: [['领域架构', 1, 5], ['技术战略', 1, 4], ['组织级治理', 1, 4], ['人才培养', 1, 4]]
    }
  ],
  platform: [
    {
      id: 'junior-platform', code: 'T1', title: '初级软件开发工程师', meta: '当前岗位', state: '当前岗位', coverage: 92,
      description: '从软件开发基础出发，逐步补齐平台工程与稳定性能力。',
      skills: [['编程语言基础', 2, 2], ['代码质量', 2, 2], ['自动化测试', 1, 2], ['需求理解', 2, 2]]
    },
    {
      id: 'platform-engineer', code: 'T2', title: '平台开发工程师', meta: '推荐下一站', state: '推荐下一站', coverage: 61,
      description: '需建立云平台开发、自动化交付与可观测性基础，预计 9-12 个月可达成。',
      skills: [['云平台开发', 2, 3], ['容器与编排', 1, 3], ['可观测性建设', 2, 3], ['跨团队协作', 3, 3]]
    },
    {
      id: 'senior-platform', code: 'T3', title: '高级平台工程师', meta: '远期方向', state: '远期发展节点', coverage: 34,
      description: '该节点强调平台产品设计、稳定性治理和规模化工程能力。',
      skills: [['平台产品设计', 1, 4], ['稳定性治理', 2, 4], ['成本与容量治理', 1, 4], ['技术影响力', 1, 3]]
    },
    {
      id: 'platform-architect', code: 'T4', title: '平台架构专家', meta: '长期方向', state: '长期发展节点', coverage: 15,
      description: '面向组织级基础设施架构、平台战略与工程体系建设。',
      skills: [['基础设施架构', 1, 5], ['平台技术战略', 1, 4], ['组织级治理', 1, 4], ['人才培养', 1, 4]]
    }
  ],
  ai: [
    {
      id: 'junior-ai', code: 'T1', title: '初级软件开发工程师', meta: '当前岗位', state: '当前岗位', coverage: 92,
      description: '从软件开发基础出发，逐步转向数据与 AI 应用工程方向。',
      skills: [['编程语言基础', 2, 2], ['代码质量', 2, 2], ['自动化测试', 1, 2], ['需求理解', 2, 2]]
    },
    {
      id: 'ai-engineer', code: 'T2', title: 'AI 应用开发工程师', meta: '推荐下一站', state: '推荐下一站', coverage: 55,
      description: '需掌握模型服务集成、数据处理和 AI 应用评估方法。',
      skills: [['AI 应用集成', 1, 3], ['数据处理', 2, 3], ['模型评估', 1, 3], ['产品协作', 2, 3]]
    },
    {
      id: 'senior-ai', code: 'T3', title: '高级 AI 工程师', meta: '远期方向', state: '远期发展节点', coverage: 28,
      description: '该节点强调复杂智能系统设计、模型工程和业务效果治理。',
      skills: [['智能系统设计', 1, 4], ['模型工程', 1, 4], ['数据质量治理', 2, 4], ['技术影响力', 1, 3]]
    },
    {
      id: 'ai-architect', code: 'T4', title: 'AI 架构专家', meta: '长期方向', state: '长期发展节点', coverage: 11,
      description: '面向组织级 AI 架构、技术路线与安全治理。',
      skills: [['AI 平台架构', 1, 5], ['AI 技术战略', 1, 4], ['安全与治理', 1, 4], ['人才培养', 1, 4]]
    }
  ]
};

const careerChannels = {
  management: [
    {
      id: 'junior-m', code: 'T1', title: '初级软件开发工程师', meta: '当前岗位', state: '当前岗位', coverage: 92,
      description: '先建立稳定交付和协作基础，再逐步承担项目与团队责任。',
      skills: [['任务交付', 2, 2], ['主动沟通', 2, 2], ['质量意识', 2, 2], ['复盘改进', 1, 2]]
    },
    {
      id: 'lead', code: 'M0', title: '项目技术负责人', meta: '推荐过渡节点', state: '推荐过渡节点', coverage: 58,
      description: '在不承担正式管理职责前，先验证项目规划和协同能力。',
      skills: [['项目规划', 1, 3], ['风险管理', 2, 3], ['技术决策', 2, 3], ['跨团队协同', 3, 3]]
    },
    {
      id: 'manager', code: 'M1', title: '研发经理', meta: '管理通道', state: '管理发展节点', coverage: 31,
      description: '要求具备目标管理、人员发展和资源配置能力。',
      skills: [['目标与绩效管理', 1, 3], ['人才培养', 1, 3], ['资源配置', 1, 3], ['组织沟通', 2, 3]]
    },
    {
      id: 'director', code: 'M2', title: '研发总监', meta: '长期方向', state: '长期发展节点', coverage: 12,
      description: '面向组织级技术战略、业务规划和人才梯队建设。',
      skills: [['技术战略', 1, 4], ['业务规划', 1, 4], ['组织设计', 1, 4], ['梯队建设', 1, 4]]
    }
  ]
};

let activeChannel = 'tech';
let activeSequence = 'software';
const commonSkillNames = new Set(['跨团队协作', '技术影响力', '人才培养', '任务交付', '主动沟通', '复盘改进', '项目规划', '风险管理', '目标与绩效管理', '资源配置', '组织沟通', '业务规划', '组织设计', '梯队建设']);

function getCareerNodes(channel = activeChannel) {
  return channel === 'tech' ? technicalSequences[activeSequence] : careerChannels.management;
}

function renderNodeDetail(node) {
  document.querySelector('#node-state').textContent = node.state;
  document.querySelector('#node-title').textContent = node.title;
  document.querySelector('#node-description').textContent = node.description;
  document.querySelector('#node-coverage').style.width = `${node.coverage}%`;
  document.querySelector('#node-coverage-label').textContent = `能力满足度 ${node.coverage}%`;
  document.querySelector('#node-skills').innerHTML = node.skills.map(([name, current, target]) => {
    const met = current >= target;
    const category = commonSkillNames.has(name) ? '通用技能' : '专业技能';
    return `<div class="node-skill ${met ? 'met' : ''}"><div><b>${name}</b><small>${category} · 当前 L${current} · 要求 L${target}</small></div><span>${met ? '已满足' : `Gap ${target - current} 级`}</span></div>`;
  }).join('');
}

function renderCareerRoute(channel, selectedId) {
  const nodes = getCareerNodes(channel);
  const selected = nodes.find(node => node.id === selectedId) || nodes[1];
  document.querySelector('#career-route').innerHTML = nodes.map((node, index) => {
    const classes = ['career-node'];
    if (index <= 1) classes.push('reached');
    if (index === 0) classes.push('current');
    if (node.id === selected.id) classes.push('selected');
    return `<button class="${classes.join(' ')}" data-node-id="${node.id}"><span class="node-orb">${node.code}</span><b>${node.title}</b><small>${node.meta}</small></button>`;
  }).join('');
  renderNodeDetail(selected);
}

document.querySelector('.channel-switch').addEventListener('click', event => {
  const button = event.target.closest('[data-channel]');
  if (!button) return;
  activeChannel = button.dataset.channel;
  document.querySelectorAll('[data-channel]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#sequence-picker').classList.toggle('hidden', activeChannel !== 'tech');
  const nodes = getCareerNodes(activeChannel);
  renderCareerRoute(activeChannel, nodes[1].id);
});

const sequenceTrigger = document.querySelector('#sequence-trigger');
const sequenceMenu = document.querySelector('#sequence-menu');

sequenceTrigger.addEventListener('click', () => {
  const willOpen = sequenceMenu.classList.contains('hidden');
  sequenceMenu.classList.toggle('hidden', !willOpen);
  sequenceTrigger.setAttribute('aria-expanded', String(willOpen));
});

sequenceMenu.addEventListener('click', event => {
  const button = event.target.closest('[data-sequence]');
  if (!button) return;
  activeSequence = button.dataset.sequence;
  sequenceTrigger.querySelector('span').textContent = button.querySelector('b').textContent;
  sequenceMenu.querySelectorAll('[data-sequence]').forEach(item => item.classList.toggle('active', item === button));
  sequenceMenu.classList.add('hidden');
  sequenceTrigger.setAttribute('aria-expanded', 'false');
  const nodes = getCareerNodes('tech');
  renderCareerRoute('tech', nodes[1].id);
});

document.addEventListener('click', event => {
  if (event.target.closest('#sequence-picker')) return;
  sequenceMenu.classList.add('hidden');
  sequenceTrigger.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  sequenceMenu.classList.add('hidden');
  sequenceTrigger.setAttribute('aria-expanded', 'false');
});

document.querySelector('#career-route').addEventListener('click', event => {
  const button = event.target.closest('[data-node-id]');
  if (!button) return;
  renderCareerRoute(activeChannel, button.dataset.nodeId);
});

document.querySelector('.gap-source-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-gap-filter]');
  if (!button) return;
  const filter = button.dataset.gapFilter;
  document.querySelectorAll('[data-gap-filter]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-gap-source]').forEach(item => item.classList.toggle('is-hidden', filter !== 'all' && item.dataset.gapSource !== filter));
});

const skillGrowthEvents = [
  { date: '2024.12', total: 6, title: '首次技能基线确认', category: '专业技能与通用技能', level: '6 项技能正式入池', evidence: '岗位基线盘点 + 直属经理评估', approver: '李经理、HRBP', note: '完成首次能力盘点，为后续技能成长建立可追溯基线。' },
  { date: '2025.03', total: 7, title: 'Git 协作流程', category: '专业技能 / 工程实践', level: '未点亮 → L1', evidence: '代码仓库记录 + 项目复盘', approver: '陈老师', note: '首次通过真实项目交付点亮工程实践技能。' },
  { date: '2025.06', total: 8, title: '服务问题排查', category: '专业技能 / 问题解决', level: '未点亮 → L1', evidence: '故障复盘 + 值班记录', approver: '李经理', note: '能够按标准流程定位并处理常见线上问题。' },
  { date: '2025.10', total: 10, title: '编程语言基础等 2 项', category: '专业技能 / 编程与工程化', level: '新增点亮 2 项', evidence: '项目代码 + 专家评审', approver: '陈老师', note: '在连续两个版本中独立完成核心功能交付。' },
  { date: '2025.12', total: 11, title: '需求理解', category: '通用技能 / 业务理解', level: '未点亮 → L2', evidence: '需求文档 + 验收记录', approver: '李经理', note: '能够澄清需求目标、边界和验收标准。' },
  { date: '2026.02', total: 12, title: '接口设计', category: '专业技能 / 系统设计', level: '未点亮 → L1', evidence: '接口方案 + 评审记录', approver: '陈老师', note: '完成订单域接口拆分并通过技术评审。' },
  { date: '2026.04', total: 13, title: '数据处理', category: '专业技能 / 数据与 AI', level: '未点亮 → L2', evidence: '数据管道成果 + 代码评审', approver: '陈老师', note: '形成可复用的数据清洗与质量检查流程。' },
  { date: '2026.05', total: 14, title: '技术文档', category: '通用技能 / 沟通协作', level: '未点亮 → L2', evidence: '方案文档 + 团队反馈', approver: '李经理', note: '文档可支持跨团队评审和后续实施。' },
  { date: '2026.06', total: 15, title: '可观测性', category: '专业技能 / 稳定性工程', level: '未点亮 → L2', evidence: '指标看板 + 告警运行记录', approver: '李经理', note: '为核心服务补齐指标、日志和基础告警。' },
  { date: '2026.07', total: 16, title: '容量评估', category: '专业技能 / 系统设计', level: '未点亮 → L1', evidence: '压测报告 + 容量方案', approver: '陈老师', note: '完成核心链路容量预估与风险说明。' },
  { date: '2026.08', total: 17, title: '代码质量', category: '专业技能 / 工程质量', level: '未点亮 → L2', evidence: '重构成果 + 专家评审', approver: '陈老师', note: '形成持续可执行的代码质量检查方式。' },
  { date: '2026.09', total: 18, title: '技术方案表达', category: '通用技能 / 沟通协作', level: '未点亮 → L2', evidence: '方案答辩 + 直属经理评估', approver: '李经理', note: '能够清晰说明方案目标、关键取舍与实施风险。' }
];

let growthRange = '12m';
let selectedGrowthDate = '2026.09';

function visibleGrowthEvents() {
  if (growthRange === '6m') return skillGrowthEvents.slice(-6);
  if (growthRange === '12m') return skillGrowthEvents.slice(-9);
  return skillGrowthEvents;
}

function growthCurvePath(points) {
  if (!points.length) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function renderGrowthDetail(eventItem) {
  document.querySelector('#growth-event-detail').innerHTML = `
    <span class="growth-event-date">${eventItem.date} · 正式生效</span>
    <h4>${eventItem.title}</h4>
    <p>${eventItem.note}</p>
    <dl><div><dt>等级变化</dt><dd>${eventItem.level}</dd></div><div><dt>技能分类</dt><dd>${eventItem.category}</dd></div><div><dt>主要依据</dt><dd>${eventItem.evidence}</dd></div><div><dt>审批人</dt><dd>${eventItem.approver}</dd></div></dl>
    <button data-page="evidence">查看认证记录</button>
  `;
}

function renderGrowthCurve() {
  const events = visibleGrowthEvents();
  if (!events.some(item => item.date === selectedGrowthDate)) selectedGrowthDate = events[events.length - 1].date;
  const left = 58;
  const right = 862;
  const top = 34;
  const bottom = 238;
  const xStep = events.length > 1 ? (right - left) / (events.length - 1) : 0;
  const yFor = value => bottom - (value / 20) * (bottom - top);
  const points = events.map((item, index) => ({ ...item, x: left + index * xStep, y: yFor(item.total) }));
  const linePath = growthCurvePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  document.querySelector('#growth-grid').innerHTML = [5, 10, 15, 20].map(value => {
    const y = yFor(value);
    return `<line class="growth-grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line><text class="growth-axis-label" x="45" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('') + `<text class="growth-axis-label" x="14" y="20">累计技能数</text>`;
  document.querySelector('#growth-area-path').setAttribute('d', areaPath);
  const line = document.querySelector('#growth-line-path');
  line.setAttribute('d', linePath);
  line.classList.remove('is-drawing');
  void line.getBoundingClientRect();
  line.classList.add('is-drawing');
  document.querySelector('#growth-points').innerHTML = points.map(point => `
    <g class="growth-point ${point.date === selectedGrowthDate ? 'is-selected' : ''}" data-growth-date="${point.date}" tabindex="0" role="button" aria-label="${point.date}，累计点亮 ${point.total} 项，${point.title}" transform="translate(${point.x} ${point.y})">
      <circle class="point-hit" r="18"></circle><circle class="point-halo" r="12"></circle><circle class="point-core" r="5"></circle><text class="growth-value" y="-14">${point.total}</text>
    </g>
  `).join('');
  document.querySelector('#growth-labels').innerHTML = points.map((point, index) => {
    const show = points.length <= 9 || index % 2 === 0 || index === points.length - 1;
    return show ? `<text class="growth-axis-label" x="${point.x}" y="266" text-anchor="middle">${point.date}</text>` : '';
  }).join('');
  renderGrowthDetail(events.find(item => item.date === selectedGrowthDate));
}

document.querySelector('.growth-range').addEventListener('click', event => {
  const button = event.target.closest('[data-growth-range]');
  if (!button) return;
  growthRange = button.dataset.growthRange;
  document.querySelectorAll('[data-growth-range]').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
  renderGrowthCurve();
});

document.querySelector('#growth-points').addEventListener('click', event => {
  const point = event.target.closest('[data-growth-date]');
  if (!point) return;
  selectedGrowthDate = point.dataset.growthDate;
  renderGrowthCurve();
});

document.querySelector('#growth-points').addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key)) return;
  const point = event.target.closest('[data-growth-date]');
  if (!point) return;
  event.preventDefault();
  selectedGrowthDate = point.dataset.growthDate;
  renderGrowthCurve();
});

renderGrowthCurve();

renderCareerRoute(activeChannel, 'middle');

function certifiedSkill(id, title, category, level, sourceLabel, approvedAt, anchor) {
  return {
    id, title, category, currentLevel: level, targetLevel: level, source: 'verified', sourceShort: '已亮', sourceLabel,
    confidence: 100, status: 'approved', statusLabel: '已点亮',
    explanation: `该技能已通过人工审批并正式点亮，最近一次认证生效于 ${approvedAt}。`,
    anchor,
    evidence: [
      ['认证', `${title} L${level} 审批记录`, `${approvedAt} · 正式生效`],
      ['来源', sourceLabel, '原始证明与审核意见已归档']
    ]
  };
}

const certificationItems = [
  {
    id: 'k8s',
    source: 'worklog',
    sourceShort: '事实',
    sourceLabel: '事实中心 · 日报 / 工时',
    title: '容器与编排（K8s）',
    category: '专业技能 / 云原生基础设施',
    currentLevel: 1,
    targetLevel: 2,
    confidence: 86,
    status: 'ready',
    statusLabel: '待我确认',
    explanation: '事实中心在最近 60 天的日报、工时与项目协作记录中识别到持续的 K8s 实践，建议你核对后申请 L2。',
    anchor: '能够独立完成常规服务的部署、配置排查与发布回滚，并能说明关键配置的作用。',
    evidence: [
      ['工时', '云平台改造专项 · 累计投入 46 小时', '2026-07-14 至 2026-09-12 · 工时系统'],
      ['成果', '支付服务 K8s 部署方案 v1.3', '含部署清单、资源配置与回滚方案'],
      ['协作', '在项目群中完成 8 次部署问题答疑', '仅提取与技能判断相关的公开协作记录']
    ]
  },
  {
    id: 'system-design',
    source: 'performance',
    sourceShort: '绩效',
    sourceLabel: '事实中心 · 绩效成果',
    title: '系统设计与模块拆分',
    category: '专业技能 / 系统设计',
    currentLevel: 1,
    targetLevel: 2,
    confidence: 79,
    status: 'ready',
    statusLabel: '待我确认',
    explanation: '系统从 2026 上半年绩效考核提交的成果物中识别出架构设计证据。绩效结果只是佐证，仍需你确认并提交审批。',
    anchor: '能够在明确边界下拆分中等复杂度模块，说明接口、数据流与异常处理，并通过方案评审。',
    evidence: [
      ['成果', '订单路由模块重构方案', '2026 H1 绩效成果物 · 文档已归档'],
      ['结果', '上线后故障定位耗时下降 31%', '指标来自绩效成果说明，待审批人复核口径'],
      ['评语', '具备独立拆分模块与推动评审的能力', '直属管理者绩效评语节选']
    ]
  },
  {
    id: 'testing',
    source: 'manual',
    sourceShort: '自证',
    sourceLabel: '员工主动申请',
    title: '自动化测试与质量门禁',
    category: '专业技能 / 工程质量',
    currentLevel: 1,
    targetLevel: 2,
    confidence: 64,
    status: 'returned',
    statusLabel: '待补充',
    explanation: '你已提交培训证书与考试成绩。审核人希望补充一次真实项目中的质量门禁配置，证明能力已用于工作场景。',
    anchor: '能够为常规服务设计自动化测试，并在持续集成流程中配置覆盖率或质量门禁。',
    evidence: [
      ['培训', '质量工程训练营结业证书', '2026-08-30 · 已核验'],
      ['考试', '结业考试 92 分', '覆盖单元测试、集成测试与质量门禁'],
      ['待补', '真实项目配置或运行记录', '审核人：请补充仓库链接与一次门禁运行结果']
    ]
  },
  {
    id: 'collaboration',
    source: 'performance',
    sourceShort: '绩效',
    sourceLabel: '事实中心 · 绩效成果',
    title: '跨团队协作',
    category: '通用技能 / 沟通协作',
    currentLevel: 2,
    targetLevel: 3,
    confidence: 83,
    status: 'pending',
    statusLabel: '审批中',
    explanation: '你已确认 2026 上半年绩效成果中的协作证据并发起申请，目前由直属管理者审批。',
    anchor: '能够协调多个团队解决目标冲突，形成明确决策并推动关键事项按约定交付。',
    evidence: [
      ['成果', '牵头支付链路跨团队专项', '协调 4 个团队，按期完成 6 个接口改造'],
      ['记录', '专项周会纪要与决策清单', '共 7 次会议，关键决策均有责任人与期限'],
      ['反馈', '合作方满意度 4.7 / 5', '来自半年度协作反馈']
    ]
  },
  certifiedSkill('programming', '编程语言基础', '专业技能 / 编程与工程化', 2, '项目成果 + 专家评审', '2026-07-18', '能够独立完成常规功能开发，遵循团队编码规范并处理常见异常。'),
  certifiedSkill('code-quality', '代码质量', '专业技能 / 工程质量', 2, '项目成果 + 专家评审', '2026-08-28', '能够识别常见代码质量问题，完成重构并通过团队质量检查。'),
  {
    id: 'requirements', source: 'lifecycle', sourceShort: '复核', sourceLabel: '技能生命周期 · 长期未使用',
    title: '需求理解', category: '通用技能 / 业务理解', currentLevel: 3, targetLevel: 2,
    confidence: 38, status: 'review', statusLabel: '待复核', deadline: '2026-09-26',
    explanation: '过去 12 个月未发现可核验的需求分析工作或相关产出，系统按规则生成复核提醒。当前 L3 仍然有效，本提醒不会自动降低等级。',
    anchor: 'L3 要求能够在复杂业务场景中澄清目标与边界，识别跨模块风险，并推动相关方形成一致验收标准。',
    evidence: [
      ['规则', '连续 12 个月无相关工作记录', '规则版本：业务理解类技能 v2.1'],
      ['最近', '会员增长需求拆解与验收方案', '2025-08-18 · 已通过直属经理确认'],
      ['例外', '可说明岗位调整或暂无实践机会', '复核期间保留当前正式等级 L3']
    ]
  },
  certifiedSkill('observability', '可观测性', '专业技能 / 稳定性工程', 2, '项目成果 + 运行记录', '2026-07-29', '能够为单个服务配置指标、日志与基础告警，并完成常见问题定位。'),
  certifiedSkill('data-processing', '数据处理', '专业技能 / 数据与 AI', 2, '项目成果 + 代码评审', '2026-05-21', '能够完成常规数据清洗、转换与质量检查，产出可复用处理流程。'),
  certifiedSkill('communication', '技术方案表达', '通用技能 / 沟通协作', 2, '方案答辩 + 直属经理评估', '2026-08-06', '能够清晰说明技术方案的目标、关键取舍与实施风险。')
];

const approvalItems = [
  {
    id: 'review-requirements', linkedId: 'requirements', kind: 'downgrade', applicant: '张三', avatar: '张', department: '平台研发部 · T1-2',
    title: '需求理解', currentLevel: 3, targetLevel: 2, sourceLabel: '长期未使用复核', submittedAt: '今天 09:10', due: '09-26', status: 'pending',
    detail: '系统发现该技能连续 12 个月没有新的相关工作或可核验产出。无新记录仅代表证据新鲜度下降，请结合员工补充说明判断是否维持、延长观察或降至 L2。',
    anchor: 'L3 要求能够在复杂业务场景中澄清目标与边界，识别跨模块风险，并推动相关方形成一致验收标准。'
  },
  {
    id: 'approval-collaboration', linkedId: 'collaboration', applicant: '张三', avatar: '张', department: '平台研发部 · T1-2',
    title: '跨团队协作', currentLevel: 2, targetLevel: 3, sourceLabel: '绩效成果识别', submittedAt: '今天 10:24', due: '09-17', status: 'pending'
  },
  {
    id: 'approval-observability', applicant: '林晓', avatar: '林', department: '平台研发部 · T3',
    title: '可观测性建设', currentLevel: 2, targetLevel: 3, sourceLabel: '员工主动申请', submittedAt: '昨天 16:40', due: '09-16', status: 'pending',
    detail: '申请人提交了指标体系设计、告警降噪结果和复盘记录。建议重点核对是否达到 L3 的跨服务治理范围。'
  },
  {
    id: 'approval-automation', applicant: '周晨', avatar: '周', department: '基础架构部 · T2',
    title: '自动化运维开发', currentLevel: 1, targetLevel: 2, sourceLabel: '日报 / 工时识别', submittedAt: '09-14 18:05', due: '09-18', status: 'pending',
    detail: '事实中心识别到连续 8 周的自动化脚本交付和工时投入。申请人已确认其中 3 项成果可用于本次认证。'
  }
];

let selectedCertificationId = 'k8s';
let certificationFilter = 'all';
let selectedApprovalId = approvalItems[0].id;
let selectedGalaxyNode = 'requirements';
let toastTimer;

const galaxySkillMeta = {
  slo: { title: '服务稳定性与 SLO 设计', category: '平台工程', currentLevel: 0, targetLevel: 2, status: 'unlit', statusLabel: '未点亮', explanation: '尚未发现足够证据。完成一次服务 SLO 方案设计与评审后可主动申请。' },
  automation: { title: '自动化运维', category: '平台工程', currentLevel: 0, targetLevel: 2, status: 'unlit', statusLabel: '未点亮', explanation: '尚未点亮。可提交自动化脚本、应用范围和效率改善结果作为证明。' },
  'ai-integration': { title: 'AI 应用集成', category: '数据与 AI', currentLevel: 0, targetLevel: 2, status: 'unlit', statusLabel: '未点亮', explanation: '尚未点亮。完成可运行的模型服务集成并提供评估结果后可申请。' },
  'model-evaluation': { title: '模型评估', category: '数据与 AI', currentLevel: 0, targetLevel: 2, status: 'unlit', statusLabel: '未点亮', explanation: '尚未点亮。建议先完成一套包含指标、样本和误差分析的评估方案。' }
};

const galaxyView = { tiltX: 0, tiltY: 0, zoom: 1, dragging: false, startX: 0, startY: 0, moved: false };
const galaxyStage = document.querySelector('.galaxy-stage');
const galaxyCamera = document.querySelector('#galaxy-camera');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function statusClass(status) {
  if (status === 'pending') return 'pending';
  if (status === 'review' || status === 'review_submitted') return 'review';
  if (status === 'returned' || status === 'rejected') return 'returned';
  if (status === 'approved') return 'approved';
  return '';
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function getGalaxySkill(id) {
  return certificationItems.find(item => item.id === id) || galaxySkillMeta[id];
}

function renderGalaxySelection() {
  const skill = getGalaxySkill(selectedGalaxyNode);
  if (!skill) return;
  const actionLabel = skill.status === 'approved'
    ? '查看认证记录'
    : skill.status === 'review' || skill.status === 'review_submitted'
      ? '查看复核详情'
    : skill.status === 'pending'
      ? '查看审批进度'
      : skill.status === 'returned'
        ? '补充证明'
        : skill.status === 'ready'
          ? '查看点亮建议'
          : '申请点亮';
  const levelText = skill.status === 'approved' ? `L${skill.targetLevel} · 已点亮` : skill.status === 'review' || skill.status === 'review_submitted' ? `L${skill.currentLevel} · 待复核` : skill.currentLevel ? `L${skill.currentLevel} → L${skill.targetLevel}` : `目标 L${skill.targetLevel}`;
  document.querySelector('#galaxy-selection').innerHTML = `
    <div><b>${skill.title}</b><small>${skill.category} · ${levelText}</small></div>
    <p>${skill.explanation}</p>
    <button data-galaxy-action="${certificationItems.some(item => item.id === selectedGalaxyNode) ? 'open-detail' : 'apply'}">${actionLabel}</button>
  `;
}

function highlightSkillConnections(id) {
  const neighbors = new Set();
  document.querySelectorAll('.constellation-lines line, .constellation-tail').forEach(line => {
    const connected = line.dataset.from === id || line.dataset.to === id;
    line.classList.toggle('is-connected', connected);
    if (connected) neighbors.add(line.dataset.from === id ? line.dataset.to : line.dataset.from);
  });
  document.querySelectorAll('[data-skill-node]').forEach(node => node.classList.toggle('is-neighbor', neighbors.has(node.dataset.skillNode)));
}

function syncGalaxyMap() {
  document.querySelectorAll('[data-skill-node]').forEach(node => {
    const skill = getGalaxySkill(node.dataset.skillNode);
    if (!skill) return;
    node.dataset.status = skill.status;
    node.classList.toggle('is-lit', skill.status === 'approved');
    node.classList.toggle('is-pending', skill.status === 'pending');
    node.classList.toggle('is-review', skill.status === 'review' || skill.status === 'review_submitted');
    node.classList.toggle('is-returned', skill.status === 'returned' || skill.status === 'rejected');
    node.classList.toggle('is-unlit', !['approved', 'pending', 'review', 'review_submitted', 'returned', 'rejected'].includes(skill.status));
    node.classList.toggle('is-selected', node.dataset.skillNode === selectedGalaxyNode);
    const level = node.querySelector('.star-level');
    if (level) level.textContent = skill.status === 'approved' ? `L${skill.targetLevel} · 已点亮` : skill.status === 'pending' ? '审批中' : skill.status === 'review' ? `L${skill.currentLevel} · 待复核` : skill.status === 'review_submitted' ? `L${skill.currentLevel} · 已补证` : skill.status === 'returned' ? '待补充' : skill.status === 'ready' ? '有新建议' : '未点亮';
  });
  renderGalaxySelection();
  highlightSkillConnections(selectedGalaxyNode);
}

function selectSkillTrack(track) {
  document.querySelectorAll('[data-skill-track]').forEach(button => {
    button.classList.toggle('active', button.dataset.skillTrack === track);
    button.setAttribute('aria-selected', String(button.dataset.skillTrack === track));
  });
  document.querySelectorAll('[data-skill-node]').forEach(node => {
    const tracks = node.dataset.track.split(' ');
    node.classList.toggle('is-dimmed', track !== 'all' && !tracks.includes(track));
  });
  document.querySelectorAll('.constellation-lines [data-track], .constellation-tail').forEach(line => {
    const tracks = line.dataset.track.split(' ');
    line.classList.toggle('is-dimmed', track !== 'all' && !tracks.includes(track));
    line.classList.toggle('is-active-track', track !== 'all' && tracks.includes(track));
  });
}

document.querySelector('.sequence-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-skill-track]');
  if (!button) return;
  selectSkillTrack(button.dataset.skillTrack);
});

document.querySelector('.constellation-map').addEventListener('click', event => {
  const node = event.target.closest('[data-skill-node]');
  if (!node) return;
  selectedGalaxyNode = node.dataset.skillNode;
  syncGalaxyMap();
});

document.querySelector('.constellation-map').addEventListener('pointerover', event => {
  const node = event.target.closest('[data-skill-node]');
  if (node) highlightSkillConnections(node.dataset.skillNode);
});

document.querySelector('.constellation-map').addEventListener('pointerout', event => {
  const node = event.target.closest('[data-skill-node]');
  if (node && !node.contains(event.relatedTarget)) highlightSkillConnections(selectedGalaxyNode);
});

document.querySelector('.constellation-map').addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key)) return;
  const node = event.target.closest('[data-skill-node]');
  if (!node) return;
  event.preventDefault();
  selectedGalaxyNode = node.dataset.skillNode;
  syncGalaxyMap();
});

document.querySelector('#galaxy-selection').addEventListener('click', event => {
  const action = event.target.closest('[data-galaxy-action]')?.dataset.galaxyAction;
  if (!action) return;
  const skill = getGalaxySkill(selectedGalaxyNode);
  if (action === 'open-detail') {
    certificationFilter = 'all';
    selectedCertificationId = selectedGalaxyNode;
    document.querySelectorAll('[data-cert-filter]').forEach(button => button.classList.toggle('active', button.dataset.certFilter === 'all'));
    renderCertificationList();
    document.querySelector('.certification-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    const select = document.querySelector('#self-skill');
    const option = [...select.options].find(entry => entry.textContent === skill.title);
    if (option) select.value = option.value;
    setSelfApplication(true);
  }
});

document.querySelector('#galaxy-help').addEventListener('click', event => {
  const legend = document.querySelector('#map-legend');
  legend.classList.toggle('is-emphasized');
  event.currentTarget.textContent = legend.classList.contains('is-emphasized') ? '已突出图例' : '图例说明';
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyGalaxyView() {
  galaxyCamera.style.setProperty('--tilt-x', `${galaxyView.tiltX}deg`);
  galaxyCamera.style.setProperty('--tilt-y', `${galaxyView.tiltY}deg`);
  galaxyCamera.style.setProperty('--zoom', galaxyView.zoom.toFixed(2));
}

function setGalaxyCruise(active) {
  const cruise = active && !reducedMotion.matches;
  galaxyCamera.classList.toggle('is-cruising', cruise);
  const button = document.querySelector('[data-galaxy-control="cruise"]');
  button.classList.toggle('active', cruise);
  button.setAttribute('aria-pressed', String(cruise));
  button.textContent = cruise ? '暂停巡航' : '自动巡航';
}

function stopGalaxyCruise() {
  setGalaxyCruise(false);
}

galaxyStage.addEventListener('pointerdown', event => {
  if (event.target.closest('button, [data-skill-node]')) return;
  stopGalaxyCruise();
  galaxyView.dragging = true;
  galaxyView.moved = false;
  galaxyView.startX = event.clientX;
  galaxyView.startY = event.clientY;
  galaxyCamera.classList.add('is-dragging');
  galaxyStage.setPointerCapture(event.pointerId);
});

galaxyStage.addEventListener('pointermove', event => {
  if (!galaxyView.dragging) return;
  const deltaX = event.clientX - galaxyView.startX;
  const deltaY = event.clientY - galaxyView.startY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 2) galaxyView.moved = true;
  galaxyView.tiltY = clamp(galaxyView.tiltY + deltaX * .08, -18, 18);
  galaxyView.tiltX = clamp(galaxyView.tiltX - deltaY * .06, -12, 12);
  galaxyView.startX = event.clientX;
  galaxyView.startY = event.clientY;
  applyGalaxyView();
});

function endGalaxyDrag(event) {
  if (!galaxyView.dragging) return;
  galaxyView.dragging = false;
  galaxyCamera.classList.remove('is-dragging');
  if (galaxyStage.hasPointerCapture(event.pointerId)) galaxyStage.releasePointerCapture(event.pointerId);
}

galaxyStage.addEventListener('pointerup', endGalaxyDrag);
galaxyStage.addEventListener('pointercancel', endGalaxyDrag);

galaxyStage.addEventListener('wheel', event => {
  event.preventDefault();
  stopGalaxyCruise();
  galaxyView.zoom = clamp(galaxyView.zoom + (event.deltaY < 0 ? .08 : -.08), .82, 1.34);
  applyGalaxyView();
}, { passive: false });

document.querySelector('.galaxy-controls').addEventListener('click', event => {
  const control = event.target.closest('[data-galaxy-control]')?.dataset.galaxyControl;
  if (!control) return;
  if (control === 'cruise') {
    setGalaxyCruise(!galaxyCamera.classList.contains('is-cruising'));
    return;
  }
  stopGalaxyCruise();
  if (control === 'zoom-in') galaxyView.zoom = clamp(galaxyView.zoom + .1, .82, 1.34);
  if (control === 'zoom-out') galaxyView.zoom = clamp(galaxyView.zoom - .1, .82, 1.34);
  if (control === 'reset') Object.assign(galaxyView, { tiltX: 0, tiltY: 0, zoom: 1 });
  applyGalaxyView();
});

if (reducedMotion.matches) setGalaxyCruise(false);

function updateCertificationCounts() {
  const counts = certificationItems.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  document.querySelector('#ready-count').textContent = counts.ready || 0;
  document.querySelector('#pending-count').textContent = counts.pending || 0;
  document.querySelector('#review-count').textContent = (counts.review || 0) + (counts.review_submitted || 0);
  document.querySelector('#returned-count').textContent = counts.returned || 0;
  document.querySelector('#approved-count').textContent = counts.approved || 0;
  document.querySelector('#evidence-nav-count').textContent = counts.ready || 0;
  const readyItems = certificationItems.filter(item => item.status === 'ready').sort((a, b) => b.confidence - a.confidence);
  const heroSignal = document.querySelector('#hero-skill-signal');
  document.querySelector('#overview-signal-count').textContent = readyItems.length;
  document.querySelector('#radar-signal-count').textContent = readyItems.length;
  heroSignal.classList.toggle('is-clear', readyItems.length === 0);
  if (readyItems.length) {
    document.querySelector('#overview-signal-copy').textContent = `${readyItems[0].title}依据完整度 ${readyItems[0].confidence}%，等待确认`;
  } else {
    document.querySelector('#overview-signal-copy').textContent = '暂无待确认建议，点击查看完整技能地图';
  }
  syncGalaxyMap();
}

function renderCertificationList() {
  const visibleItems = certificationItems.filter(item => certificationFilter === 'all' || (certificationFilter === 'approved' ? item.status === 'approved' : certificationFilter === 'review' ? ['review', 'review_submitted'].includes(item.status) : item.source === certificationFilter));
  const list = document.querySelector('#cert-list');
  if (!visibleItems.length) {
    list.innerHTML = '<div class="cert-empty">当前来源下没有待处理记录</div>';
    return;
  }
  if (!visibleItems.some(item => item.id === selectedCertificationId)) selectedCertificationId = visibleItems[0].id;
  list.innerHTML = visibleItems.map(item => `
    <button class="cert-item ${item.id === selectedCertificationId ? 'active' : ''}" data-cert-id="${item.id}">
      <i class="source-icon ${item.source}">${item.sourceShort}</i>
      <span><b>${item.title}</b><small>${item.sourceLabel} · ${item.category}</small><span class="item-meta"><span>${item.status === 'approved' ? `L${item.targetLevel} · 已点亮` : ['review', 'review_submitted'].includes(item.status) ? `当前 L${item.currentLevel} · 拟调整 L${item.targetLevel}` : `L${item.currentLevel} → L${item.targetLevel}`}</span><span>${item.status === 'approved' ? '人工审批已通过' : ['review', 'review_submitted'].includes(item.status) ? `复核截止 ${item.deadline}` : `依据可信度 ${item.confidence}%`}</span></span></span>
      <em class="status-pill ${statusClass(item.status)}">${item.statusLabel}</em>
    </button>
  `).join('');
  renderCertificationDetail();
  updateCertificationCounts();
}

function renderCertificationDetail() {
  const item = certificationItems.find(entry => entry.id === selectedCertificationId);
  if (!item) return;
  const actions = item.status === 'ready'
    ? '<span class="detail-note">提交后进入管理者或 HR 审批</span><button class="ghost" data-cert-action="dismiss">暂不申请</button><button class="primary" data-cert-action="submit">发起点亮申请</button>'
    : item.status === 'review'
      ? '<span class="detail-note">复核完成前仍按当前 L3 参与计算</span><button class="ghost" data-cert-action="explain">说明暂无实践机会</button><button class="primary" data-cert-action="add-evidence">补充近期成果</button>'
      : item.status === 'review_submitted'
        ? '<span class="detail-note">已补充说明，当前等级保持有效</span><button class="ghost" disabled>等待复核</button>'
    : item.status === 'returned'
      ? '<span class="detail-note">请按审核意见补充证明</span><button class="primary" data-cert-action="resubmit">补充并重新提交</button>'
      : item.status === 'pending'
        ? '<span class="detail-note">已提交，审批通过前不会修改正式等级</span><button class="ghost" disabled>等待审批</button>'
        : '<span class="detail-note">该技能等级已正式生效</span>';
  const isReview = ['review', 'review_submitted'].includes(item.status);
  document.querySelector('#cert-detail').innerHTML = `
    <div class="detail-titlebar"><div><h3>${item.title}</h3><p>${item.sourceLabel} · ${item.category}</p></div><strong class="level-change">${item.status === 'approved' ? `L${item.targetLevel} 已点亮` : `L${item.currentLevel} → L${item.targetLevel}`}</strong></div>
    <div class="source-explanation ${isReview ? 'review-explanation' : ''}"><b>${item.status === 'approved' ? '认证说明：' : isReview ? '为什么需要复核：' : '为什么推荐：'}</b>${item.explanation}</div>
    ${isReview ? `<dl class="review-deadline"><div><dt>当前正式等级</dt><dd>L${item.currentLevel}，复核期间有效</dd></div><div><dt>拟调整等级</dt><dd>L${item.targetLevel}</dd></div><div><dt>复核截止</dt><dd>${item.deadline}</dd></div></dl>` : `<div class="confidence-row"><span>依据完整度</span><i><span style="width:${item.confidence}%"></span></i><strong>${item.confidence}%</strong></div>`}
    <section class="evidence-section"><h4>${isReview ? '触发依据与最近记录' : '本次申请依据'}</h4>${item.evidence.map(([type, title, meta]) => `<div class="evidence-entry"><span>${type}</span><div><b>${title}</b><small>${meta}</small></div></div>`).join('')}</section>
    <section class="anchor-section"><h4>${isReview ? `当前 L${item.currentLevel} 行为锚点` : `L${item.targetLevel} 行为锚点`}</h4><p>${item.anchor}</p></section>
    <div class="detail-actions">${actions}</div>
  `;
}

function addApprovalFromCertification(item) {
  if (approvalItems.some(entry => entry.linkedId === item.id && entry.status === 'pending')) return;
  approvalItems.unshift({
    id: `approval-${item.id}-${Date.now()}`,
    linkedId: item.id,
    applicant: '张三',
    avatar: '张',
    department: '平台研发部 · T1-2',
    title: item.title,
    currentLevel: item.currentLevel,
    targetLevel: item.targetLevel,
    sourceLabel: item.sourceLabel,
    submittedAt: '刚刚',
    due: '09-19',
    status: 'pending'
  });
  selectedApprovalId = approvalItems[0].id;
  renderApprovalQueue();
}

document.querySelector('.cert-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-cert-filter]');
  if (!button) return;
  certificationFilter = button.dataset.certFilter;
  document.querySelectorAll('[data-cert-filter]').forEach(item => item.classList.toggle('active', item === button));
  renderCertificationList();
});

document.querySelector('[data-cert-filter-shortcut="review"]').addEventListener('click', () => {
  certificationFilter = 'review';
  document.querySelectorAll('[data-cert-filter]').forEach(button => button.classList.toggle('active', button.dataset.certFilter === 'review'));
  renderCertificationList();
  document.querySelector('.certification-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#cert-list').addEventListener('click', event => {
  const button = event.target.closest('[data-cert-id]');
  if (!button) return;
  selectedCertificationId = button.dataset.certId;
  renderCertificationList();
});

document.querySelector('#cert-detail').addEventListener('click', event => {
  const action = event.target.closest('[data-cert-action]')?.dataset.certAction;
  if (!action) return;
  const item = certificationItems.find(entry => entry.id === selectedCertificationId);
  if (action === 'add-evidence' || action === 'explain') {
    item.status = 'review_submitted';
    item.statusLabel = '已补充';
    item.explanation = action === 'add-evidence'
      ? '你已补充近期需求澄清与验收记录，材料已进入人工复核。复核完成前当前 L3 保持有效。'
      : '你已说明近期岗位暂无对应实践机会，管理者将在复核时一并考虑。当前 L3 保持有效。';
    item.evidence.push(action === 'add-evidence'
      ? ['补证', '支付平台需求澄清与验收记录', '员工补充 · 刚刚提交']
      : ['说明', '近期岗位暂无复杂需求分析任务', '员工说明 · 刚刚提交']);
    const linkedReview = approvalItems.find(entry => entry.linkedId === item.id && entry.kind === 'downgrade');
    if (linkedReview) linkedReview.employeeResponse = action === 'add-evidence' ? '已补充近期成果' : '已提交暂无实践机会说明';
    showToast(action === 'add-evidence' ? '近期成果已提交，复核期间当前等级保持有效。' : '情况说明已提交，管理者会在复核时一并查看。');
    renderCertificationList();
    renderApprovalQueue();
    return;
  }
  if (action === 'dismiss') {
    item.statusLabel = '已忽略';
    item.status = 'dismissed';
    showToast('已暂不申请，你之后仍可从历史建议中恢复。');
  } else {
    item.status = 'pending';
    item.statusLabel = '审批中';
    item.explanation = action === 'resubmit' ? '你已根据审核意见补充证明并重新提交，目前等待审批。' : '你已核对系统整理的依据并发起申请，目前等待审批。';
    addApprovalFromCertification(item);
    showToast('点亮申请已提交，审批通过后技能等级才会正式生效。');
  }
  renderCertificationList();
});

function setSelfApplication(open) {
  const panel = document.querySelector('#self-application');
  panel.classList.toggle('hidden', !open);
  if (open) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelector('#open-self-application').addEventListener('click', () => setSelfApplication(true));
document.querySelector('#close-self-application').addEventListener('click', () => setSelfApplication(false));
document.querySelector('#primary-action').addEventListener('click', () => {
  if (currentPage === 'evidence') setSelfApplication(true);
  if (currentPage === 'talent') showToast('人才需求已保存，可继续调整条件或维护候选清单。');
  if (currentPage === 'succession') showToast('梯队盘点摘要已生成，包含岗位风险、候选差距和培养动作。');
  if (currentPage === 'team') showToast('组队方案已保存为草稿。');
});

document.querySelector('#self-application-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = document.querySelector('#self-skill').value;
  const level = Number(document.querySelector('#self-level').value);
  const evidenceType = document.querySelector('#self-evidence-type').value;
  const evidenceTitle = document.querySelector('#self-evidence-title').value.trim();
  const evidenceLink = document.querySelector('#self-evidence-link').value.trim();
  const note = document.querySelector('#self-note').value.trim();
  const item = {
    id: `manual-${Date.now()}`,
    source: 'manual', sourceShort: '自证', sourceLabel: '员工主动申请', title,
    category: '专业技能 / 员工选择', currentLevel: Math.max(0, level - 1), targetLevel: level,
    confidence: 72, status: 'pending', statusLabel: '审批中',
    explanation: '你已主动提交点亮申请。系统只校验证明是否完整，最终等级由管理者或 HR 依据行为锚点确认。',
    anchor: `达到 L${level} 对应的行为锚点，并能在真实工作或考核场景中提供可复核的成果。`,
    evidence: [[evidenceType.slice(0, 2), evidenceTitle, evidenceLink], ['说明', note || '未填写补充说明', '员工提交']]
  };
  certificationItems.unshift(item);
  selectedCertificationId = item.id;
  certificationFilter = 'all';
  document.querySelectorAll('[data-cert-filter]').forEach(button => button.classList.toggle('active', button.dataset.certFilter === 'all'));
  addApprovalFromCertification(item);
  renderCertificationList();
  setSelfApplication(false);
  showToast('主动申请已提交，当前状态为“审批中”。');
});

function pendingApprovals() {
  return approvalItems.filter(item => item.status === 'pending');
}

function renderApprovalQueue() {
  const items = pendingApprovals();
  const count = items.length;
  document.querySelector('#approval-nav-count').textContent = count;
  document.querySelector('#approval-pending-count').textContent = count;
  const list = document.querySelector('#approval-list');
  if (!items.length) {
    list.innerHTML = '<div class="approval-empty"><strong>待审批已处理完</strong><span>新的申请会出现在这里</span></div>';
    document.querySelector('#approval-detail').innerHTML = '<div class="approval-empty"><strong>没有待处理申请</strong><span>可以返回团队概览查看其他管理事项</span></div>';
    return;
  }
  if (!items.some(item => item.id === selectedApprovalId)) selectedApprovalId = items[0].id;
  list.innerHTML = items.map(item => `
    <button class="approval-item ${item.id === selectedApprovalId ? 'active' : ''}" data-approval-id="${item.id}">
      <i class="applicant-avatar ${item.kind === 'downgrade' ? 'review' : ''}">${item.kind === 'downgrade' ? '↻' : item.avatar}</i>
      <span><b>${item.applicant} · ${item.title}</b><small>${item.department} · ${item.sourceLabel}</small><span class="item-meta"><span>L${item.currentLevel} → L${item.targetLevel}</span><span>提交于 ${item.submittedAt}</span></span></span>
      <em class="status-pill ${item.kind === 'downgrade' ? 'review' : 'pending'}">${item.kind === 'downgrade' ? '降级复核' : `${item.due} 前`}</em>
    </button>
  `).join('');
  renderApprovalDetail();
}

function renderApprovalDetail() {
  const item = approvalItems.find(entry => entry.id === selectedApprovalId);
  if (!item) return;
  const linked = certificationItems.find(entry => entry.id === item.linkedId);
  const detailText = item.detail || linked?.explanation || '申请人已提交相关证明，请结合技能行为锚点核对材料是否能够支持目标等级。';
  const evidence = linked?.evidence || [
    ['成果', `${item.title}相关项目材料`, '申请人提交 · 已完成基础校验'],
    ['记录', '工作过程与结果记录', '事实中心归集 · 等待人工复核']
  ];
  const anchor = linked?.anchor || `能够在真实工作场景中稳定表现出 L${item.targetLevel} 对应行为，并提供可复核成果。`;
  if (item.kind === 'downgrade') {
    document.querySelector('#approval-detail').innerHTML = `
      <div class="detail-titlebar"><div><span class="review-type-label">降级复核</span><h3>${item.applicant} · ${item.title}</h3><p>${item.department} · ${item.sourceLabel}</p></div><strong class="level-change level-down">L${item.currentLevel} → L${item.targetLevel}</strong></div>
      <dl class="review-facts"><div><dt>触发时间</dt><dd>${item.submittedAt}</dd></div><div><dt>处理期限</dt><dd>${item.due}</dd></div><div><dt>复核期间</dt><dd>保留当前 L${item.currentLevel}</dd></div><div><dt>员工反馈</dt><dd>${item.employeeResponse || '尚未补充说明'}</dd></div></dl>
      <div class="source-explanation review-explanation"><b>复核说明：</b>${detailText}</div>
      <section class="evidence-section"><h4>触发依据与反证</h4>${evidence.map(([type, title, meta]) => `<div class="evidence-entry"><span>${type}</span><div><b>${title}</b><small>${meta}</small></div></div>`).join('')}</section>
      <section class="anchor-section"><h4>原 L${item.currentLevel} 行为锚点</h4><p>${anchor}</p></section>
      <section class="review-comment"><h4>复核意见</h4><textarea id="approval-comment" placeholder="请写明维持、延长观察或降级的具体判断依据。"></textarea></section>
      <div class="review-impact-note"><b>确认降级后</b><span>新等级将参与 Gap、人才匹配和技能供需计算；历史等级和证据继续保留，员工可在 10 个工作日内申诉。</span></div>
      <div class="detail-actions"><button class="ghost" data-review-action="maintain">维持 L${item.currentLevel}</button><button class="ghost" data-review-action="extend">延长观察</button><button class="primary downgrade-button" data-review-action="downgrade">确认降至 L${item.targetLevel}</button></div>
    `;
    return;
  }
  document.querySelector('#approval-detail').innerHTML = `
    <div class="detail-titlebar"><div><h3>${item.applicant} · ${item.title}</h3><p>${item.department} · ${item.sourceLabel}</p></div><strong class="level-change">L${item.currentLevel} → L${item.targetLevel}</strong></div>
    <dl class="review-facts"><div><dt>申请时间</dt><dd>${item.submittedAt}</dd></div><div><dt>处理期限</dt><dd>${item.due}</dd></div><div><dt>建议审核方式</dt><dd>直属管理者确认</dd></div><div><dt>正式等级有效期</dt><dd>12 个月</dd></div></dl>
    <div class="source-explanation"><b>申请摘要：</b>${detailText}</div>
    <section class="evidence-section"><h4>申请证据</h4>${evidence.map(([type, title, meta]) => `<div class="evidence-entry"><span>${type}</span><div><b>${title}</b><small>${meta}</small></div></div>`).join('')}</section>
    <section class="anchor-section"><h4>L${item.targetLevel} 行为锚点</h4><p>${anchor}</p></section>
    <section class="review-comment"><h4>审批意见</h4><textarea id="approval-comment" placeholder="通过可简要说明判断依据；退回或驳回时必须填写原因。"></textarea></section>
    <div class="detail-actions"><button class="ghost reject-button" data-review-action="reject">驳回申请</button><button class="ghost" data-review-action="return">退回补充</button><button class="primary approve-button" data-review-action="approve">通过并点亮</button></div>
  `;
}

document.querySelector('#approval-list').addEventListener('click', event => {
  const button = event.target.closest('[data-approval-id]');
  if (!button) return;
  selectedApprovalId = button.dataset.approvalId;
  renderApprovalQueue();
});

document.querySelector('#approval-detail').addEventListener('click', event => {
  const action = event.target.closest('[data-review-action]')?.dataset.reviewAction;
  if (!action) return;
  const item = approvalItems.find(entry => entry.id === selectedApprovalId);
  const linked = certificationItems.find(entry => entry.id === item.linkedId);
  const comment = document.querySelector('#approval-comment').value.trim();
  if (item.kind === 'downgrade') {
    if (!comment) {
      showToast('请先填写复核意见，说明本次判断依据。');
      document.querySelector('#approval-comment').focus();
      return;
    }
    item.status = action === 'downgrade' ? 'approved' : action === 'extend' ? 'extended' : 'maintained';
    if (linked) {
      if (action === 'downgrade') {
        linked.currentLevel = item.targetLevel;
        linked.targetLevel = item.targetLevel;
        linked.status = 'approved';
        linked.statusLabel = `已降至 L${item.targetLevel}`;
        linked.explanation = `经人工复核，该技能自 2026-09-16 起调整为 L${item.targetLevel}。原 L${item.currentLevel} 记录与本次复核意见均已保留。`;
      } else if (action === 'maintain') {
        linked.targetLevel = item.currentLevel;
        linked.status = 'approved';
        linked.statusLabel = `维持 L${item.currentLevel}`;
        linked.explanation = `经人工复核，现有证据仍支持 L${item.currentLevel}，当前等级保持不变。`;
      } else {
        linked.status = 'review';
        linked.statusLabel = '延长观察';
        linked.deadline = '2026-12-26';
        linked.explanation = '管理者已延长 3 个月观察期，期间当前正式等级保持有效。';
      }
    }
    const messages = {
      downgrade: `${item.applicant} 的${item.title}已确认降至 L${item.targetLevel}，员工将收到结果与申诉入口。`,
      maintain: `已确认维持 ${item.applicant} 的${item.title} L${item.currentLevel}。`,
      extend: '观察期已延长 3 个月，当前正式等级保持有效。'
    };
    showToast(messages[action]);
    renderCertificationList();
    renderApprovalQueue();
    return;
  }
  if ((action === 'return' || action === 'reject') && !comment) {
    showToast('退回或驳回申请时，请先填写审批意见。');
    document.querySelector('#approval-comment').focus();
    return;
  }
  item.status = action === 'approve' ? 'approved' : action === 'return' ? 'returned' : 'rejected';
  if (linked) {
    linked.status = item.status;
    linked.statusLabel = action === 'approve' ? '已点亮' : action === 'return' ? '待补充' : '已驳回';
  }
  const messages = {
    approve: `已通过 ${item.applicant} 的申请，${item.title} L${item.targetLevel} 已正式点亮。`,
    return: '申请已退回补充，员工会收到审批意见。',
    reject: '申请已驳回，审批原因已记录。'
  };
  showToast(messages[action]);
  renderCertificationList();
  renderApprovalQueue();
});

renderCertificationList();
renderApprovalQueue();

const talentCandidates = {
  direct: [
    {
      id: 'lin-xiao', name: '林晓', avatar: '林', avatarTone: 'green', org: '机器人创新中心', role: '机器人算法专家 · T4', available: true,
      reason: '机器人感知与强化学习均有正式认证', note: '曾负责机械臂视觉抓取项目，从仿真验证推进到真实硬件部署。',
      evidence: ['机器人感知 L4', '强化学习 L3', '机械臂项目 · 已核验'], gap: '运动控制待验证', availability: '10 月可投入 60%', freshness: '3 天前',
      dimensions: [['必需能力', 94], ['相关经历', 92], ['证据可信', 96], ['可用程度', 78]]
    },
    {
      id: 'zhou-chen', name: '周晨', avatar: '周', avatarTone: 'blue', org: '智能汽车事业群', role: '感知算法工程师 · T3', available: true,
      reason: '视觉感知能力可直接迁移至具身场景', note: '拥有多传感器融合与端侧部署经验，缺少机器人本体项目经历。',
      evidence: ['视觉感知 L4', '多模态 L3', '端侧部署 · 已核验'], gap: '真实机器人经验不足', availability: '10 月可投入 50%', freshness: '7 天前',
      dimensions: [['必需能力', 86], ['相关经历', 72], ['证据可信', 91], ['可用程度', 82]]
    },
    {
      id: 'chen-ran', name: '陈然', avatar: '陈', avatarTone: 'amber', org: 'AI 平台中心', role: '强化学习工程师 · T3', available: false,
      reason: '强化学习与仿真训练经验突出', note: '主导训练环境与评估体系建设，运动控制能力来自 14 个月前的项目。',
      evidence: ['强化学习 L4', '仿真平台 L3', '训练评估体系'], gap: '运动控制证据较旧', availability: '当前负载 80%', freshness: '14 天前',
      dimensions: [['必需能力', 88], ['相关经历', 81], ['证据可信', 83], ['可用程度', 32]]
    },
    {
      id: 'he-jing', name: '何静', avatar: '何', avatarTone: 'rose', org: '机器人创新中心', role: '运动控制工程师 · T3', available: true,
      reason: '运动控制和真实硬件调试经验完整', note: '参与双足机器人关节控制与现场调试，可补齐团队的控制侧能力。',
      evidence: ['运动控制 L4', '嵌入式系统 L3', '双足机器人 · 已核验'], gap: '强化学习 L2', availability: '11 月可投入 50%', freshness: '5 天前',
      dimensions: [['必需能力', 84], ['相关经历', 94], ['证据可信', 93], ['可用程度', 71]]
    }
  ],
  adjacent: [
    {
      id: 'fang-yi', name: '方毅', avatar: '方', avatarTone: 'blue', org: '智能汽车事业群', role: '自动驾驶算法专家 · T4', available: true,
      reason: '感知、规划和仿真能力与具身智能高度相邻', note: '暂无机器人项目，但复杂动态环境中的决策规划经验可迁移。',
      evidence: ['环境感知 L4', '决策规划 L4', '仿真评估 L3'], gap: '需补机器人系统认知', availability: '10 月可投入 40%', freshness: '6 天前',
      dimensions: [['必需能力', 78], ['相关经历', 76], ['证据可信', 95], ['可用程度', 67]]
    },
    {
      id: 'wang-yan', name: '王妍', avatar: '王', avatarTone: 'rose', org: 'AI 平台中心', role: '多模态研究员 · T3', available: true,
      reason: '多模态理解与模型评估能力可用于智能体感知', note: '具备视觉语言模型应用经验，尚未参与实时控制系统。',
      evidence: ['多模态 L4', '模型评估 L3', '视觉语言模型'], gap: '缺少控制与硬件经验', availability: '10 月可投入 50%', freshness: '2 天前',
      dimensions: [['必需能力', 72], ['相关经历', 64], ['证据可信', 92], ['可用程度', 85]]
    },
    {
      id: 'zhao-ning', name: '赵宁', avatar: '赵', avatarTone: 'amber', org: '云平台事业部', role: '仿真平台工程师 · T3', available: false,
      reason: '大规模仿真与数据闭环能力可支撑算法迭代', note: '适合作为平台角色加入，但不能独立承担核心机器人算法工作。',
      evidence: ['仿真平台 L4', '数据闭环 L3', '分布式训练'], gap: '核心算法能力不足', availability: '当前负载 90%', freshness: '9 天前',
      dimensions: [['必需能力', 62], ['相关经历', 78], ['证据可信', 88], ['可用程度', 24]]
    }
  ],
  potential: [
    {
      id: 'lu-qing', name: '陆青', avatar: '陆', avatarTone: 'green', org: 'AI 平台中心', role: '算法工程师 · T2', available: true,
      reason: '学习速度与强化学习基础达到转型门槛', note: '已完成机器人仿真课题，建议配置一名机器人专家带教 6-8 周。',
      evidence: ['机器学习 L3', '强化学习 L2', '仿真课题 · 待复核'], gap: '真实项目经验缺失', availability: '立即可投入 50%', freshness: '4 天前',
      dimensions: [['必需能力', 61], ['成长潜力', 91], ['证据可信', 74], ['可用程度', 92]]
    },
    {
      id: 'sun-ke', name: '孙可', avatar: '孙', avatarTone: 'blue', org: '智能汽车事业群', role: '视觉算法工程师 · T2', available: true,
      reason: '感知算法扎实，近半年持续补充机器人知识', note: '适合作为感知方向后备人选，需要补充强化学习与控制基础。',
      evidence: ['视觉感知 L3', '模型工程 L3', '机器人课程认证'], gap: '强化学习与控制待培养', availability: '11 月可投入 70%', freshness: '8 天前',
      dimensions: [['必需能力', 57], ['成长潜力', 88], ['证据可信', 81], ['可用程度', 79]]
    },
    {
      id: 'gao-yu', name: '高宇', avatar: '高', avatarTone: 'amber', org: '机器人创新中心', role: '嵌入式工程师 · T2', available: true,
      reason: '真实硬件经验丰富，正在转向机器人控制', note: '硬件调试优势明显，可通过专项任务验证运动控制能力。',
      evidence: ['嵌入式系统 L4', '硬件调试 L4', '运动控制 L1'], gap: '算法能力仍需培养', availability: '10 月可投入 50%', freshness: '5 天前',
      dimensions: [['必需能力', 53], ['成长潜力', 83], ['证据可信', 90], ['可用程度', 84]]
    }
  ]
};

let activeTalentSegment = 'direct';
let talentAvailabilityOnly = false;
let talentOrgFilter = 'all';
let expandedTalentId = null;
const talentShortlist = new Set(['lin-xiao']);

function allTalentCandidates() {
  return Object.values(talentCandidates).flat();
}

function talentCandidateById(id) {
  return allTalentCandidates().find(item => item.id === id);
}

function renderTalentCandidates() {
  let items = talentCandidates[activeTalentSegment];
  if (talentAvailabilityOnly) items = items.filter(item => item.available);
  if (talentOrgFilter !== 'all') items = items.filter(item => item.org === talentOrgFilter);
  document.querySelector('#candidate-count').textContent = items.length;
  document.querySelector('#talent-candidate-list').innerHTML = items.length ? items.map(item => {
    const selected = talentShortlist.has(item.id);
    const expanded = expandedTalentId === item.id;
    return `
      <article class="talent-person" data-person-id="${item.id}">
        <div class="person-top">
          <i class="talent-avatar ${item.avatarTone}">${item.avatar}</i>
          <div class="person-identity"><h4><button class="person-profile-link" data-open-profile="${item.id}">${item.name}</button><span>${item.org}</span></h4><p>${item.role} · 数据更新于 ${item.freshness}</p></div>
          <div class="person-reason"><b>${item.reason}</b><p>${item.note}</p></div>
          <div class="person-actions"><button data-expand-person="${item.id}" aria-expanded="${expanded}">${expanded ? '收起依据' : '查看依据'}</button><button class="add-person ${selected ? 'selected' : ''}" data-toggle-person="${item.id}">${selected ? '✓ 已加入' : '＋ 加入清单'}</button></div>
        </div>
        <div class="person-evidence">${item.evidence.map((text, index) => `<span class="${index < 2 ? 'verified' : ''}">${text}</span>`).join('')}<span class="gap">${item.gap}</span><span class="availability">${item.availability}</span></div>
        ${expanded ? `<div class="person-detail"><div><h5>推荐依据</h5><p>${item.note} 系统仅汇总已授权的技能等级、项目成果与可用性，正式调配仍需管理者和员工确认。</p></div><div><h5>分项判断</h5>${item.dimensions.map(([label, value]) => `<div class="dimension-row"><span>${label}</span><i style="--dimension:${value}%"></i><b>${value}%</b></div>`).join('')}</div></div>` : ''}
      </article>`;
  }).join('') : '<div class="empty-candidates"><b>当前筛选下没有候选人</b><p>可取消“仅看可投入”或切换组织范围。</p></div>';
}

function renderTalentShortlist() {
  const items = [...talentShortlist].map(talentCandidateById).filter(Boolean);
  document.querySelector('#shortlist-count').textContent = items.length;
  document.querySelector('#shortlist-items').innerHTML = items.length ? items.map(item => `
    <div class="shortlist-item"><i class="talent-avatar ${item.avatarTone}">${item.avatar}</i><span><b>${item.name}</b><small>${item.role.split(' · ')[0]} · ${item.availability}</small></span><button data-remove-shortlist="${item.id}" aria-label="从候选清单移除 ${item.name}">×</button></div>
  `).join('') : '<div class="shortlist-empty">还没有加入候选人。<br>从左侧推荐结果中加入合适的人。</div>';
  const coverage = Math.min(96, items.length ? 58 + items.length * 25 : 0);
  document.querySelector('#coverage-value').textContent = `${coverage}%`;
  document.querySelector('#coverage-track').style.width = `${coverage}%`;
  document.querySelector('#coverage-note').textContent = items.length > 1
    ? '核心能力已形成互补；下一步可增加项目角色并检查人员冲突。'
    : items.length === 1
      ? '强化学习与机器人感知已有可靠覆盖；运动控制仍建议补充 1 位候选。'
      : '加入候选人后，系统会按能力覆盖、经历与可用性分别提示风险。';
  document.querySelector('#create-shortlist').disabled = items.length === 0;
  renderTalentCandidates();
}

document.querySelector('.talent-segments').addEventListener('click', event => {
  const button = event.target.closest('[data-talent-segment]');
  if (!button) return;
  activeTalentSegment = button.dataset.talentSegment;
  document.querySelectorAll('[data-talent-segment]').forEach(item => item.classList.toggle('active', item === button));
  expandedTalentId = null;
  renderTalentCandidates();
});

document.querySelector('#talent-candidate-list').addEventListener('click', event => {
  const toggle = event.target.closest('[data-toggle-person]');
  const expand = event.target.closest('[data-expand-person]');
  if (toggle) {
    const id = toggle.dataset.togglePerson;
    if (talentShortlist.has(id)) talentShortlist.delete(id);
    else talentShortlist.add(id);
    renderTalentShortlist();
  }
  if (expand) {
    expandedTalentId = expandedTalentId === expand.dataset.expandPerson ? null : expand.dataset.expandPerson;
    renderTalentCandidates();
  }
});

document.querySelector('#shortlist-items').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-shortlist]');
  if (!button) return;
  talentShortlist.delete(button.dataset.removeShortlist);
  renderTalentShortlist();
});

document.querySelector('#clear-shortlist').addEventListener('click', () => {
  talentShortlist.clear();
  renderTalentShortlist();
});

document.querySelector('#availability-filter').addEventListener('click', event => {
  talentAvailabilityOnly = !talentAvailabilityOnly;
  event.currentTarget.classList.toggle('active', talentAvailabilityOnly);
  renderTalentCandidates();
});

document.querySelector('#org-filter').addEventListener('click', event => {
  talentOrgFilter = talentOrgFilter === 'all' ? '机器人创新中心' : 'all';
  event.currentTarget.textContent = talentOrgFilter === 'all' ? '全部组织 ⌄' : '机器人创新中心 ×';
  event.currentTarget.classList.toggle('active', talentOrgFilter !== 'all');
  renderTalentCandidates();
});

const talentScopeTrigger = document.querySelector('#scope-trigger');
const talentScopeMenu = document.querySelector('#scope-menu');
talentScopeTrigger.addEventListener('click', () => {
  const open = talentScopeMenu.classList.contains('hidden');
  talentScopeMenu.classList.toggle('hidden', !open);
  talentScopeTrigger.setAttribute('aria-expanded', String(open));
});

document.querySelector('#scope-confirm').addEventListener('click', () => {
  const selected = [...talentScopeMenu.querySelectorAll('input:checked')].map(input => input.value);
  const label = selected.length ? `${selected.length} 个业务中心` : '全公司人才技能池';
  document.querySelector('#scope-label').textContent = label;
  document.querySelector('#shortlist-scope').textContent = `范围：${selected.length ? selected.join('、') : label}`;
  talentScopeMenu.classList.add('hidden');
  talentScopeTrigger.setAttribute('aria-expanded', 'false');
  showToast(selected.length ? `已将搜索范围限定为 ${selected.length} 个业务中心。` : '已恢复搜索全公司人才技能池。');
});

document.addEventListener('click', event => {
  if (event.target.closest('#scope-picker')) return;
  talentScopeMenu.classList.add('hidden');
  talentScopeTrigger.setAttribute('aria-expanded', 'false');
});

document.querySelector('#analyze-talent').addEventListener('click', event => {
  const button = event.currentTarget;
  const prompt = document.querySelector('#talent-prompt').value.trim();
  if (!prompt) {
    showToast('请先描述项目需要。');
    document.querySelector('#talent-prompt').focus();
    return;
  }
  button.classList.add('loading');
  button.innerHTML = '<span>✦</span> 正在解析项目需要…';
  setTimeout(() => {
    button.classList.remove('loading');
    button.innerHTML = '<span>✓</span> 已更新推荐结果';
    activeTalentSegment = 'direct';
    document.querySelectorAll('[data-talent-segment]').forEach(item => item.classList.toggle('active', item.dataset.talentSegment === 'direct'));
    renderTalentCandidates();
    showToast('需求已拆解，推荐结果已按直接匹配、相邻能力和潜力人才重新分层。');
    setTimeout(() => { button.innerHTML = '<span>✦</span> 解析需求并找人'; }, 1600);
  }, 850);
});

document.querySelector('#edit-conditions').addEventListener('click', () => {
  document.querySelector('#talent-prompt').focus();
  document.querySelector('#talent-prompt').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#talent-conditions').addEventListener('click', event => {
  const button = event.target.closest('.condition-group button');
  if (!button) return;
  if (button.classList.contains('add-condition')) showToast('可在完整产品中从技能标准库添加能力条件。');
  else {
    button.remove();
    showToast('已从本次匹配条件中移除。');
  }
});

function openRoleBuilder() {
  const modal = document.createElement('div');
  modal.className = 'role-builder-modal';
  modal.innerHTML = `<form class="role-builder-card"><h3>添加项目角色</h3><p>角色会独立保存必需能力和人数，后续可以基于已锁定成员重新计算团队组合。</p><label>角色名称<input value="机器人运动控制工程师" /></label><label>需要人数<input type="number" min="1" value="1" /></label><div class="role-builder-actions"><button type="button" data-close-role>取消</button><button type="submit">保存角色</button></div></form>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-close-role]')) modal.remove();
  });
  modal.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    modal.remove();
    showToast('项目角色已保存，可继续为该角色设置独立的能力条件。');
  });
}

document.querySelector('#add-role-button').addEventListener('click', openRoleBuilder);
document.querySelector('#team-mode-button').addEventListener('click', () => {
  document.querySelector('#manager-nav [data-page="team"]').click();
});
document.querySelector('#create-shortlist').addEventListener('click', () => showToast(`已生成包含 ${talentShortlist.size} 位候选人的名单，可发起跨组织沟通。`));

renderTalentShortlist();

const successionRoles = [
  {
    id: 'platform-architect', title: 'T4 平台架构师', family: '平台工程', incumbent: '韩立', incumbentMeta: '任职 3.2 年 · 关键岗位', immediate: 0, developing: 2, health: 'risk', healthText: '高风险',
    summary: '现任者将在 6 个月后转任集团架构委员会，当前没有可立即接任人选。', risk: '岗位连续性风险较高：需要在本季度确认代理负责人，并为两位候选补齐组织级架构治理能力。',
    ready: [],
    pipeline: [
      { name: '周晨', avatar: '周', tone: 'blue', role: '高级平台工程师 · T3', gap: '缺组织级架构治理、技术战略', state: '6–9 个月', stateClass: 'develop' },
      { name: '林晓', avatar: '林', tone: 'green', role: 'SRE 专家 · T3', gap: '缺跨域架构与人才培养', state: '9–12 个月', stateClass: 'develop' }
    ]
  },
  {
    id: 'sre-lead', title: 'SRE 负责人', family: '稳定性工程', incumbent: '顾明', incumbentMeta: '任职 2.1 年 · 关键岗位', immediate: 1, developing: 2, health: 'watch', healthText: '需关注',
    summary: '已有一位可短期代理的候选人，但在组织协同和应急决策方面仍需验证。', risk: '建议让首位候选在双十一保障中担任代理负责人，完成一次真实场景验证。',
    ready: [{ name: '林晓', avatar: '林', tone: 'green', role: 'SRE 专家 · T3', gap: '需完成一次代理负责人验证', state: '可短期代理', stateClass: '' }],
    pipeline: [
      { name: '陈然', avatar: '陈', tone: 'amber', role: '基础架构工程师 · T3', gap: '缺跨团队应急协调', state: '6–9 个月', stateClass: 'develop' },
      { name: '赵宁', avatar: '赵', tone: 'blue', role: 'SRE 工程师 · T2', gap: '缺容量治理与影响力', state: '9–12 个月', stateClass: 'develop' }
    ]
  },
  {
    id: 'devsecops-expert', title: 'DevSecOps 专家', family: '研发效能', incumbent: '沈墨', incumbentMeta: '任职 1.8 年 · 核心岗位', immediate: 2, developing: 1, health: 'healthy', healthText: '健康',
    summary: '继任梯队结构完整，两位候选已覆盖岗位核心能力，可在不同业务域承担代理职责。', risk: '当前无关键风险。建议维持候选人的跨业务轮岗，避免能力集中在单一产品线。',
    ready: [
      { name: '何静', avatar: '何', tone: 'rose', role: '安全工程专家 · T3', gap: '无关键缺口', state: '可立即接任', stateClass: '' },
      { name: '方毅', avatar: '方', tone: 'blue', role: '研发效能专家 · T3', gap: '无关键缺口', state: '可立即接任', stateClass: '' }
    ],
    pipeline: [{ name: '陆青', avatar: '陆', tone: 'green', role: '平台工程师 · T2', gap: '缺安全治理经验', state: '6–12 个月', stateClass: 'develop' }]
  },
  {
    id: 'data-lead', title: '数据平台负责人', family: '数据与 AI', incumbent: '空缺', incumbentMeta: '已空缺 42 天', immediate: 0, developing: 1, health: 'risk', healthText: '高风险',
    summary: '岗位已经空缺，当前项目由两位技术负责人共同代管，决策边界不清晰。', risk: '建议立即明确临时负责人，并扩大到 AI 平台中心搜索外部组织候选。',
    ready: [],
    pipeline: [{ name: '王妍', avatar: '王', tone: 'rose', role: '多模态研究员 · T3', gap: '缺平台治理与团队管理', state: '9–12 个月', stateClass: 'develop' }]
  }
];

let selectedSuccessionRole = 'platform-architect';
let successionRiskOnly = false;

function renderSuccessionRoles() {
  const items = successionRiskOnly ? successionRoles.filter(role => role.health === 'risk') : successionRoles;
  document.querySelector('#succession-role-list').innerHTML = items.map(role => `
    <button class="succession-role-row ${role.id === selectedSuccessionRole ? 'selected' : ''}" data-succession-role="${role.id}">
      <span><b>${role.title}</b><small>${role.family}</small></span>
      <span><b>${role.incumbent}</b><small>${role.incumbentMeta}</small></span>
      <span class="count-cell">${role.immediate}</span><span class="count-cell">${role.developing}</span>
      <span><i class="health-label ${role.health}">${role.healthText}</i></span>
    </button>`).join('');
}

function successorCard(person) {
  const personId = ({'周晨':'zhou-chen','林晓':'lin-xiao','陈然':'chen-ran','何静':'he-jing','方毅':'fang-yi','赵宁':'zhao-ning'})[person.name] || '';
  return `<div class="successor-card"><i class="talent-avatar ${person.tone}">${person.avatar}</i><div><button class="successor-profile-link" data-open-profile="${personId}">${person.name}</button><small>${person.role}<br>${person.gap}</small></div><span class="readiness-state ${person.stateClass}">${person.state}</span></div>`;
}

function renderSuccessionDetail() {
  const role = successionRoles.find(item => item.id === selectedSuccessionRole) || successionRoles[0];
  document.querySelector('#succession-detail').innerHTML = `
    <div class="succession-detail-top"><span>岗位继任详情</span><h3>${role.title}</h3><p>${role.summary}</p><div class="incumbent-strip"><i class="talent-avatar blue">${role.incumbent === '空缺' ? '—' : role.incumbent[0]}</i><span><b>${role.incumbent}</b><small>现任者 · ${role.incumbentMeta}</small></span><span>${role.healthText}</span></div></div>
    <section class="pipeline-section"><div class="pipeline-title"><b>可立即接任 / 短期代理</b><span>${role.ready.length} 人</span></div>${role.ready.length ? role.ready.map(successorCard).join('') : '<div class="successor-card"><i class="talent-avatar amber">!</i><div><b>暂无成熟候选</b><small>建议扩大搜索范围或明确临时代理方案</small></div><span class="readiness-state gap">缺口</span></div>'}</section>
    <section class="pipeline-section"><div class="pipeline-title"><b>6–12 个月可培养</b><span>${role.pipeline.length} 人</span></div>${role.pipeline.map(successorCard).join('')}</section>
    <div class="succession-actions"><div class="succession-risk-note">${role.risk}</div><button data-create-development="${role.id}">创建继任培养计划</button></div>`;
}

document.querySelector('#succession-role-list').addEventListener('click', event => {
  const row = event.target.closest('[data-succession-role]');
  if (!row) return;
  selectedSuccessionRole = row.dataset.successionRole;
  renderSuccessionRoles();
  renderSuccessionDetail();
});

document.querySelector('#succession-view-toggle').addEventListener('click', event => {
  successionRiskOnly = !successionRiskOnly;
  event.currentTarget.classList.toggle('active', successionRiskOnly);
  event.currentTarget.textContent = successionRiskOnly ? '查看全部岗位' : '只看风险岗位';
  if (successionRiskOnly && !successionRoles.find(role => role.id === selectedSuccessionRole && role.health === 'risk')) selectedSuccessionRole = successionRoles.find(role => role.health === 'risk').id;
  renderSuccessionRoles();
  renderSuccessionDetail();
});

function openDevelopmentPlan(role) {
  const candidate = role.ready[0] || role.pipeline[0];
  const modal = document.createElement('div');
  modal.className = 'development-modal';
  modal.innerHTML = `<div class="development-card"><h3>创建继任培养计划</h3><p>${role.title} · 候选人 ${candidate?.name || '待指定'}。计划将保留岗位标准版本、关键缺口与验证结果。</p><div class="development-step"><span>70%</span><div><b>代理承担真实职责</b><small>在关键项目中完成一次岗位级决策与复盘</small></div></div><div class="development-step"><span>20%</span><div><b>现任者 / 专家辅导</b><small>每两周一次案例评审与反馈</small></div></div><div class="development-step"><span>10%</span><div><b>补充治理知识</b><small>完成岗位缺口对应的课程或认证</small></div></div><div class="development-actions"><button data-close-development>取消</button><button data-save-development>创建计划</button></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-close-development]')) modal.remove();
    if (event.target.closest('[data-save-development]')) { modal.remove(); showToast('继任培养计划已创建，并已加入季度人才动作清单。'); }
  });
}

document.querySelector('#succession-detail').addEventListener('click', event => {
  const button = event.target.closest('[data-create-development]');
  if (!button) return;
  openDevelopmentPlan(successionRoles.find(role => role.id === button.dataset.createDevelopment));
});

renderSuccessionRoles();
renderSuccessionDetail();

const teamRoles = [
  { id: 'perception', title: '机器人感知算法', headcount: 1, allocation: '50%', skills: [['机器人感知 L3', 'required'], ['多模态 L3', 'required'], ['真实硬件', 'bonus']], candidates: ['lin-xiao', 'zhou-chen', 'wang-yan'] },
  { id: 'control', title: '运动控制工程师', headcount: 1, allocation: '50%', skills: [['运动控制 L3', 'required'], ['嵌入式系统 L2', 'required'], ['强化学习', 'bonus']], candidates: ['he-jing', 'gao-yu', 'lin-xiao'] },
  { id: 'simulation', title: '仿真训练平台', headcount: 1, allocation: '80%', skills: [['仿真平台 L3', 'required'], ['分布式训练 L2', 'required'], ['数据闭环', 'bonus']], candidates: ['chen-ran', 'zhao-ning', 'fang-yi'] },
  { id: 'product', title: '业务产品负责人', headcount: 1, allocation: '50%', skills: [['复杂项目 L3', 'required'], ['业务探索 L3', 'required'], ['机器人行业', 'bonus']], candidates: ['fang-yi', 'wang-yan', 'zhou-chen'] }
];

let activeTeamRole = 'perception';
const teamAssignments = { perception: 'lin-xiao', simulation: 'chen-ran' };
let teamConflictResolved = false;

function renderTeamRoles() {
  document.querySelector('#team-role-list').innerHTML = teamRoles.map((role, index) => {
    const assigned = talentCandidateById(teamAssignments[role.id]);
    return `<button class="team-role-item ${role.id === activeTeamRole ? 'active' : ''}" data-team-role="${role.id}"><span class="role-index">0${index + 1}</span><span><b>${role.title}</b><small>${assigned ? `${assigned.name} · 已锁定` : `${role.headcount} 人 · 投入 ${role.allocation}`}</small></span><i class="role-fill-state ${assigned ? 'filled' : ''}">${assigned ? '已配置' : '待选择'}</i></button>`;
  }).join('');
}

function renderTeamCandidates() {
  const role = teamRoles.find(item => item.id === activeTeamRole) || teamRoles[0];
  document.querySelector('#active-role-title').textContent = role.title;
  document.querySelector('#active-role-meta').textContent = `需要 ${role.headcount} 人 · 至少投入 ${role.allocation}`;
  document.querySelector('#active-role-skills').innerHTML = role.skills.map(([skill, type]) => `<span class="${type === 'bonus' ? 'bonus' : ''}">${type === 'bonus' ? '加分' : '必需'} · ${skill}</span>`).join('');
  document.querySelector('#team-candidate-list').innerHTML = role.candidates.map((id, index) => {
    const candidate = talentCandidateById(id);
    const assigned = teamAssignments[role.id] === id;
    const conflict = !candidate.available;
    return `<article class="team-candidate"><i class="talent-avatar ${candidate.avatarTone}">${candidate.avatar}</i><div class="team-candidate-main"><button class="team-profile-link" data-open-profile="${candidate.id}">${candidate.name} · ${candidate.org}</button><small>${candidate.reason}</small><div class="team-candidate-tags"><span>${candidate.evidence[0]}</span><span>${candidate.evidence[1]}</span><span class="${conflict ? 'warn' : ''}">${candidate.availability}</span></div></div><div class="team-candidate-action"><button class="${assigned ? 'assigned' : ''}" data-assign-team="${id}">${assigned ? '✓ 已选定' : '选择此人'}</button><small>${index === 0 ? '当前角色首选' : '备选方案'}</small></div></article>`;
  }).join('');
}

function renderTeamSummary() {
  const entries = Object.entries(teamAssignments).filter(([, id]) => id).map(([roleId, candidateId]) => ({ role: teamRoles.find(role => role.id === roleId), candidate: talentCandidateById(candidateId) }));
  document.querySelector('#team-member-count').textContent = entries.length;
  document.querySelector('#filled-role-count').textContent = entries.length;
  document.querySelector('#team-member-list').innerHTML = entries.length ? entries.map(({ role, candidate }) => `<div class="team-member"><i class="talent-avatar ${candidate.avatarTone}">${candidate.avatar}</i><span><b>${candidate.name}</b><small>${role.title} · ${role.allocation}</small></span><button data-remove-team-role="${role.id}">移除</button></div>`).join('') : '<div class="shortlist-empty">尚未选择项目成员</div>';
  const roleCoverage = Math.round(entries.length / teamRoles.length * 100);
  const skillCoverage = Math.min(96, entries.length ? 48 + entries.length * 15 : 0);
  document.querySelector('#role-coverage').textContent = `${roleCoverage}%`;
  document.querySelector('#role-coverage-track').style.width = `${roleCoverage}%`;
  document.querySelector('#skill-coverage').textContent = `${skillCoverage}%`;
  document.querySelector('#skill-coverage-track').style.width = `${skillCoverage}%`;
  const conflict = entries.some(({ candidate }) => !candidate.available) && !teamConflictResolved;
  const alert = document.querySelector('#team-alert');
  alert.classList.toggle('resolved', !conflict);
  alert.innerHTML = conflict ? '<b>1 项投入冲突</b><p>陈然在 10 月已有核心项目，当前只能投入 20%。</p><button id="resolve-conflict">查看替代方案</button>' : '<b>当前无时间冲突</b><p>已选择成员的可用时间满足当前角色投入要求。</p><button id="resolve-conflict">重新检查</button>';
  document.querySelector('#confirm-team').disabled = entries.length < teamRoles.length || conflict;
  renderTeamRoles();
  renderTeamCandidates();
}

document.querySelector('#team-role-list').addEventListener('click', event => {
  const button = event.target.closest('[data-team-role]');
  if (!button) return;
  activeTeamRole = button.dataset.teamRole;
  renderTeamRoles();
  renderTeamCandidates();
});

document.querySelector('#team-candidate-list').addEventListener('click', event => {
  const button = event.target.closest('[data-assign-team]');
  if (!button) return;
  const occupiedRole = Object.keys(teamAssignments).find(roleId => roleId !== activeTeamRole && teamAssignments[roleId] === button.dataset.assignTeam);
  if (occupiedRole) {
    showToast(`${talentCandidateById(button.dataset.assignTeam).name} 已承担“${teamRoles.find(role => role.id === occupiedRole).title}”，请先调整该角色。`);
    return;
  }
  teamAssignments[activeTeamRole] = button.dataset.assignTeam;
  teamConflictResolved = false;
  renderTeamSummary();
  showToast(`${talentCandidateById(button.dataset.assignTeam).name} 已配置到 ${teamRoles.find(role => role.id === activeTeamRole).title}。`);
});

document.querySelector('#team-member-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-team-role]');
  if (!button) return;
  delete teamAssignments[button.dataset.removeTeamRole];
  renderTeamSummary();
});

document.querySelector('#team-alert').addEventListener('click', event => {
  if (!event.target.closest('#resolve-conflict')) return;
  if (!teamConflictResolved) {
    activeTeamRole = 'simulation';
    document.querySelector('.team-match-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('已定位到“仿真训练平台”，请选择无投入冲突的备选成员。');
  } else showToast('已重新检查，当前成员时间安排无冲突。');
  renderTeamRoles();
  renderTeamCandidates();
});

document.querySelector('#recalculate-team').addEventListener('click', event => {
  const button = event.currentTarget;
  button.textContent = '计算中…';
  setTimeout(() => { button.textContent = '↻ 重新计算'; renderTeamSummary(); showToast('已根据锁定成员重新计算其余角色推荐。'); }, 700);
});

function openTeamRoleBuilder() {
  const modal = document.createElement('div');
  modal.className = 'development-modal';
  modal.innerHTML = `<form class="development-card"><h3>添加项目角色</h3><p>每个角色可以独立设置人数、投入比例、必需技能和加分技能。</p><label>角色名称<input id="new-role-title" value="机器人系统集成" /></label><label>投入比例<input id="new-role-allocation" value="50%" /></label><div class="development-actions"><button type="button" data-close-development>取消</button><button type="submit">保存角色</button></div></form>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('[data-close-development]')) modal.remove(); });
  modal.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const id = `custom-role-${Date.now()}`;
    teamRoles.push({ id, title: modal.querySelector('#new-role-title').value || '新项目角色', headcount: 1, allocation: modal.querySelector('#new-role-allocation').value || '50%', skills: [['系统集成 L2', 'required'], ['跨团队协作 L3', 'required']], candidates: ['he-jing', 'zhou-chen', 'gao-yu'] });
    activeTeamRole = id;
    modal.remove();
    renderTeamSummary();
    showToast('新角色已加入组队方案，可以继续选择候选成员。');
  });
}

document.querySelector('#new-team-role').addEventListener('click', openTeamRoleBuilder);
document.querySelector('#edit-team-requirement').addEventListener('click', () => document.querySelector('#manager-nav [data-page="talent"]').click());
document.querySelector('#unlock-team').addEventListener('click', () => { Object.keys(teamAssignments).forEach(key => delete teamAssignments[key]); teamConflictResolved = true; renderTeamSummary(); showToast('已解除全部成员锁定，可以重新组队。'); });
document.querySelector('#confirm-team').addEventListener('click', () => showToast('组队方案已进入协调确认，将按组织权限逐一发起沟通。'));

renderTeamSummary();

const employeeProfiles = {
  'zhou-chen': {
    id: 'zhou-chen', name: '周晨', avatar: '周', tone: 'amber', role: '高级平台工程师 · T3', org: '平台工程部 / 云基础设施组 · 北京', status: '在职', updated: '更新于 2026-09-14',
    summary: '可独立负责平台核心模块，正在补齐组织级架构治理能力',
    summaryDescription: '近两个季度承担跨团队平台升级，交付稳定；适合作为平台架构师后备候选，通过真实项目验证技术决策与跨域推动能力。',
    goal: 'T4 平台架构师', nextCheckin: '2026-09-22', availability: '10 月可投入 40%', readiness: '6–9 个月可进入候选评审', readinessValue: 68, readinessCopy: '目标岗位 6 项核心能力，当前满足 4 项',
    tenureSummary: '在职 3 年 6 个月，经历 2 个岗位。',
    experience: [['2024.04–至今', '高级平台工程师 · T3', '平台工程部 / 云基础设施组'], ['2023.03–2024.03', '平台工程师 · T2', '云平台事业部 / 容器平台组']],
    responsibilities: [['业务目标', '提升平台稳定性和自助服务覆盖，支撑核心业务规模增长。', '2026 Q3 OKR · 权重 40%'], ['项目责任', '统一可观测平台升级，负责技术方案、迁移节奏与跨团队验收。', '覆盖 46 项服务 · 协作 6 个团队'], ['组织责任', '维护平台接入标准并带教 2 名工程师。', '规范已被 6 个研发团队采用']],
    traits: [
      ['构', '复杂系统拆解', '能将跨域需求拆解为稳定的平台边界，近 3 个项目均承担方案设计。', '来源：项目成果 3 项 · 专家评审 2 次'],
      ['稳', '稳定性交付', '负责服务治理期间关键链路可用性保持 99.97%，故障恢复时间下降 32%。', '来源：项目指标 · 2026 Q2 复盘'],
      ['协', '跨团队推动', '能够协调研发、运维与业务团队，但组织级共识建设仍需更多验证。', '来源：管理者反馈 · 协作方反馈 4 条'],
      ['教', '知识沉淀', '持续维护平台接入规范，近半年完成 4 次内部分享与 2 次新人带教。', '来源：知识库 · 导师记录'],
      ['向', '架构方向明确', '员工与管理者已共同确认平台架构师方向，愿意承担跨域治理项目。', '来源：发展目标 · 2026-07-08 确认']
    ],
    skills: [
      ['容器与编排', '专业技能 / 平台工程', 'L4', '生产集群迁移方案 + 专家答辩', '2027-03'],
      ['可观测性建设', '专业技能 / 稳定性工程', 'L4', '统一观测平台改造，覆盖 46 项服务', '2027-05'],
      ['系统设计与拆分', '专业技能 / 系统设计', 'L3', '计费平台模块化重构方案', '2027-01', { lastUsed: '2025-07', status: '待复核' }],
      ['跨团队协作', '通用技能 / 协作影响', 'L3', '三团队平台升级复盘与反馈', '2026-12']
    ],
    projects: [
      { time:'2026.03–08', title:'统一可观测平台升级', responsibility:'对 46 项核心服务的迁移质量、告警标准和跨团队验收负责。', actions:'完成现状盘点与分级设计，组织 6 个团队分批迁移，主持 3 次风险评审。', outcome:'统一观测平台、分级告警规范和迁移手册均已验收，规范被 6 个团队复用。', impact:'高优告警误报量下降 41%，故障定位中位时长由 28 分钟降至 16 分钟。', contribution:'主导', skills:['可观测性建设 L4','系统设计 L3','跨团队协作 L3'], verification:'已验收 · 已复用' },
      { time:'2025.11–2026.02', title:'容器平台生产集群迁移', responsibility:'保障 18 个核心业务在生产集群迁移期间连续可用。', actions:'设计双轨迁移与回滚方案，完成容量演练并担任迁移窗口现场负责人。', outcome:'18 个业务按计划完成迁移，方案、脚本和复盘记录通过专家评审。', impact:'迁移期间核心业务零中断，后续集群交付周期缩短 35%。', contribution:'核心负责人', skills:['容器与编排 L4','风险管理 L3'], verification:'已验收 · 已沉淀' },
      { time:'2025.07–10', title:'计费平台模块化重构', responsibility:'解决计费与结算耦合导致的发布阻塞和故障扩散。', actions:'牵头划分模块边界，制定接口契约并负责第一阶段核心模块改造。', outcome:'结算与计费模块独立发布，关键接口测试和架构文档完成验收。', impact:'发布周期由双周缩短至每周，相关变更故障数下降 27%。', contribution:'模块负责人', skills:['系统设计与拆分 L3','工程质量 L3'], verification:'已验收' }
    ],
    gaps: [['组织级架构治理', '当前 L2 / 目标 L4'], ['技术战略表达', '当前 L2 / 目标 L3']],
    developmentActions: [['70% 实践', '担任下一次跨域平台治理项目代理负责人', '证明：组织级方案、决策记录与项目复盘'], ['20% 反馈', '每月与集团架构师完成一次方案评审', '证明：评审意见闭环记录'], ['10% 学习', '完成技术战略表达专项训练', '证明：组织级技术提案答辩']],
    collaboration: [['擅长合作场景', '复杂技术方案共创、平台类跨团队项目'], ['沟通偏好', '先提供书面背景与关键约束，再集中决策'], ['管理者建议', '增加组织级方案评审与代理负责人机会']]
  },
  'lin-xiao': {
    id: 'lin-xiao', name: '林晓', avatar: '林', tone: 'green', role: 'SRE 专家 · T3', org: '平台工程部 / 稳定性工程组 · 上海', status: '在职', updated: '更新于 2026-09-13',
    summary: '稳定性与应急治理能力突出，可短期代理 SRE 负责人',
    summaryDescription: '具备高压场景下的技术判断和现场协调经验。若完成一次大型保障项目的代理负责人验证，可进入正式继任评审。',
    goal: 'SRE 负责人', nextCheckin: '2026-09-25', availability: '立即可投入 50%', readiness: '可短期代理', readinessValue: 82, readinessCopy: '岗位 7 项核心能力，当前满足 6 项',
    tenureSummary: '在职 4 年 2 个月，经历 3 个岗位。',
    experience: [['2025.01–至今','SRE 专家 · T3','平台工程部 / 稳定性工程组'],['2023.07–2024.12','高级 SRE 工程师 · T3','基础技术部'],['2022.07–2023.06','SRE 工程师 · T2','基础技术部']],
    responsibilities: [['业务目标','保障核心交易链路稳定性，季度可用性达到 99.99%。','2026 Q3 OKR · 权重 50%'],['项目责任','核心链路稳定性治理，负责 SLO、容量和应急演练。','覆盖 8 个核心系统'],['组织责任','维护故障复盘机制并带教 2 名 SRE 工程师。','18 项改进已闭环']],
    traits: [['稳','应急治理','近一年主导 5 次重大故障复盘，推动 18 项系统性改进按期闭环。','来源：故障复盘 · SLO 数据'],['判','现场决策','能在信息不完整时快速识别关键路径，并明确止损顺序。','来源：专家评审 3 次'],['协','跨团队协调','与业务研发协作稳定，适合承担大型保障项目现场负责人。','来源：协作方反馈 6 条'],['带','带教反馈','已带教 2 名 SRE 工程师，反馈及时且目标明确。','来源：导师记录'],['向','管理意愿明确','愿意承担团队管理职责，希望先通过代理项目验证。','来源：发展目标 · 2026-06-19 确认']],
    skills: [['SLO 设计','专业技能 / 稳定性工程','L4','核心服务 SLO 体系与季度复盘','2027-05'],['应急响应','专业技能 / 稳定性工程','L4','五次重大故障复盘','2027-04'],['容量治理','专业技能 / 平台工程','L3','双十一容量压测方案','2027-01'],['跨团队协作','通用技能 / 协作影响','L4','大型保障协作反馈','2027-02']],
    projects: [{time:'2026.05–08',title:'核心链路稳定性治理',responsibility:'对核心交易链路 SLO、容量基线和应急预案负责。',actions:'重构 SLO 指标，推动 18 项风险整改，并组织两轮全链路演练。',outcome:'SLO 看板、容量基线和预案全部验收，8 个系统接入季度复盘机制。',impact:'可用性提升至 99.99%，高优告警减少 37%。',contribution:'主导',skills:['SLO 设计 L4','应急响应 L4'],verification:'已验收 · 持续使用'}, {time:'2025.10–11',title:'双十一保障',responsibility:'负责高峰期容量判断和现场应急指挥。',actions:'完成峰值压测、风险分级与应急排班，现场处理 2 次流量突增。',outcome:'保障方案通过评审，峰值期间无重大故障。',impact:'实际峰值高于预估 18% 时系统仍保持稳定。',contribution:'现场负责人',skills:['容量治理 L3','现场决策 L4'],verification:'已复盘'}, {time:'2025.06–09',title:'故障演练体系建设',responsibility:'建立可重复执行的季度故障演练机制。',actions:'设计 6 类故障场景，组织业务研发和基础设施联合演练。',outcome:'演练手册和复盘模板被 8 个系统采用。',impact:'重大故障平均恢复时长下降 24%。',contribution:'机制负责人',skills:['应急响应 L4','跨团队协作 L4'],verification:'已复用'}],
    gaps: [['组织级资源协调','待真实场景验证'], ['人员绩效管理','当前 L2 / 目标 L3']],
    developmentActions: [['70% 实践','在下一次大型保障中担任代理负责人','证明：资源决策、人员协调与复盘结果'],['20% 反馈','由现任负责人进行双周管理复盘','证明：反馈记录与行为改进'],['10% 学习','完成人员绩效与教练技术训练','证明：案例答辩']],
    collaboration: [['擅长合作场景','生产保障、复杂故障处置、跨团队演练'],['沟通偏好','紧急事项直接同步，日常决策保留书面记录'],['管理者建议','在下一次大促保障中担任代理负责人']]
  },
  'chen-ran': {
    id: 'chen-ran', name: '陈然', avatar: '陈', tone: 'green', role: '基础架构工程师 · T3', org: '平台工程部 / 基础设施组 · 杭州', status: '在职', updated: '更新于 2026-09-11',
    summary: '自动化和基础设施能力扎实，发展目标仍需共同确认',
    summaryDescription: '在基础设施自动化项目中交付表现稳定，目前承担核心项目，短期可用性有限。建议先完成发展目标沟通，再决定进入专家或管理通道。',
    goal: '待确认', nextCheckin: '已逾期 5 天', availability: '当前核心项目占用 80%', readiness: '发展目标待确认', readinessValue: 42, readinessCopy: '当前岗位能力满足，下一阶段目标尚未确认',
    tenureSummary: '在职 2 年 8 个月，经历 2 个岗位。',
    experience: [['2025.03–至今','基础架构工程师 · T3','平台工程部 / 基础设施组'],['2024.01–2025.02','平台开发工程师 · T2','研发效能部']],
    responsibilities: [['业务目标','降低环境交付时间与人工运维成本。','2026 Q3 OKR · 权重 45%'],['项目责任','环境交付自动化平台核心开发，负责策略引擎和异常回滚。','当前核心项目 · 投入 80%'],['组织责任','维护基础设施策略库和代码评审规范。','27 条策略已上线']],
    traits: [['自','自动化实践','持续减少重复运维操作，近半年推动 9 条人工流程自动化。','来源：项目成果 2 项'],['实','工程落地','擅长将平台设计落到可维护工具，重视回滚与异常处理。','来源：代码与方案评审'],['稳','交付可靠','核心项目按期交付，但多项目并行时需要更早暴露资源风险。','来源：项目复盘'],['协','协作直接','技术沟通清楚直接，跨团队背景同步可以更充分。','来源：协作反馈 3 条'],['向','方向探索中','同时对平台专家和技术管理感兴趣，尚未确认正式目标。','来源：员工自述 · 待共同确认']],
    skills: [['基础设施即代码','专业技能 / 平台工程','L4','环境交付自动化平台','2027-03'],['自动化开发','专业技能 / 研发效能','L4','9 条流程自动化成果','2027-02'],['容器与编排','专业技能 / 平台工程','L3','生产环境治理项目','2026-12'],['项目协作','通用技能 / 协作影响','L3','核心项目跨组协作记录','2026-11']],
    projects: [{time:'2026.04–至今',title:'环境交付自动化平台',responsibility:'负责策略引擎、异常回滚和核心交付链路。',actions:'实现环境编排、策略校验和失败回滚，处理 14 类历史异常。',outcome:'核心模块已通过阶段验收，覆盖 5 类标准环境。',impact:'标准环境交付由 2 天降至 40 分钟，人工操作减少 72%。',contribution:'核心开发',skills:['自动化开发 L4','基础设施即代码 L4'],verification:'阶段验收'}, {time:'2025.12–2026.03',title:'基础设施策略治理',responsibility:'补齐上线前基础设施合规校验。',actions:'梳理高频问题并实现 27 条策略规则和本地校验工具。',outcome:'规则库和校验工具完成验收，接入 4 条发布流水线。',impact:'配置类生产问题下降 31%。',contribution:'主要贡献者',skills:['基础设施即代码 L4','工程质量 L3'],verification:'已验收 · 已复用'}, {time:'2025.08–11',title:'生产环境容器治理',responsibility:'识别不合规资源配置并完成存量整改。',actions:'开发扫描工具，推动 32 个服务完成资源规范整改。',outcome:'资源检测工具纳入月度巡检。',impact:'资源超配成本下降 12%。',contribution:'模块负责人',skills:['容器与编排 L3','数据分析 L2'],verification:'已验收'}],
    gaps: [['发展目标确认','需要管理者共同确认'],['跨团队背景同步','建议纳入下一周期行动']],
    developmentActions: [['70% 实践','完成当前平台项目并承担一次跨团队需求澄清','证明：验收结果与协作方反馈'],['20% 反馈','与管理者完成专家和管理双通道探索','证明：发展目标确认记录'],['10% 学习','补充技术方案表达训练','证明：方案评审通过']],
    collaboration: [['擅长合作场景','工具共建、自动化改造、复杂问题定位'],['沟通偏好','给出明确目标和验收标准，减少低效会议'],['管理者建议','尽快完成发展沟通并协调当前项目负载']]
  }
};

function profileFromTalent(candidate) {
  if (!candidate) return employeeProfiles['zhou-chen'];
  const levelSkills = candidate.evidence.slice(0, 3).map((text, index) => {
    const level = (text.match(/L\d/) || [index ? 'L3' : 'L4'])[0];
    return [text.replace(/\sL\d/, ''), '专业技能 / 已授权摘要', level, index === 0 ? '项目成果 + 专家确认' : '技能认证与项目记录', '2027-02'];
  });
  return {
    id: candidate.id, name: candidate.name, avatar: candidate.avatar, tone: candidate.avatarTone, role: candidate.role, org: `${candidate.org} · 授权摘要`, status: '在职', updated: `更新于 ${candidate.freshness}`,
    summary: candidate.reason, summaryDescription: `${candidate.note} 当前页面仅展示搜索授权范围内的摘要，进一步查看项目原文需发起协作授权。`,
    goal: '专业方向持续发展', nextCheckin: '本季度待安排', availability: candidate.availability, readiness: '项目匹配摘要', readinessValue: candidate.dimensions[0][1], readinessCopy: `当前需求必需能力覆盖 ${candidate.dimensions[0][1]}%`,
    tenureSummary: '跨组织授权摘要，完整任职经历需授权后查看。',
    experience: [['当前','当前岗位',candidate.org]],
    responsibilities: [['当前岗位',candidate.role,'来源：HR 基础信息'],['本次匹配',candidate.reason,'来源：人才需求匹配']],
    traits: [['能','核心能力',candidate.reason,'来源：正式技能等级'],['验','相关经历',candidate.note,'来源：项目履历摘要'],['证','证据可靠',`当前证据可信度 ${candidate.dimensions.find(item => item[0] === '证据可信')?.[1] || 82}%，详情需按权限查看。`,'来源：认证与评审记录'],['用','可用情况',candidate.availability,'来源：项目排期'],['缺','当前缺口',candidate.gap,'来源：本次人才需求匹配']],
    skills: levelSkills,
    projects: [{time:'近 12 个月',title:'相关项目经历',responsibility:'承担与本次需求相关的项目职责，完整范围需授权后查看。',actions:'已授权摘要仅确认存在相关实践。',outcome:'项目成果已被记录并纳入技能证据。',impact:'量化影响需发起协作授权后查看。',contribution:'授权摘要',skills:candidate.evidence.slice(0,2),verification:'已记录'}],
    gaps: [[candidate.gap,'本次需求缺口']],
    developmentActions: [['下一步','发起协作授权后确认发展目标与实践计划','证明：本人和管理者确认记录']],
    collaboration: [['擅长合作场景',candidate.reason],['沟通偏好','发起协作后由本人确认'],['权限说明','当前为跨组织候选摘要']]
  };
}

function profileById(id) {
  return employeeProfiles[id] || profileFromTalent(typeof talentCandidateById === 'function' ? talentCandidateById(id) : null);
}

let profileReturnPage = 'manager';
let activeProfileId = 'zhou-chen';
let activeProfileReviewSkill = null;

function renderEmployeeProfile(id) {
  const profile = profileById(id);
  activeProfileId = profile.id;
  document.querySelector('#profile-avatar').textContent = profile.avatar;
  document.querySelector('#profile-avatar').className = `profile-person-avatar ${profile.tone || ''}`;
  document.querySelector('#profile-name').textContent = profile.name;
  document.querySelector('#profile-breadcrumb-name').textContent = profile.name;
  document.querySelector('#profile-status').textContent = profile.status;
  document.querySelector('#profile-role').textContent = profile.role;
  document.querySelector('#profile-org').textContent = profile.org;
  document.querySelector('#profile-updated').textContent = profile.updated;
  document.querySelector('#profile-summary-title').textContent = profile.summary;
  document.querySelector('#profile-summary-description').textContent = profile.summaryDescription;
  document.querySelector('#profile-goal').textContent = profile.goal;
  document.querySelector('#profile-next-checkin').textContent = profile.nextCheckin;
  document.querySelector('#profile-availability').textContent = profile.availability;
  document.querySelector('#profile-readiness-state').textContent = profile.readiness;
  document.querySelector('#profile-readiness-track').style.width = `${profile.readinessValue}%`;
  document.querySelector('#profile-readiness-copy').textContent = profile.readinessCopy;
  document.querySelector('#profile-tenure-summary').textContent = profile.tenureSummary;
  document.querySelector('#profile-responsibility-count').textContent = `${profile.responsibilities.length} 项责任`;
  document.querySelector('#profile-project-count').textContent = `近 12 个月 ${profile.projects.length} 项`;
  document.querySelector('#profile-responsibilities').innerHTML = profile.responsibilities.map(([label,value,meta]) => `<div class="profile-responsibility"><span>${label}</span><div><b>${value}</b><small>${meta}</small></div></div>`).join('');
  document.querySelector('#profile-experience').innerHTML = profile.experience.map(([time,role,org], index) => `<div class="profile-experience ${index === 0 ? 'current' : ''}"><i></i><div><span>${time}</span><b>${role}</b><small>${org}</small></div></div>`).join('');
  document.querySelector('#profile-traits').innerHTML = profile.traits.map(([icon,title,description,source]) => `<article class="profile-trait"><i>${icon}</i><div><b>${title}</b><p>${description}</p><small>${source}</small></div></article>`).join('');
  document.querySelector('#profile-skills').innerHTML = profile.skills.map(([name,category,level,evidence,validity,lifecycle = {}]) => {
    const status = lifecycle.status || '有效';
    const isReview = status !== '有效';
    return `<div class="profile-skill-row ${isReview ? 'needs-review' : ''}" data-profile-skill-row="${name}"><span class="profile-skill-name"><b>${name}</b><small>${category}</small></span><span class="profile-level"><i></i>${level}</span><span class="profile-skill-recency"><b>${lifecycle.lastUsed || '近 6 个月'}</b><em class="${isReview ? 'review' : ''}">${status}</em></span><span class="profile-skill-evidence">${evidence}</span><span class="profile-validity">至 ${validity}</span><button class="profile-skill-review-button" data-profile-skill-review="${name}" type="button">调整等级</button></div>`;
  }).join('');
  document.querySelector('#profile-projects').innerHTML = profile.projects.map(project => `<article class="profile-project"><header><div><span>${project.time}</span><h4>${project.title}</h4></div><em>${project.verification}</em></header><div class="profile-evidence-grid"><div><span>02 · 负责什么</span><p>${project.responsibility}</p></div><div><span>03 · 做过什么</span><p>${project.actions}</p></div><div><span>04 · 做成什么</span><p>${project.outcome}</p></div><div class="profile-impact"><span>05 · 产生什么影响</span><p>${project.impact}</p></div></div><footer><span><b>06 · 贡献角色</b><strong>${project.contribution}</strong></span><span><b>07 · 证明能力</b>${project.skills.map(skill => `<i>${skill}</i>`).join('')}</span></footer></article>`).join('');
  document.querySelector('#profile-gaps').innerHTML = profile.gaps.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  document.querySelector('#profile-development-actions').innerHTML = profile.developmentActions.map(([type,title,proof]) => `<div><span>${type}</span><b>${title}</b><small>${proof}</small></div>`).join('');
  document.querySelector('#profile-collaboration').innerHTML = profile.collaboration.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  closeProfileLevelReview();
}

function closeProfileLevelReview() {
  const panel = document.querySelector('#profile-level-review');
  if (panel) panel.classList.add('hidden');
  activeProfileReviewSkill = null;
  document.querySelectorAll('[data-profile-skill-row]').forEach(row => row.classList.remove('is-reviewing'));
}

function openProfileLevelReview(skillName) {
  const profile = profileById(activeProfileId);
  const skill = profile.skills.find(entry => entry[0] === skillName);
  if (!skill) return;
  const currentLevel = Number(skill[2].replace('L', ''));
  activeProfileReviewSkill = { profile, skill, currentLevel };
  document.querySelector('#profile-level-review-title').textContent = `复核 ${skillName}`;
  document.querySelector('#profile-review-summary').textContent = `${profile.name} 当前正式等级为 L${currentLevel}。请对照行为锚点说明为何需要调低。`;
  document.querySelector('#profile-review-current').textContent = `L${currentLevel}`;
  document.querySelector('#profile-review-target').innerHTML = Array.from({ length: currentLevel }, (_, index) => currentLevel - index - 1).filter(level => level >= 1).map(level => `<option value="${level}">L${level}${level === currentLevel - 1 ? ' · 默认降一级' : ' · 需要会签'}</option>`).join('');
  document.querySelector('#profile-review-evidence').value = '';
  document.querySelector('#profile-review-confirm').checked = false;
  document.querySelector('#profile-level-review').classList.remove('hidden');
  document.querySelectorAll('[data-profile-skill-row]').forEach(row => row.classList.toggle('is-reviewing', row.dataset.profileSkillRow === skillName));
  document.querySelector('#profile-level-review').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => document.querySelector('#profile-review-evidence').focus(), 220);
}

document.querySelector('#profile-skills').addEventListener('click', event => {
  const button = event.target.closest('[data-profile-skill-review]');
  if (button) openProfileLevelReview(button.dataset.profileSkillReview);
});

document.querySelector('#close-profile-review').addEventListener('click', closeProfileLevelReview);
document.querySelector('#cancel-profile-review').addEventListener('click', closeProfileLevelReview);
document.querySelector('#profile-level-review-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!activeProfileReviewSkill) return;
  const targetLevel = Number(document.querySelector('#profile-review-target').value);
  const reason = document.querySelector('#profile-review-reason').value;
  const evidence = document.querySelector('#profile-review-evidence').value.trim();
  const { profile, skill, currentLevel } = activeProfileReviewSkill;
  approvalItems.unshift({
    id: `manager-review-${Date.now()}`, kind: 'downgrade', applicant: profile.name, avatar: profile.avatar, department: profile.org,
    title: skill[0], currentLevel, targetLevel, sourceLabel: '管理者主动发起', submittedAt: '刚刚', due: '09-23', status: 'pending',
    detail: `${reason}。管理者说明：${evidence}`,
    anchor: `请对照 ${skill[0]} L${currentLevel} 行为锚点，确认员工是否仍能在当前职责范围内稳定达到该等级。`,
    employeeResponse: '等待员工补充说明'
  });
  selectedApprovalId = approvalItems[0].id;
  skill[5] = { ...(skill[5] || {}), lastUsed: skill[5]?.lastUsed || '近 6 个月', status: '降级复核中' };
  renderEmployeeProfile(profile.id);
  renderApprovalQueue();
  showToast(`已发起 ${profile.name} 的${skill[0]} L${currentLevel} → L${targetLevel} 复核，员工将收到通知。`);
});

function openEmployeeProfile(id) {
  if (currentPage !== 'profile') profileReturnPage = currentPage;
  renderEmployeeProfile(id);
  document.querySelectorAll('#manager-nav .nav-item').forEach(item => item.classList.remove('active'));
  closeEmployeeLookup();
  showPage('profile');
}

function employeeSearchCatalogue() {
  const directProfiles = Object.values(employeeProfiles).map(item => ({ id:item.id, name:item.name, avatar:item.avatar, tone:item.tone, role:item.role, meta:item.org, searchText:[...item.skills.map(skill => skill[0]), ...item.traits.map(trait => trait[1])].join(' ') }));
  const ids = new Set(directProfiles.map(item => item.id));
  const candidates = allTalentCandidates().filter(item => !ids.has(item.id)).map(item => ({ id:item.id, name:item.name, avatar:item.avatar, tone:item.avatarTone, role:item.role, meta:item.org, searchText:item.evidence.join(' ') }));
  return [...directProfiles, ...candidates];
}

function renderEmployeeLookup(query = '') {
  const normalized = query.trim().toLowerCase();
  const items = employeeSearchCatalogue().filter(item => `${item.name} ${item.role} ${item.meta} ${item.searchText}`.toLowerCase().includes(normalized)).slice(0, 7);
  document.querySelector('#employee-lookup-list').innerHTML = items.length ? items.map(item => `<button class="employee-lookup-item" role="option" data-open-profile="${item.id}"><i class="${item.tone || ''}">${item.avatar}</i><span><b>${item.name}</b><small>${item.role} · ${item.meta.split(' · ')[0]}</small></span><span>→</span></button>`).join('') : '<div class="employee-lookup-empty">没有找到匹配的员工</div>';
}

function closeEmployeeLookup() {
  const lookup = document.querySelector('#employee-lookup');
  const trigger = document.querySelector('#employee-lookup-trigger');
  lookup.classList.add('hidden');
  trigger.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', event => {
  const profileTrigger = event.target.closest('[data-open-profile]');
  if (profileTrigger && profileTrigger.dataset.openProfile) {
    event.preventDefault();
    openEmployeeProfile(profileTrigger.dataset.openProfile);
  }
});

document.querySelector('#profile-back').addEventListener('click', () => {
  const target = ['manager','talent','succession','team'].includes(profileReturnPage) ? profileReturnPage : 'manager';
  const navItem = document.querySelector(`#manager-nav [data-page="${target}"]`);
  if (navItem) navItem.classList.add('active');
  showPage(target);
});

const employeeLookupTrigger = document.querySelector('#employee-lookup-trigger');
const employeeLookup = document.querySelector('#employee-lookup');
const employeeLookupInput = document.querySelector('#employee-lookup-input');
employeeLookupTrigger.addEventListener('click', event => {
  event.stopPropagation();
  const open = employeeLookup.classList.contains('hidden');
  employeeLookup.classList.toggle('hidden', !open);
  employeeLookupTrigger.setAttribute('aria-expanded', String(open));
  if (open) { renderEmployeeLookup(); employeeLookupInput.focus(); }
});
employeeLookupInput.addEventListener('input', event => renderEmployeeLookup(event.target.value));
employeeLookup.addEventListener('click', event => {
  event.stopPropagation();
  const item = event.target.closest('[data-open-profile]');
  if (item) openEmployeeProfile(item.dataset.openProfile);
});
document.addEventListener('click', closeEmployeeLookup);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeEmployeeLookup(); });

function openProfileSources() {
  const profile = profileById(activeProfileId);
  const returnFocus = document.querySelector('#profile-sources-trigger');
  const backdrop = document.createElement('div');
  backdrop.className = 'profile-source-backdrop';
  backdrop.innerHTML = `<aside class="profile-source-panel" role="dialog" aria-modal="true" aria-labelledby="profile-source-title"><button aria-label="关闭数据来源">×</button><h3 id="profile-source-title">数据来源</h3><p>${profile.name}的画像由已授权数据汇总，每项特征均保留原始依据与更新时间。</p><div class="profile-source-row"><b>HR 基础信息</b><span>岗位、职级、组织与任职状态 · 每日同步</span></div><div class="profile-source-row"><b>技能认证记录</b><span>正式技能等级、证据、审批人与有效期 · ${profile.updated}</span></div><div class="profile-source-row"><b>项目与成果记录</b><span>本人提交或项目负责人确认的职责与量化成果</span></div><div class="profile-source-row"><b>发展目标与管理反馈</b><span>员工与直属管理者共同确认；仅在当前管理范围内可见</span></div></aside>`;
  document.body.appendChild(backdrop);
  const onKeydown = event => { if (event.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKeydown); backdrop.remove(); returnFocus.focus(); };
  backdrop.addEventListener('click', event => { if (event.target === backdrop || event.target.closest('.profile-source-panel > button')) close(); });
  document.addEventListener('keydown', onKeydown);
  backdrop.querySelector('button').focus();
}

document.querySelector('#profile-sources-trigger').addEventListener('click', openProfileSources);
document.querySelector('#profile-share').addEventListener('click', () => showToast('已生成当前权限范围内的画像摘要，敏感字段不会包含在分享内容中。'));
document.querySelector('#profile-checkin').addEventListener('click', () => showToast(`已为${profileById(activeProfileId).name}创建成长沟通草稿。`));
document.querySelector('#profile-plan').addEventListener('click', () => showToast('已定位到发展计划，完整产品中将展开里程碑与验证任务。'));
document.querySelector('#profile-correction').addEventListener('click', () => showToast('纠错申请已创建，提交后将通知数据责任人核对。'));
document.querySelector('#profile-skill-standard').addEventListener('click', () => showToast('技能等级均按当前生效的岗位标准版本展示。'));
document.querySelector('#primary-action').addEventListener('click', () => { if (currentPage === 'profile') showToast('画像摘要已导出，内容遵循当前查看权限。'); });

renderEmployeeProfile(activeProfileId);

const initialPage = window.location.hash.slice(1);
const managerPages = new Set(['manager', 'approval', 'talent', 'succession', 'team', 'profile']);
if (initialPage && titleMap[initialPage]) {
  if (managerPages.has(initialPage)) {
    document.querySelector('#employee-nav').classList.add('hidden');
    document.querySelector('#manager-nav').classList.remove('hidden');
    roleSwitch.firstChild.textContent = '管理者工作台 ';
    document.querySelectorAll('#manager-nav .nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === initialPage));
  }
  showPage(initialPage);
} else if (initialPage) {
  showPage('overview');
}
