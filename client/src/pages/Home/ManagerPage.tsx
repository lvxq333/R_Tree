import { useCallback, useEffect, useState } from 'react';
import type { HeatDetailResponse, ManagerDashboardResponse } from '@shared/api.interface';
import { getHeatDetail, getManagerDashboard } from '@/api/fact-center';
import { useUI } from './ui-context';

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
  const [riskDetail,setRiskDetail]=useState<ManagerDashboardResponse['risks'][number]|null>(null);
  const [activeHeatCell,setHeatCell]=useState<{skillSlug:string;skillName:string;grade:string}|null>(null);
  const [heatDetail,setHeatDetail]=useState<HeatDetailResponse|null>(null);
  const [heatLoading,setHeatLoading]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {setData(await getManagerDashboard({role,grade}));}
    catch {setError('团队数据读取失败，请重试。');}
    finally {setLoading(false);}
  },[role,grade]);
  useEffect(()=>{setVisibleMembers(10);void load();},[load]);
  useEffect(()=>{const handler=()=>{if(data)downloadSummary(data);};window.addEventListener('manager:export',handler);
    return ()=>window.removeEventListener('manager:export',handler);},[data]);
  const GRADES=data?.filters.grades??['T1','T2','T3','T4'];
  const scope=data?.scope;
  const rate=scope?.requirementCount ? `${Math.round(scope.metCount/scope.requirementCount*100)}%` : '—';
  const progress=scope?.actionCount ? `${Math.round(scope.completedActionCount/scope.actionCount*100)}%` : '—';
  // 职级筛选 = 只看该档这一列（其余列置「—」）；达标人数的人群按岗位筛选，不受职级筛选影响
  const heatCell=(row:ManagerDashboardResponse['heat'][number])=>grade?row.grades.find(cell=>cell.grade===grade):undefined;
  // 排序键固定按「全部档位的变化量」计算，切换职级筛选时技能行顺序保持不变（只隐藏该档不要求的技能）
  const heatWeight=(row:ManagerDashboardResponse['heat'][number])=>
    row.grades.reduce((sum,item)=>sum+Math.abs(item.met-item.pastMet),0);
  const heatRows=[...(data?.heat??[])]
    .sort((a,b)=>heatWeight(b)-heatWeight(a)||a.name.localeCompare(b.name,'zh-Hans-CN'))
    .filter(row=>!grade||((heatCell(row)?.threshold??null)!==null));
  const heat=showAllSkills?heatRows:heatRows.slice(0,5);
  // 功能统一：所有角色点击成员都进入员工画像，画像内容按查看权限返回
  const openEmployee=(slug:string)=>{
    openProfile(slug);
  };
  // 热力图单元格明细：拉取该技能 × 职级门槛下的达标成员（人群口径与热力图一致，只受岗位筛选影响）
  const openHeatCell=(skillSlug:string,skillName:string,cellGrade:string)=>{
    setHeatCell({skillSlug,skillName,grade:cellGrade});setHeatDetail(null);setHeatLoading(true);
    getHeatDetail({skill:skillSlug,grade:cellGrade,role}).then(setHeatDetail)
      .catch(()=>setHeatDetail(null)).finally(()=>setHeatLoading(false));
  };
  useEffect(()=>{
    if(!riskDetail&&!activeHeatCell)return;
    const handler=(event:KeyboardEvent)=>{if(event.key==='Escape'){setRiskDetail(null);setHeatCell(null);}};
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[riskDetail,activeHeatCell]);
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
      <article><span>P0 技能缺口</span><strong className="danger">{loading?'…':scope?.p0GapCount??0}</strong><small>当前或下一职级目标高于有效认证至少 3 级</small></article>
      <article><span>发展行动完成率</span><strong>{loading?'…':progress}</strong><small>{scope?.planCount??0} 人有正式计划 · {scope?.completedActionCount??0}/{scope?.actionCount??0} 项完成</small></article>
    </div>
    <div className="manager-grid">
      <section className="panel heat-panel"><div className="section-head"><div><h3>职级—技能满足人数变动</h3><p>单元格为近 30 天达到该职级要求等级的人数变化，点击单元格查看达标成员明细</p></div>
        <button className="ghost" onClick={()=>setShowAllSkills(value=>!value)} disabled={!data?.heat.length}>{showAllSkills?'收起技能':'查看完整热力图'}</button></div>
        <div className="heat-table" style={{gridTemplateColumns:`minmax(150px,1fr) repeat(${GRADES.length},65px)`,overflowX:'auto'}}><span>技能</span>{GRADES.map(value=><b key={value} className={grade===value?'active':''}>{value}</b>)}
          {heat.map(row=><div className="manager-heat-row" key={row.skillSlug}><span>{row.name}</span>{row.grades.map(cell=>{
            const dimmed=Boolean(grade)&&cell.grade!==grade;
            const delta=cell.met-cell.pastMet;
            const className=dimmed||cell.threshold===null?'h3':delta>0?'h1':delta<0?'h5':'h3';
            const label=dimmed||cell.threshold===null?'—':delta>0?`+${delta}`:String(delta);
            const clickable=!dimmed&&cell.threshold!==null;
            const detail=dimmed?`当前只看 ${grade} 档，其余档位不参与统计`
              :cell.threshold===null?`${cell.grade}：该职级标准不要求此技能`
              :`${cell.grade}（要求 L${cell.threshold}）：达标 ${cell.pastMet}→${cell.met} 人（新增 ${cell.gained} / 失效 ${cell.lost}），点击查看达标成员`;
            return <i key={cell.grade} className={clickable?`${className} clickable`:className} title={detail}
              onClick={clickable?()=>openHeatCell(row.skillSlug,row.name,cell.grade):undefined}>{label}</i>;})}</div>)}</div>
        {!loading && !heat.length && <p className="fc-empty">{grade?`${grade} 职级标准没有可统计的技能要求`:'当前筛选下没有可计算的技能达标数据'}</p>}
        <div className="legend"><span><i className="supply" />满足人数上升</span><span><i className="balanced" />持平</span><span><i className="shortage" />满足人数下降</span></div>
      </section>
      <section className="panel risk-panel"><div className="section-head"><div><h3>需要管理动作</h3><p>根据技能差距与复核日期生成</p></div><span>{data?.risks.length??0} 项</span></div>
        {data?.risks.map((risk,index)=><div className={`risk-item ${risk.severity==='high'?'critical':'warning'}`} key={`${risk.kind}-${index}`}>
          <span>{risk.severity==='high'?'高':'中'}</span><div><b>{risk.title}</b><p>{risk.detail}</p>
            <button onClick={()=>setRiskDetail(risk)}>查看相关员工{risk.employees?.length?`（${risk.employees.length}）`:''} →</button></div></div>)}
        {!loading && !data?.risks.length && <p className="fc-empty">当前筛选范围内没有识别出需处理的事项</p>}
      </section>
    </div>
    {riskDetail && <div className="risk-modal-mask" onClick={event=>{if(event.target===event.currentTarget)setRiskDetail(null);}}>
      <div className="risk-modal" role="dialog" aria-modal="true" aria-label={riskDetail.title}>
        <div className="risk-modal-head"><div><h4>{riskDetail.title}</h4><p>{riskDetail.detail}</p></div>
          <button type="button" aria-label="关闭" onClick={()=>setRiskDetail(null)}>✕</button></div>
        <div className="risk-modal-list">
          {(riskDetail.employees??[]).map(employee=><button type="button" className="risk-modal-row" key={employee.slug}
            onClick={()=>{setRiskDetail(null);openEmployee(employee.slug);}}>
            <i className="mini-avatar">{employee.name.slice(0,1)}</i>
            <span><b>{employee.name}</b><small>{employee.grade??'未定级'} · {employee.role??'未填写岗位'}</small></span>
            {employee.note && <span className="note">{employee.note}</span>}
            <span aria-hidden="true">→</span></button>)}
          {!riskDetail.employees?.length && <p className="fc-empty">暂无可查看的相关员工</p>}
        </div>
      </div>
    </div>}
    {activeHeatCell && <div className="risk-modal-mask" onClick={event=>{if(event.target===event.currentTarget)setHeatCell(null);}}>
      <div className="risk-modal" role="dialog" aria-modal="true" aria-label="技能达标明细">
        <div className="risk-modal-head"><div><h4>{activeHeatCell.skillName} · {activeHeatCell.grade}</h4>
          <p>{heatLoading?'正在读取…':heatDetail&&heatDetail.threshold!==null
            ?`要求 L${heatDetail.threshold} · 当前达标 ${heatDetail.met} 人，近 30 天新增 ${heatDetail.gained} 人`
            :'该职级标准不要求此技能'}</p></div>
          <button type="button" aria-label="关闭" onClick={()=>setHeatCell(null)}>✕</button></div>
        <div className="risk-modal-list">
          {(heatDetail?.employees??[]).map(person=><button type="button" className="risk-modal-row" key={person.slug}
            onClick={()=>{setHeatCell(null);openEmployee(person.slug);}}>
            <i className="mini-avatar">{person.name.slice(0,1)}</i>
            <span><b>{person.name}</b><small>{person.grade??'未定级'} · {person.department??'未填写部门'} · 当前 L{person.level}</small></span>
            <span className="note">{person.certifiedAt
              ?`${person.gained?'新增 · ':''}${new Date(person.certifiedAt).toLocaleDateString('zh-CN')} 达标`:'达标时间未知'}</span>
            <span aria-hidden="true">→</span></button>)}
          {!heatLoading && heatDetail && !heatDetail.employees.length && <p className="fc-empty">该门槛下暂无达标成员</p>}
        </div>
      </div>
    </div>}
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
