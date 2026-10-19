import { useUI } from './ui-context';

const ManagerPage = () => {
  const { navigate, openProfile } = useUI();

  return (
    <section className="page active" id="manager">
      <div className="manager-hero"><div><h2>平台工程部 · 人才驾驶舱</h2><p>62 名员工 · 2026 Q3 · 数据有效率 91%</p></div><div className="filters"><button>全部岗位 ⌄</button><button>全部职级 ⌄</button><button>本季度 ⌄</button></div></div>
      <div className="signal-strip manager-signals"><article><span>关键技能满足率</span><strong>76%</strong><small className="up">↑ 4% 较上季度</small></article><article><span>关键岗位健康度</span><strong>8 / 12</strong><small>4 个岗位需要行动</small></article><article><span>P0 技能缺口</span><strong className="danger">17</strong><small>集中在 3 个技能域</small></article><article><span>路线执行率</span><strong>68%</strong><small>9 人本周无进展</small></article></div>
      <div className="manager-grid">
        <section className="panel heat-panel"><div className="section-head"><div><h3>核心技能供需</h3><p>需求等级与当前供给的差值</p></div><button className="ghost">查看完整热力图</button></div><div className="heat-table"><div></div><b>T1</b><b>T2</b><b>T3</b><b>T4</b><span>容器与编排</span><i className="h1">+8</i><i className="h2">+3</i><i className="h4">-4</i><i className="h5">-2</i><span>自动化开发</span><i className="h1">+5</i><i className="h3">+1</i><i className="h4">-6</i><i className="h5">-3</i><span>架构设计</span><i className="h2">+2</i><i className="h3">0</i><i className="h4">-3</i><i className="h5">-1</i><span>可观测性</span><i className="h1">+6</i><i className="h2">+3</i><i className="h3">0</i><i className="h4">-1</i></div><div className="legend"><span><i className="supply"></i>供给充足</span><span><i className="balanced"></i>基本平衡</span><span><i className="shortage"></i>存在缺口</span></div></section>
        <section className="panel risk-panel"><div className="section-head"><div><h3>需要管理动作</h3><p>按业务影响排序</p></div><span>4 项</span></div><div className="risk-item critical"><span>高</span><div><b>T4 平台架构师无成熟继任者</b><p>最近候选人匹配度 78%，仍缺架构治理能力。</p><button>查看梯队 →</button></div></div><div className="risk-item warning"><span>中</span><div><b>自动化开发 P0 Gap 集中</b><p>12 名 T2 员工中 7 人低于基线。</p><button>创建培养计划 →</button></div></div><div className="risk-item"><span>低</span><div><b>3 项技能数据即将过期</b><p>涉及 6 名员工，建议安排复核。</p><button>查看名单 →</button></div></div></section>
      </div>
      <section className="panel member-panel"><div className="section-head"><div><h3>团队成长状态</h3><p>聚焦目标与行动，不以单一分数评价员工</p></div><button className="primary" onClick={() => navigate('talent')}>寻找项目人才</button></div>
        <div className="member-row header"><span>成员</span><span>发展目标</span><span>P0 Gap</span><span>路线进度</span><span>下次 Check-in</span><span></span></div>
        <button className="member-row member-profile-row" onClick={() => openProfile('zhou-chen')}><span><i className="mini-avatar">周</i><b>周晨</b></span><span>T3 平台架构师</span><span><b className="danger">2 项</b></span><span><em><i style={{ width: '68%' }}></i></em>68%</span><span>09-22</span><span aria-hidden="true">→</span></button>
        <button className="member-row member-profile-row" onClick={() => openProfile('lin-xiao')}><span><i className="mini-avatar blue">林</i><b>林晓</b></span><span>T3 SRE 专家</span><span><b>1 项</b></span><span><em><i style={{ width: '82%' }}></i></em>82%</span><span>09-25</span><span aria-hidden="true">→</span></button>
        <button className="member-row member-profile-row" onClick={() => openProfile('chen-ran')}><span><i className="mini-avatar green">陈</i><b>陈然</b></span><span>待确认</span><span><b>—</b></span><span><em><i style={{ width: '24%' }}></i></em>24%</span><span className="danger">已逾期</span><span aria-hidden="true">→</span></button>
      </section>
    </section>
  );
};

export default ManagerPage;
