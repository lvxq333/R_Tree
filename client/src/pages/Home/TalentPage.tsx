import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { TalentCandidate, TalentCatalog, TalentCriteria, TalentSearchResponse, TalentWorkspace } from '@shared/api.interface';
import { talentApi } from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';
import TalentConditions from './TalentConditions';
import TalentCandidateList from './TalentCandidateList';
import ShortlistPanel from './ShortlistPanel';

type Segment='direct'|'adjacent'|'potential';
const SEGMENTS:{key:Segment;title:string;note:string}[]=[
  {key:'direct',title:'直接匹配',note:'必需技能均有有效认证'},
  {key:'adjacent',title:'相邻能力',note:'部分技能已有认证'},
  {key:'potential',title:'待补充证据',note:'方向相关，技能仍需核实'},
];
const EMPTY:TalentSearchResponse={direct:[],adjacent:[],potential:[],searchedCount:0,calculatedAt:''};
const INITIAL:TalentCriteria={title:'人才需求',required:[],bonus:[],keywords:[],minimumAvailability:null,startMonth:''};
const NONE:TalentCatalog={skills:[],departments:[],scopeLabel:'可见员工',aiAvailable:false};
function errorMessage(error:unknown,fallback:string):string {
  if (axios.isAxiosError(error)) {
    const message=error.response?.data?.message || error.response?.data?.error?.message;
    if (typeof message==='string') return message;
  }
  return fallback;
}
export default function TalentPage() {
  const {showToast}=useUI();
  const [prompt,setPrompt]=useState(''),[criteria,setCriteria]=useState<TalentCriteria>(INITIAL),[workspace,setWorkspace]=useState<TalentWorkspace|null>(null);
  const [catalog,setCatalog]=useState<TalentCatalog>(NONE),[results,setResults]=useState<TalentSearchResponse>(EMPTY),[applied,setApplied]=useState<TalentCriteria>(INITIAL);
  const [shortlist,setShortlist]=useState<TalentCandidate[]>([]),[segment,setSegment]=useState<Segment>('direct');
  const [departments,setDepartments]=useState<string[]>([]),[scopeOpen,setScopeOpen]=useState(false),[availabilityOnly,setAvailabilityOnly]=useState(false),[keyword,setKeyword]=useState('');
  const [conditionsOpen,setConditionsOpen]=useState(false),[filtersOpen,setFiltersOpen]=useState(false),[expandedId,setExpandedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[searching,setSearching]=useState(false),[parsing,setParsing]=useState(false),[saving,setSaving]=useState(false),[exporting,setExporting]=useState(false),[shortlistBusy,setShortlistBusy]=useState(false);
  const [pageSize,setPageSize]=useState(20),[appliedFilters,setAppliedFilters]=useState({departments:[] as string[],availabilityOnly:false,keyword:''});
  const [error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[hasSearched,setHasSearched]=useState(false);
  const scopeRef=useRef<HTMLDivElement|null>(null),requestRef=useRef(0);
  const draftChanged=Boolean(workspace&&(prompt!==workspace.prompt||JSON.stringify(criteria)!==JSON.stringify(workspace.criteria)));
  const resultsStale=hasSearched&&(JSON.stringify(criteria)!==JSON.stringify(applied)||JSON.stringify({departments,availabilityOnly,keyword})!==JSON.stringify(appliedFilters));
  const scopeText=appliedFilters.departments.length?`范围：${appliedFilters.departments.join('、')}`:`范围：${catalog.scopeLabel}`;
  const search=useCallback(async (next:TalentCriteria,scope:string[],available:boolean,term:string)=>{
    const id=++requestRef.current;setSearching(true);setError('');
    try {
      const [res,list]=await Promise.all([talentApi.searchTalent({criteria:next,departments:scope,availabilityOnly:available,keyword:term}),talentApi.getShortlist(next)]);
      if (id!==requestRef.current)return;
      setResults(res);setShortlist(list.items);setApplied(next);setAppliedFilters({departments:scope,availabilityOnly:available,keyword:term});setHasSearched(true);setExpandedId(null);setPageSize(20);
      setSegment(res.direct.length?'direct':res.adjacent.length?'adjacent':res.potential.length?'potential':'direct');
    } catch(cause) { if(id===requestRef.current){logger.error('人才搜索失败',cause);setError(errorMessage(cause,'搜索失败，请重试。'));} }
    finally {if(id===requestRef.current)setSearching(false);}
  },[]);
  useEffect(()=>{
    let cancelled=false;
    void Promise.all([talentApi.getTalentCatalog(),talentApi.getTalentWorkspace()]).then(async ([meta,saved])=>{
      if(cancelled)return;
      setCatalog(meta);setWorkspace(saved);setPrompt(saved.prompt);setCriteria(saved.criteria);setApplied(saved.criteria);
      await search(saved.criteria,[],false,'');
    }).catch(cause=>{if(!cancelled){logger.error('加载人才搜索失败',cause);setError(errorMessage(cause,'加载失败，请检查数据库迁移并重试。'));}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;requestRef.current++;};
  },[search]);
  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(scopeRef.current&&event.target instanceof Node&&!scopeRef.current.contains(event.target))setScopeOpen(false);};
    document.addEventListener('click',close);return()=>document.removeEventListener('click',close);
  },[]);
  useEffect(()=>{
    const save=()=>{void saveWorkspace();};
    window.addEventListener('talent:save',save);return()=>window.removeEventListener('talent:save',save);
  });
  const saveWorkspace=async()=>{
    if(!workspace||saving)return;
    setSaving(true);
    try {const saved=await talentApi.saveTalentWorkspace({prompt,criteria,revision:workspace.revision,updatedAt:workspace.updatedAt});setWorkspace(saved);showToast('人才需求已保存。');}
    catch(cause){logger.error('保存人才需求失败',cause);showToast(errorMessage(cause,'保存失败，请重试。'));}
    finally{setSaving(false);}
  };
  const analyze=async()=>{
    if(!prompt.trim()){showToast('请先描述项目需要。');document.getElementById('talent-prompt')?.focus();return;}
    if(parsing)return;setParsing(true);setWarnings([]);
    try {const parsed=await talentApi.parseTalentPrompt(prompt);setCriteria(parsed.criteria);setWarnings(parsed.warnings);setConditionsOpen(true);showToast('AI 已拆解需求，请检查条件后执行搜索。');}
    catch(cause){logger.error('解析人才需求失败',cause);showToast(errorMessage(cause,'AI 解析失败，请重试或手动设置条件。'));setConditionsOpen(true);}
    finally{setParsing(false);}
  };
  const mutateShortlist=async (operation:()=>Promise<{items:TalentCandidate[]}>)=>{
    if(shortlistBusy)return;setShortlistBusy(true);
    try {await operation();const res=await talentApi.getShortlist(applied);setShortlist(res.items);}
    catch(cause){logger.error('候选清单操作失败',cause);showToast(errorMessage(cause,'清单操作失败，请重试。'));}
    finally{setShortlistBusy(false);}
  };
  const ids=new Set(shortlist.map(item=>item.id));
  const exportList=async()=>{
    if(exporting)return;setExporting(true);
    try {
      const blob=await talentApi.exportShortlist(applied),url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=`候选名单_${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})}.xlsx`;
      document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
      showToast('候选名单已导出。');
    } catch(cause){logger.error('候选名单导出失败',cause);showToast(errorMessage(cause,'导出失败，请重试。'));}
    finally{setExporting(false);}
  };
  const visible=results[segment];
  const isDirectory=!applied.required.length&&!applied.bonus.length&&!applied.keywords.length;
  return <section className="page active" id="talent">
    <section className="talent-brief panel">
      <div className="talent-brief-head"><div><h2>描述项目需要，找到有依据的候选人</h2><p>AI 拆解需求，按有效认证和登记经历匹配；结果用于沟通，投入仍需确认。</p></div>
        <div className="talent-mode" aria-label="人才配置模式"><button className="active">人才搜索</button><span>项目角色与自动组队后续开放</span></div></div>
      <div className="talent-prompt-wrap"><textarea id="talent-prompt" aria-label="项目人才需求" maxLength={4000} placeholder="描述业务目标、必需与加分技能、经历、开始时间和投入比例…" value={prompt} onChange={e=>setPrompt(e.target.value)}/>
        <div className="talent-prompt-actions"><div className="scope-picker" id="scope-picker" ref={scopeRef}>
          <button className="scope-trigger" id="scope-trigger" aria-expanded={scopeOpen} aria-controls="scope-menu" onClick={()=>setScopeOpen(!scopeOpen)}><span className="scope-icon">⌾</span><span><small>搜索范围</small><b id="scope-label">{departments.length?`${departments.length} 个部门`:catalog.scopeLabel}</b></span><i>⌄</i></button>
          <div className={`scope-menu ${scopeOpen?'':'hidden'}`} id="scope-menu"><div><b>选择部门</b><small>仅在当前可见员工中筛选</small></div>{catalog.departments.map(org=><label key={org}><input type="checkbox" checked={departments.includes(org)} onChange={()=>setDepartments(current=>current.includes(org)?current.filter(v=>v!==org):[...current,org])}/>{org}</label>)}
            <button onClick={()=>{setDepartments([]);setScopeOpen(false);}}>重置为全部可见员工</button><button onClick={()=>setScopeOpen(false)}>完成选择</button></div></div>
          <button className={`analyze-button ${parsing?'loading':''}`} id="analyze-talent" disabled={parsing||!catalog.aiAvailable} onClick={()=>void analyze()}>{parsing?'正在解析…':catalog.aiAvailable?'✦ AI 解析需求':'AI 服务未配置'}</button></div></div>
      {warnings.length>0&&<div className="talent-ai-warnings" role="status"><b>请确认 AI 解析结果：</b>{warnings.map((warning,i)=><span key={`${warning}-${i}`}>{warning}</span>)}</div>}
      <TalentConditions criteria={criteria} catalog={catalog} disabled={loading||parsing} open={conditionsOpen} onToggle={()=>setConditionsOpen(!conditionsOpen)} onChange={setCriteria}/>
      <div className="talent-runbar"><span>{draftChanged?'条件或描述尚未保存':''}{resultsStale?' · 搜索结果尚未按新条件更新':''}</span>
        <button onClick={()=>void saveWorkspace()} disabled={!workspace||!draftChanged||saving}>{saving?'保存中…':'保存人才需求'}</button>
        <button className="primary" disabled={loading||searching||!criteria.title.trim()} onClick={()=>void search(criteria,departments,availabilityOnly,keyword)}>{searching?'正在搜索…':'按条件搜索'}</button></div>
    </section>
    <div className="talent-workspace"><section className="talent-results panel"><div className="talent-results-head"><div><h3>候选人搜索结果</h3><p><b id="candidate-count">{visible.length}</b> 人进入当前分层 · 可见范围 {results.searchedCount} 人 · {results.calculatedAt?`更新于 ${results.calculatedAt.slice(0,10)}`:'等待搜索'}</p></div>
      <div className="result-controls"><button id="availability-filter" className={availabilityOnly?'active':''} aria-pressed={availabilityOnly} onClick={()=>setAvailabilityOnly(!availabilityOnly)}>仅看可投入</button>
        <button id="org-filter" className={departments.length?'active':''} onClick={()=>{setScopeOpen(true);document.getElementById('scope-trigger')?.scrollIntoView({behavior:'smooth',block:'center'});}}>{departments.length?`${departments.length} 个部门`:'全部可见部门'}</button>
        <button aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>☷ 筛选</button></div></div>
      {filtersOpen&&<div className="talent-extra-filters"><label>姓名或岗位<input placeholder="输入关键词" value={keyword} onChange={e=>setKeyword(e.target.value)}/></label><button onClick={()=>{setKeyword('');setAvailabilityOnly(false);setDepartments([]);}}>重置筛选</button><span>修改筛选后点击“按条件搜索”</span></div>}
      <div className="talent-segments" role="tablist" aria-label="候选人匹配分层">{SEGMENTS.map(item=><button key={item.key} className={segment===item.key?'active':''} data-talent-segment={item.key} role="tab" aria-selected={segment===item.key} onClick={()=>{setSegment(item.key);setExpandedId(null);}}><span>{isDirectory&&item.key==='direct'?'员工目录':item.title}</span><b>{results[item.key].length}</b><small>{isDirectory&&item.key==='direct'?'添加技能后显示匹配分层':item.note}</small></button>)}</div>
      {error&&<div className="talent-error" role="alert">{error} <button onClick={()=>void search(criteria,departments,availabilityOnly,keyword)}>重试</button></div>}
      {loading?<div className="candidate-list"><div className="empty-candidates"><b>正在加载人才数据…</b></div></div>:<TalentCandidateList items={visible.slice(0,pageSize)} busy={shortlistBusy} shortlist={ids} expandedId={expandedId} onExpandPerson={id=>setExpandedId(current=>current===id?null:id)} onTogglePerson={id=>void mutateShortlist(()=>ids.has(id)?talentApi.removeFromShortlist(id):talentApi.addToShortlist(id))}/>}
      {!loading&&visible.length>pageSize&&<button className="talent-load-more" onClick={()=>setPageSize(size=>size+20)}>显示更多候选人（已显示 {pageSize}/{visible.length}）</button>}
    </section><ShortlistPanel items={shortlist} criteria={applied} scopeText={scopeText} busy={shortlistBusy} exporting={exporting} onRemove={id=>void mutateShortlist(()=>talentApi.removeFromShortlist(id))} onClear={()=>void mutateShortlist(()=>talentApi.clearShortlist())} onExport={()=>void exportList()}/></div>
  </section>;
}
