import { useCallback, useEffect, useState } from 'react';
import type { ManagerDashboardResponse } from '@shared/api.interface';
import { getManagerDashboard } from '@/api/fact-center';
import { useUI } from './ui-context';

const GRADES = ['T1','T2','T3','T4'];
function downloadSummary(data:ManagerDashboardResponse) {
  const rows = [['员工','岗位','职级','发展目标','P0 Gap','行动完成率','已登记 Check-in'],
    ...data.members.map(row=>[row.name,row.role,row.grade??'',row.target,row.p0Gaps,
      row.progress===null?'未制定计划':`${row.progress}%`,row.nextCheckin??''])];
  const content='\uFEFF'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`团队盘点-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ManagerPage() {
  const { navigate,openProfile }=useUI();
  const [role,setRole]=useState('');
  const [grade,setGrade]=useState('');
  const [data,setData]=useState<ManagerDashboardResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [showAllSkills,setShowAllSkills]=useState(false);
  const [visibleMembers,setVisibleMembers]=useState(10);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {setData(await getManagerDashboard({role,grade}));}
    catch {setError('团队数据读取失败，请重试。');}
    finally {setLoading(false);}
  },[role,grade]);
  useEffect(()=>{setVisibleMembers(10);void load();},[load]);
  useEffect(()=>{const handler=()=>{if(data)downloadSummary(data);};window.addEventListener('manager:export',handler);
    return ()=>window.removeEventListener('manager:export',handler);},[data]);
  const scope=data?.scope;
  const rate=scope?.requirementCount ? `${Math.round(scope.metCount/scope.requirementCount*100)}%` : '—';
  const progress=scope?.actionCount ? `${Math.round(scope.completedActionCount/scope.actionCount*100)}%` : '—';
  const heat=showAllSkills?data?.heat??[]:(data?.heat??[]).slice(0,5);
  // 功能统一：所有角色点击成员都进入员工画像，画像内容按查看权限返回
  const openEmployee=(slug:string)=>{
    openProfile(slug);
  };
  return <section className="page active" id="manager" aria-busy={loading}>
    <div className="manager-hero"><div><h2>团队技能地图</h2>
      <p>{loading?'正在读取…':`${scope?.employeeCount??0} 名可查看员工 · ${scope?.standardEmployeeCount??0} 人已配置适用标准`} · 按当前有效数据计算</p></div>
      <div className="filters manager-filters">
        <label>岗位<select aria-label="筛选岗位" value={role} onChange={event=>setRole(event.target.value)}><option value="">全部岗位</option>
          {data?.filters.roles.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label>职级<select aria-label="筛选职级" value={grade} onChange={event=>setGrade(event.target.value)}><option value="">全部职级</option>
          {GRADES.map(value=><option key={value}>{value}</option>)}</select></label>
        <button type="button" onClick={()=>void load()} disabled={loading}>刷新数据</button>
      </div></div>
    {error && <div className="source-explanation" role="alert">{error} <button onClick={()=>void load()}>重试</button></div>}
    <div className="signal-strip manager-signals">
      <article><span>关键技能满足率</span><strong>{loading?'…':rate}</strong><small>{scope?.requirementCount??0} 项岗位技能要求中满足 {scope?.metCount??0} 项</small></article>
      <article><span>已配置职级标准</span><strong>{loading?'…':`${scope?.standardEmployeeCount??0} / ${scope?.employeeCount??0}`}</strong><small>未配置者不计入满足率</small></article>
      <article><span>P0 技能缺口</span><strong className="danger">{loading?'…':scope?.p0GapCount??0}</strong><small>目标等级高于有效认证至少 3 级</small></article>
      <article><span>发展行动完成率</span><strong>{loading?'…':progress}</strong><small>{scope?.planCount??0} 人有正式计划 · {scope?.completedActionCount??0}/{scope?.actionCount??0} 项完成</small></article>
    </div>
    <div className="manager-grid">
      <section className="panel heat-panel"><div className="section-head"><div><h3>核心技能供需</h3><p>单元格为满足人数－要求人数；仅统计有适用职级标准的员工</p></div>
        <button className="ghost" onClick={()=>setShowAllSkills(value=>!value)} disabled={!data?.heat.length}>{showAllSkills?'收起技能':'查看完整热力图'}</button></div>
        <div className="heat-table"><span>技能</span>{GRADES.map(value=><b key={value}>{value}</b>)}
          {heat.map(row=><div className="manager-heat-row" key={row.skillSlug}><span>{row.name}</span>{row.grades.map(cell=><i key={cell.grade}
            className={cell.demand===0?'h3':cell.met===cell.demand?'h1':cell.met===0?'h5':'h4'}
            title={`${cell.grade}：${cell.met} 人满足 / ${cell.demand} 人有要求`}>{cell.demand?`${cell.met-cell.demand}`:'—'}</i>)}</div>)}</div>
        {!loading && !heat.length && <p className="fc-empty">当前筛选下没有可计算的岗位技能要求</p>}
        <div className="legend"><span><i className="supply" />全部满足</span><span><i className="balanced" />部分满足</span><span><i className="shortage" />存在缺口</span></div>
      </section>
      <section className="panel risk-panel"><div className="section-head"><div><h3>需要管理动作</h3><p>根据技能差距与复核日期生成</p></div><span>{data?.risks.length??0} 项</span></div>
        {data?.risks.map((risk,index)=><div className={`risk-item ${risk.severity==='high'?'critical':'warning'}`} key={`${risk.kind}-${index}`}>
          <span>{risk.severity==='high'?'高':'中'}</span><div><b>{risk.title}</b><p>{risk.detail}</p>
            <button onClick={()=>{if(risk.employeeSlug)openEmployee(risk.employeeSlug);}}>查看相关员工 →</button></div></div>)}
        {!loading && !data?.risks.length && <p className="fc-empty">当前筛选范围内没有识别出需处理的事项</p>}
      </section>
    </div>
    <section className="panel member-panel"><div className="section-head"><div><h3>团队成长状态</h3><p>按当前权限列出员工；点击成员查看详情</p></div>
      <button className="primary" onClick={()=>navigate('factCenter')}>查看员工宽表</button></div>
      <div className="member-row header"><span>成员</span><span>发展目标</span><span>P0 Gap</span><span>行动完成率</span><span>已登记 Check-in</span><span /></div>
      {data?.members.slice(0,visibleMembers).map(member=><button type="button" className="member-row member-profile-row" key={member.employeeSlug}
        onClick={()=>openEmployee(member.employeeSlug)}><span><i className="mini-avatar">{member.name.slice(0,1)}</i><b>{member.name}</b><small>{member.grade??'未定级'} · {member.role}</small></span>
        <span>{member.target}</span><span><b className={member.p0Gaps?'danger':''}>{member.p0Gaps} 项</b></span>
        <span>{member.progress===null?'—':<><em><i style={{width:`${member.progress}%`}} /></em>{member.progress}%</>}</span>
        <span>{member.nextCheckin||'未安排'}</span><span aria-hidden="true">→</span></button>)}
      {!loading && !data?.members.length && <p className="fc-empty">当前筛选下没有员工</p>}
      {(data?.members.length??0)>visibleMembers && <button type="button" className="ghost manager-more" onClick={()=>setVisibleMembers(count=>count+10)}>
        显示更多成员（已显示 {visibleMembers} / {data?.members.length}）</button>}
    </section>
  </section>;
}
