import { useCallback, useEffect, useRef, useState } from 'react';
import { idpApi } from '@/api';
import type { IdpAction, IdpActionStatus, IdpOptions, IdpResponse, IdpRevision, IdpLiveReview } from '@shared/api.interface';
import { useUI } from './ui-context';
import { downloadIdp, idpText } from './idp-export';

const STATES: Record<IdpActionStatus,string> = {todo:'待开始','in-progress':'进行中',done:'已完成'};
const MILESTONES: Record<string,string> = {done:'已完成',current:'进行中',next:'待启动'};
const monthNow = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date());
function message(error: unknown): string {
  const value = error as {response?: {data?: {message?: string;error?: {message?: string}}}};
  return value.response?.data?.error?.message ?? value.response?.data?.message ?? '操作失败，请稍后重试';
}
function EditorDialog({title,children,onClose}: {title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="idp-edit-dialog" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="section-head"><h3>{title}</h3><button className="ghost" onClick={onClose} aria-label="关闭对话框">关闭</button></div>{children}
  </dialog>;
}

const IDPPage = () => {
  const {navigate,showToast} = useUI();
  const [saved,setSaved] = useState<IdpResponse|null>(null);
  const [draft,setDraft] = useState<IdpResponse|null>(null);
  const [historical,setHistorical] = useState<IdpResponse|null>(null);
  const [options,setOptions] = useState<IdpOptions|null>(null);
  const [live,setLive] = useState<IdpLiveReview|null>(null);
  const [reviewError,setReviewError] = useState(false);
  const [loadError,setLoadError] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [configure,setConfigure] = useState(false);
  const [target,setTarget] = useState('');
  const [startMonth,setStartMonth] = useState(monthNow);
  const [months,setMonths] = useState(24);
  const [actionEditor,setActionEditor] = useState<IdpAction|null>(null);
  const [evidenceLink,setEvidenceLink] = useState('');
  const [alignmentOpen,setAlignmentOpen] = useState(false);
  const [participant,setParticipant] = useState('');
  const [alignmentDate,setAlignmentDate] = useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  const [alignmentNote,setAlignmentNote] = useState('');
  const [history,setHistory] = useState<IdpRevision[]|null>(null);
  const plan = historical ?? draft ?? saved;
  const hasPlan = Boolean(plan?.phases.length);
  const readonly = Boolean(draft || historical || !saved?.meta);
  const actions = plan?.phases.flatMap(phase=>phase.actions) ?? [];
  const completed = actions.filter(action=>action.status==='done').length;

  const load = useCallback(async()=>{
    try {
      const [next,settings] = await Promise.all([idpApi.getIdp(),idpApi.getOptions()]);
      setSaved(next);setOptions(settings);setLoadError('');
      setTarget(next.meta ? `${next.meta.track}:${next.meta.level}` : settings.defaultTarget ? `${settings.defaultTarget.track}:${settings.defaultTarget.level}` : '');
      setStartMonth(next.meta?.startMonth ?? monthNow());setMonths(next.meta?.months ?? 24);
    } catch (cause) {setLoadError(message(cause));}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if (!saved?.meta) return;
    let active = true;
    idpApi.review().then(result=>{if(active){setLive(result);setReviewError(false);}}).catch(()=>{if(active){setLive(null);setReviewError(true);}});
    return ()=>{active=false;};
  },[saved]);
  useEffect(()=>{
    const exportPlan = ()=>{ if(plan?.phases.length) window.print(); else showToast('请先生成个人计划'); };
    window.addEventListener('idp:export',exportPlan);
    return ()=>window.removeEventListener('idp:export',exportPlan);
  },[plan,showToast]);

  async function run(operation:()=>Promise<void>) {
    setError('');setBusy(true);
    try {await operation();} catch(cause){setError(message(cause));} finally {setBusy(false);}
  }
  const generate = () => run(async()=>{
    const [track,level] = target.split(':');
    const result = await idpApi.generate({track,level,startMonth,months});
    setDraft(result);setHistorical(null);setConfigure(false);setHistory(null);
  });
  const save = () => run(async()=>{
    if(!draft?.meta?.draftId) return;
    const result = await idpApi.confirm(draft.meta.draftId);
    setSaved(result);setDraft(null);setHistory(null);showToast('个人发展计划已保存');
  });
  const saveAction = () => run(async()=>{
    if(!actionEditor?.id || !saved?.meta) return;
    const result = await idpApi.updateAction(actionEditor.id,{revision:saved.meta.revision,status:actionEditor.status ?? 'todo',
      resultNote:actionEditor.resultNote ?? '',evidenceSlugs:actionEditor.evidenceSlugs ?? [],evidenceLink,title:actionEditor.title,window:actionEditor.window});
    setSaved(result);setActionEditor(null);setEvidenceLink('');setHistory(null);
    const evidence = result.phases.flatMap(phase=>phase.actions.flatMap(action=>action.evidence ?? []));
    setOptions(current=>current ? {...current,evidence:[...new Map([...current.evidence,...evidence].map(item=>[item.slug,item])).values()]} : current);
    showToast('行动与成果已保存');
  });
  const saveAlignment = () => run(async()=>{
    if(!saved?.meta) return;
    const result = await idpApi.align({revision:saved.meta.revision,participant,date:alignmentDate,note:alignmentNote});
    setSaved(result);setAlignmentOpen(false);setAlignmentNote('');setHistory(null);showToast('对齐记录已保存');
  });
  const copy = async()=>{
    if(!plan) return;
    try {await navigator.clipboard.writeText(idpText(plan));showToast('完整 IDP 已复制到剪贴板');}
    catch {setError('复制失败，可使用“下载文本”保存完整计划');}
  };
  const gapPool = ()=>{
    sessionStorage.setItem('idp-gap-focus','1');navigate('overview');
  };
  const currentReadiness = !draft && !historical && live ? live.readiness : plan?.positioning.readiness;

  if(loadError && !saved) return <section id="idp" className="page active"><section className="panel idp-hero"><div><h2>个人计划暂不可用</h2><p role="alert">{loadError}</p><button className="primary" onClick={()=>{void load();}}>重新加载</button></div></section></section>;
  if(!saved || !options) return <section id="idp" className="page active"><section className="panel idp-hero"><p>正在核对个人职称、能力 Gap 与已有计划…</p></section></section>;

  return <section className="page active" id="idp" aria-busy={busy}>
    <div className="idp-toolbar idp-no-print">
      <span>{draft ? '草案预览 · 尚未保存' : historical ? `历史版本 v${historical.meta?.revision} · 只读` : saved.meta ? `正式计划 v${saved.meta.revision} · ${new Date(saved.meta.updatedAt).toLocaleString('zh-CN')}` : hasPlan ? '历史计划 · 重新生成后可维护进度' : '首次制定个人发展计划'}</span>
      <div>
        {!draft && !historical && <button className="ghost" disabled={busy} onClick={()=>setConfigure(value=>!value)}>{hasPlan ? '调整目标 / 重新生成' : '选择目标与周期'}</button>}
        {saved.meta && !draft && <button className="ghost" disabled={busy} onClick={()=>{void run(async()=>{setHistory(await idpApi.history());});}}>版本记录</button>}
        {historical && <button className="primary" onClick={()=>{setHistorical(null);setError('');}}>返回当前计划</button>}
      </div>
    </div>
    {error && <div className="idp-error idp-no-print" role="alert">{error}<button className="ghost" disabled={busy} onClick={()=>{void run(async()=>{await load();});}}>刷新计划数据</button></div>}
    {(configure || !hasPlan) && !draft && <section className="panel idp-setup idp-no-print">
      <h3>{hasPlan ? '调整目标与计划周期' : '制定你的第一份个人计划'}</h3>
      <p>依据当前职称、目标要求与真实 Gap 生成草案；确认后保存，再逐步记录实践与成果。</p>
      <form onSubmit={event=>{event.preventDefault();void generate();}}>
        <label>目标职称<select value={target} required disabled={busy} onChange={event=>setTarget(event.target.value)}>
          <option value="">请选择目标职称</option>{options.overview.tracks.flatMap(track=>track.levels.map(level=><option key={`${track.slug}:${level.levelCode}`} value={`${track.slug}:${level.levelCode}`}>{track.name} · {level.levelCode} {level.levelName}{level.state==='certified' ? '（保持与巩固）' : ''}</option>))}
        </select></label>
        <label>开始月份<input type="month" min="2000-01" max="2099-12" value={startMonth} required disabled={busy} onChange={event=>setStartMonth(event.target.value)}/></label>
        <label>计划周期<select value={months} disabled={busy} onChange={event=>setMonths(Number(event.target.value))}><option value={12}>12 个月</option><option value={24}>24 个月</option><option value={36}>36 个月</option></select></label>
        <button className="primary" disabled={busy || !target}>{busy ? '正在生成…' : '生成计划草案'}</button>
      </form>
    </section>}
    {draft && <section className="panel idp-draft-banner idp-no-print"><div><h3>确认这份计划草案</h3><ul>{draft.changes?.map(item=><li key={item}>{item}</li>)}</ul><p>下面展示拟保存内容。已保存计划保持有效，确认后更新。</p></div><div><button className="primary" disabled={busy} onClick={()=>{void save();}}>{busy ? '正在保存…' : '确认并保存计划'}</button><button className="ghost" disabled={busy} onClick={()=>{setDraft(null);setConfigure(true);}}>返回调整</button><button className="ghost" disabled={busy} onClick={()=>{setDraft(null);setConfigure(false);}}>放弃预览</button></div></section>}
    {!draft && !historical && saved.meta && live?.changed && <section className="panel idp-change-notice idp-no-print"><span>认证或目标要求已有变化：最新就绪度 {live.readiness}%，当前剩余 {live.gaps.length} 项目标 Gap。行动仍按已保存计划执行。</span><button className="primary" disabled={busy} onClick={()=>{setConfigure(true);}}>生成调整建议</button></section>}
    {reviewError && !draft && !historical && <p className="idp-error" role="status">最新资格暂时不可用，当前显示保存时的就绪度。</p>}
    {hasPlan && plan && <>
      <section className="panel idp-hero">
        <div><span className="overline idp-overline">Individual Development Plan</span><h2>个人发展计划 · IDP</h2><p>{plan.positioning.readinessNote}</p>
          <div className="idp-hero-route"><span className="idp-node current"><b>当前</b>{plan.positioning.currentRole}</span><i className="idp-arrow">→</i><span className="idp-node target"><b>目标</b>{plan.positioning.targetRole}</span><span className="idp-horizon">{plan.positioning.horizon}</span></div>
        </div><div className="idp-readiness"><strong>{currentReadiness}%</strong><span>目标职称就绪度</span><em>{!draft && !historical && live ? `最新达标 ${live.met}/${live.total} 项` : '依据生成时目标要求计算'}</em><small>行动完成 {completed}/{actions.length} 项</small></div>
      </section>
      <div className="idp-grid">
        <section className="panel idp-status"><div className="section-head"><div><h3>现状盘点</h3><p>个人情况摘要 · 依据有效认证与目标要求</p></div></div><div className="idp-status-cols"><div><h4>优势 · 继续保持</h4><ul>{plan.positioning.strengths.map(item=><li key={item}>{item}</li>)}</ul></div><div><h4>短板 · 重点投入</h4><ul>{plan.positioning.weaknesses.map(item=><li key={item}>{item}</li>)}</ul></div></div></section>
        <section className="panel idp-gaps"><div className="section-head"><div><h3>Gap 输入</h3><p>本计划包含 {plan.gaps.length} 项 Gap，按优先级安排投入</p></div><button className="ghost idp-no-print" onClick={gapPool}>查看成长 Gap 池 →</button></div><ul className="idp-gap-list">{plan.gaps.map(gap=><li key={gap.key ?? `${gap.title}:${gap.note}`}><b className={gap.priority==='P0' ? 'danger' : undefined}>{gap.priority}</b><span>{gap.title}<small className="idp-gap-source">{gap.source}</small></span><small>{gap.note}</small></li>)}</ul>{!plan.gaps.length && <p>目标要求均已达标，后续阶段用于维持能力和准备正式评审。</p>}</section>
      </div>
      <section className="panel idp-phases-panel"><div className="section-head"><div><h3>阶段规划</h3><p>{plan.meta?.months ?? 24} 个月四阶段：先夯实基线，再做重点实践，扩大协作应用，最后准备目标评审</p></div><button className="ghost idp-no-print" onClick={()=>{void copy();}}>复制 IDP</button></div>
        <div className="idp-phases">{plan.phases.map(phase=><article key={phase.id ?? phase.range} className="idp-phase"><header><span className="idp-phase-range">{phase.range}</span><h4>{phase.title}</h4><p>{phase.theme}</p></header><div className="idp-phase-gaps">{phase.focusGaps.map(gap=><span key={gap}>{gap}</span>)}</div><dl className="idp-phase-facts"><div><dt>阶段目标</dt><dd>{phase.objective}</dd></div><div><dt>里程碑</dt><dd>{phase.milestone}</dd></div><div><dt>阶段成果</dt><dd>{phase.outcome}</dd></div></dl>
          <ul className="idp-phase-actions">{phase.actions.map(action=><li key={action.id ?? action.title}><span className={`resource-label ${action.kind}`}>{action.kindLabel}</span><div className="idp-action-body"><b>{action.title}{action.carriedOver && <span className="idp-gap-source">原计划保留成果 / 已开始行动</span>}</b><small>{action.window} · 对应 {action.gap} · 证明：{action.proof}</small>{action.effort && <small>建议投入：{action.effort}</small>}{action.resourceUrl && <a href={action.resourceUrl} target="_blank" rel="noreferrer">查看学习资源 ↗</a>}
            <div className="idp-action-progress"><span className={`idp-action-state ${action.status ?? 'todo'}`}>{STATES[action.status ?? 'todo']}</span><span>{action.evidenceSlugs?.length ?? 0} 份关联证据</span>{!readonly && action.id && <button className="ghost idp-no-print" disabled={busy} onClick={()=>{setError('');setEvidenceLink('');setActionEditor({...action,evidenceSlugs:[...(action.evidenceSlugs ?? [])]});}}>更新进度与成果</button>}</div>
            {action.resultNote && <p className="idp-result-note">成果：{action.resultNote}</p>}
            {action.evidence?.map(item=><div className="idp-evidence-link" key={item.slug}>{item.url && /^https?:\/\//.test(item.url) ? <a href={item.url} target="_blank" rel="noreferrer">成果材料：{item.title} ↗</a> : <span>关联材料：{item.title}</span>}</div>)}
          </div></li>)}</ul>
        </article>)}</div>
      </section>
      <div className="idp-grid"><section className="panel idp-timeline-panel"><div className="section-head"><div><h3>里程碑与检查点</h3><p>{plan.reviewCadence}</p></div></div><ol className="idp-timeline">{plan.milestones.map(point=><li key={`${point.time}:${point.title}`} className={point.state}><i/><div><b>{point.time} · {point.title}</b><small>{point.detail}</small><em>{MILESTONES[point.state]}</em></div></li>)}</ol></section>
        <section className="panel idp-adjust-panel"><div className="section-head"><div><h3>调整机制</h3><p>依据变化提出调整草案，确认后生效</p></div></div><ul className="idp-adjust-list">{plan.adjustRules.map(rule=><li key={rule.trigger}><b>{rule.trigger}</b><p>{rule.action}</p></li>)}</ul></section>
      </div>
      <section className="panel idp-alignment"><div className="section-head"><div><h3>与管理者对齐记录</h3><p>记录实际沟通的议题、反馈与后续动作</p></div>{!readonly && <button className="primary idp-no-print" disabled={busy} onClick={()=>{setError('');setAlignmentOpen(true);}}>记录一次对齐</button>}</div>{!plan.alignments?.length ? <p>暂无对齐记录，可在沟通后补充。</p> : plan.alignments.map(item=><article key={item.id}><b>{item.date} · {item.participant}</b><p>{item.note}</p></article>)}</section>
      <section className="panel idp-footer"><p>行动成果可关联本人证据；完成计划不代表认证通过，技能与职称仍需按正式流程申请。</p><div className="idp-no-print"><button className="primary" disabled={readonly || busy} onClick={()=>{setError('');setAlignmentOpen(true);}}>与管理者对齐</button><button className="ghost" onClick={()=>window.print()}>打印 / 导出 PDF</button><button className="ghost" onClick={()=>downloadIdp(plan)}>下载文本</button><button className="ghost" onClick={()=>navigate('overview')}>返回成长概览</button></div></section>
    </>}
    {actionEditor && <EditorDialog title="更新行动与成果" onClose={()=>{if(!busy)setActionEditor(null);}}><form onSubmit={event=>{event.preventDefault();void saveAction();}}>
      <label>行动名称<input value={actionEditor.title} maxLength={255} required onChange={event=>setActionEditor({...actionEditor,title:event.target.value})}/></label>
      <label>时间安排<input value={actionEditor.window} maxLength={128} required onChange={event=>setActionEditor({...actionEditor,window:event.target.value})}/></label>
      <label>行动状态<select value={actionEditor.status ?? 'todo'} onChange={event=>setActionEditor({...actionEditor,status:event.target.value as IdpActionStatus})}>{Object.entries(STATES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>成果说明<textarea rows={4} value={actionEditor.resultNote ?? ''} maxLength={4000} minLength={actionEditor.status==='done' ? 5 : undefined} required={actionEditor.status==='done'} placeholder="记录本人做了什么、交付物和可验证结果；标记完成时必填" onChange={event=>setActionEditor({...actionEditor,resultNote:event.target.value})}/></label>
      <label>新增成果材料链接（可选）<input type="url" value={evidenceLink} maxLength={512} placeholder="https://… 仅登记链接与说明，不自动提交认证" onChange={event=>setEvidenceLink(event.target.value)}/></label>
      <fieldset><legend>关联本人证据</legend>{options.evidence.length ? options.evidence.map(evidence=><label className="idp-evidence-option" key={evidence.slug}><input type="checkbox" checked={actionEditor.evidenceSlugs?.includes(evidence.slug) ?? false} onChange={event=>setActionEditor({...actionEditor,evidenceSlugs:event.target.checked ? [...(actionEditor.evidenceSlugs ?? []),evidence.slug] : actionEditor.evidenceSlugs?.filter(slug=>slug!==evidence.slug)})}/>{evidence.title}</label>) : <p>暂无已登记证据。可先保存成果说明，已有材料登记后再关联。</p>}</fieldset>
      {error && <p className="idp-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? '保存中…' : '保存进度与成果'}</button>
    </form></EditorDialog>}
    {alignmentOpen && <EditorDialog title="记录与管理者的对齐" onClose={()=>{if(!busy)setAlignmentOpen(false);}}><form onSubmit={event=>{event.preventDefault();void saveAlignment();}}>
      <label>对齐人<input value={participant} maxLength={100} required placeholder="实际参与沟通的管理者或导师" onChange={event=>setParticipant(event.target.value)}/></label><label>对齐日期<input type="date" value={alignmentDate} required onChange={event=>setAlignmentDate(event.target.value)}/></label><label>议题、反馈与后续动作<textarea rows={5} required maxLength={4000} value={alignmentNote} onChange={event=>setAlignmentNote(event.target.value)}/></label>{error && <p className="idp-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? '保存中…' : '保存对齐记录'}</button>
    </form></EditorDialog>}
    {history && <EditorDialog title="计划版本记录" onClose={()=>setHistory(null)}><ul className="idp-history">{history.map(item=><li key={item.revision}><div><b>v{item.revision} · {item.reason}</b><small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div><button className="ghost" disabled={busy} onClick={()=>{void run(async()=>{setHistorical(await idpApi.version(item.revision));setHistory(null);});}}>查看此版本</button></li>)}</ul></EditorDialog>}
  </section>;
};
export default IDPPage;
