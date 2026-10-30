import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { AssessmentWorkspace, CertificationItem, SkillAssessment } from '@shared/api.interface';
import { createAssessment, getAssessment, getAssessmentWorkspace } from '@/api/assessment';

const LEVELS=['入门','基础','熟练','精通','专家'];
const KINDS:Record<string,string>={project:'项目',performance:'绩效',legacy_evidence:'材料',git_commit:'提交',okr:'目标',employee_transfer:'调动'};
function message(error:unknown):string {
  const text=axios.isAxiosError(error)?error.response?.data?.error?.message:null;
  return typeof text==='string'?text:'评估服务暂不可用，请重试';
}
export default function SkillAssessmentPanel({item}:{item:CertificationItem}) {
  const [workspace,setWorkspace]=useState<AssessmentWorkspace|null>(null);
  const [job,setJob]=useState<SkillAssessment|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [material,setMaterial]=useState('');
  const [target,setTarget]=useState(Math.min(5,Math.max(item.currentLevel+1,item.targetLevel,1)));
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const alive=useRef(true);
  const request=useRef(0);
  const busy=creating || job?.status==='queued' || job?.status==='running';
  const reportError=(cause:unknown)=>{
    setError(message(cause));
    if(axios.isAxiosError(cause)&&[401,403,404].includes(cause.response?.status??0)) {
      setWorkspace(null);setJob(null);setSelected([]);setMaterial('');
    }
  };
  useEffect(()=>{
    alive.current=true;
    let cancelled=false;
    getAssessmentWorkspace(item.id).then(data=>{
      if(cancelled)return;
      setWorkspace(data);setJob(data.latest);
      setSelected(data.latest?.factIds ?? data.materials.filter(m=>m.recommended).slice(0,12).map(m=>m.id));
      if(data.latest){setTarget(data.latest.targetLevel);setMaterial(data.latest.selfMaterial);}
      setError('');
    }).catch(cause=>{if(!cancelled)setError(message(cause));}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;alive.current=false;request.current++;};
  },[item.id]);
  useEffect(()=>{
    if(!job)return;
    let pending=false,cancelled=false;
    const timer=window.setInterval(async()=>{
      if(pending)return;
      pending=true;
      try{
        const value=await getAssessment(item.id,job.id);
        if(!cancelled){setJob(value);setError('');}
      }catch(cause){if(!cancelled)reportError(cause);}
      finally{pending=false;}
    },job.status==='queued'||job.status==='running'?2000:10000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[item.id,job?.id,job?.status]);
  const refreshMaterials=async()=>{
    try{
      const data=await getAssessmentWorkspace(item.id);
      if(!alive.current)return;
      setWorkspace(data);setSelected(ids=>ids.filter(id=>data.materials.some(m=>m.id===id)));setError('');
    }catch(cause){if(alive.current)reportError(cause);}
  };
  const evaluate=async()=>{
    const seq=++request.current;
    setCreating(true);setError('');
    try{
      const value=await createAssessment(item.id,{targetLevel:target,factIds:selected,selfMaterial:material});
      if(alive.current && seq===request.current)setJob(value);
    }catch(cause){if(alive.current && seq===request.current)reportError(cause);}
    finally{if(alive.current && seq===request.current)setCreating(false);}
  };
  const changed=!!job && (target!==job.targetLevel || material.trim()!==job.selfMaterial ||
    [...selected].sort().join(',')!==[...job.factIds].sort().join(','));
  if (item.status === 'approved') return <section className="evidence-section" aria-label="子能力与认证标准">
    <h4>子能力与认证标准</h4>
    {loading ? <p className="detail-note">正在读取能力标准…</p> : null}
    {error ? <p role="alert" className="source-explanation">{error}</p> : null}
    <div className="source-explanation"><b>正式认证：</b>该技能 L{item.currentLevel} 已点亮{item.approvedAt ? `，生效于 ${item.approvedAt}` : ''}。材料评估仅提供申请参考，不改变审批结论。</div>
    {workspace && <details><summary>查看 L{item.currentLevel} 子能力标准 · {workspace.standard.version}</summary>
      {workspace.standard.abilities.map(ability => <div className="anchor-section" key={ability.id}><h4>{ability.name}</h4>
        <p>{ability.anchors[item.currentLevel-1] ?? '该等级暂未配置行为锚点'}</p>{ability.evidenceRequirements?.[item.currentLevel-1]&&<p><b>证明材料要求：</b>{ability.evidenceRequirements[item.currentLevel-1]}</p>}</div>)}
    </details>}
    {job && <details><summary>查看申请前材料评估记录 · {new Date(job.createdAt).toLocaleString('zh-CN')}</summary>
      {job.simulated && <p className="source-explanation">模拟评估 · 未调用真实大模型，不可用于认证。</p>}
      <p className="detail-note">当时评估目标为 L{job.targetLevel}，结果仅反映所选材料；正式等级以认证记录为准。</p>
      {job.result?.abilities.map(ability => <div className="anchor-section" key={ability.abilityId}>
        <h4>{workspace?.standard.abilities.find(entry => entry.id === ability.abilityId)?.name ?? ability.abilityId}</h4><p>{ability.reason}</p>
      </div>)}
    </details>}
  </section>;
  return <section className="evidence-section" aria-label="子能力与证据评估">
    <h4>子能力与证据评估</h4>
    {loading?<p className="detail-note">正在读取能力标准与事实材料…</p>:null}
    {error?<p role="alert" className="source-explanation">{error}</p>:null}
    {!workspace&&!loading?<button className="ghost" onClick={()=>void refreshMaterials()}>重新读取材料</button>:null}
    {workspace?<>
      <div className="source-explanation">
        <b>当前正式技能等级：</b>{item.currentLevel ? `L${item.currentLevel}` : '未点亮'}。下方评估仅判断所选材料，不授予正式认证。
      </div>
      <div className="self-application-form" style={{gridTemplateColumns:'1fr'}}>
        <label><span>本次评估目标等级</span><select value={target} disabled={busy} onChange={e=>setTarget(Number(e.target.value))}>
          {LEVELS.map((name,i)=><option key={name} value={i+1} disabled={i+1<=item.currentLevel}>L{i+1} · {name}</option>)}
        </select></label>
      </div>
      {workspace.standard.description&&<p className="source-explanation"><b>技能说明：</b>{workspace.standard.description}</p>}
      <details><summary>查看目标 L{target} 子能力标准 · {workspace.standard.version}</summary>
        {workspace.standard.abilities.map(ability=><div className="anchor-section" key={ability.id}>
          <h4>{ability.name}</h4><p style={{whiteSpace:'pre-wrap'}}><b>L{target} {LEVELS[target-1]}：</b>{ability.anchors[target-1]}</p>{ability.evidenceRequirements?.[target-1]&&<p style={{whiteSpace:'pre-wrap'}}><b>证明材料要求：</b>{ability.evidenceRequirements[target-1]}</p>}
        </div>)}
      </details>
      <h4>本次能力证据</h4>
      <p className="detail-note">仅将你选择的事实与自证资料用于本次评估，最多选择 12 条。标为“相关”的材料建议优先核对。</p>
      <details><summary>选择事实中心材料 · 已选 {selected.length} 条</summary>
        {[...workspace.materials].sort((a,b)=>Number(b.recommended)-Number(a.recommended)).map(entry=><div className="evidence-entry" key={entry.id}>
          <input type="checkbox" aria-label={`选择${entry.title}`} checked={selected.includes(entry.id)}
            disabled={busy||(!selected.includes(entry.id)&&selected.length>=12)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,entry.id]:ids.filter(id=>id!==entry.id))}/>
          <div><b>{entry.title}</b><small>{KINDS[entry.kind] ?? '材料'} · V{entry.version}{entry.recommended?' · 相关材料':''}{entry.simulated?' · 开发演示样本':''}</small>
            <details><summary>查看材料内容</summary><p style={{overflowWrap:'anywhere'}}>{entry.detail}</p></details>
          </div>
        </div>)}
      </details>
      <div className="review-comment"><h4><label htmlFor={`assessment-material-${item.id}`}>自证资料或学习笔记</label></h4>
        <textarea id={`assessment-material-${item.id}`} value={material} disabled={busy} maxLength={8000} rows={4}
          placeholder="粘贴与本次子能力有关的笔记、实践过程及验证结果；仅填写链接无法读取链接中的正文。"
          onChange={e=>setMaterial(e.target.value)}/>
      </div>
      <div className="detail-actions">
        <button className="ghost" disabled={busy} onClick={()=>void refreshMaterials()}>载入最新材料</button>
        <button className="primary" disabled={busy||(!selected.length&&!material.trim())||Boolean(workspace.standard.managed&&!workspace.standard.configuredLevels?.includes(target))} onClick={()=>void evaluate()}>
          {busy?'评估中…':job?.status==='failed'?'重试评估':'评估所选证据'}</button>
      </div>
      {job?<div aria-live="polite">
        {job.simulated && <p className="source-explanation">模拟评估 · 未调用真实大模型；以下结果仅用于演示流程，不可用于认证。</p>}
        {job.status==='queued'||job.status==='running'?<p className="source-explanation">正在逐项核对证据，完成后自动显示结果。离开页面后任务仍会继续。</p>:null}
        {job.status==='failed'?<p className="source-explanation" role="alert">{job.error}</p>:null}
        {job.stale?<p className="source-explanation" role="status">事实或标准已更新，以下为历史结果。请载入最新材料并重新评估。</p>:null}
        {changed?<p className="detail-note">目标或所选材料已调整，以下仍为上次评估结果，请重新评估。</p>:null}
        {job.result?<>
          <div className="confidence-row"><span>目标 L{job.targetLevel} 材料覆盖</span>
            <i><span style={{width:`${job.result.supportedCount/job.result.totalCount*100}%`}}/></i>
            <strong>{job.result.supportedCount}/{job.result.totalCount}</strong>
          </div>
          <p className="detail-note">材料 Gap {job.result.gapCount}/{job.result.totalCount} · {job.standardVersion} · 尚需按认证流程完成考核或审批。</p>
          {job.result.abilities.map(ability=><div className="anchor-section" key={ability.abilityId}>
            <h4>{workspace.standard.abilities.find(a=>a.id===ability.abilityId)?.name??ability.abilityId} · {ability.supportedLevel===null?'证据不足':`材料支持 L${ability.supportedLevel} ${LEVELS[ability.supportedLevel-1]}`}</h4>
            <p>{ability.reason}</p>
            {ability.citations.map((cite,i)=><details key={i}><summary>{cite.factId==='self'?'自证资料':workspace.materials.find(m=>m.id===cite.factId)?.title??'历史事实'} · V{cite.version} · 引用原文</summary><p>“{cite.quote}”</p></details>)}
            {ability.gaps.length?<p><b>待补充：</b>{ability.gaps.join('；')}</p>:null}
            {ability.questions.length?<details><summary>可补充回答的问题</summary>{ability.questions.map((q,i)=><p key={i}>{q}</p>)}</details>:null}
          </div>)}
        </>:null}
      </div>:<p className="detail-note">尚无评估结果。材料不足仅表示暂缺证明，不代表不具备能力。</p>}
    </>:null}
  </section>;
}
