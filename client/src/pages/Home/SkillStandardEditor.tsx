import { useEffect, useRef, useState } from 'react';
import type { PositionSkillStandard } from '@shared/api.interface';
import { standardIssues } from '@shared/position-validation';
export interface StandardFocus { key:number; field:string; level?:number }
export function emptySkillStandard():PositionSkillStandard{return {description:'',revision:'',levels:[1,2,3,4,5].map(level=>({level,anchor:'',evidence:''}))};}
export default function SkillStandardEditor({name,requiredLevel,value,onChange,pending=false,onComplete,focusRequest,usage}:{name:string;requiredLevel:number;value:PositionSkillStandard;onChange:(value:PositionSkillStandard)=>void;pending?:boolean;onComplete?:()=>void;focusRequest?:StandardFocus;usage?:{directions:number;grades:number}}){
  const [level,setLevel]=useState(requiredLevel);
  useEffect(()=>{setLevel(requiredLevel);},[requiredLevel]);
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    if(!focusRequest)return;
    if(ref.current)ref.current.open=true;
    if(focusRequest.level)setLevel(focusRequest.level);
    const timer=setTimeout(()=>{const target=ref.current?.querySelector<HTMLElement>(`[data-standard-field="${focusRequest.field}"]`);target?.focus();target?.scrollIntoView({block:'center',behavior:'smooth'});},0);
    return()=>clearTimeout(timer);
  },[focusRequest]);
  const completeCount=value.levels.filter(l=>l.anchor.trim()&&l.evidence.trim()).length;
  const active=value.levels.find(l=>l.level===level)!;
  const complete=standardIssues(value).length===0;
  function patch(field:'anchor'|'evidence',text:string){onChange({...value,levels:value.levels.map(l=>l.level===level?{...l,[field]:text}:l)});}
  return <details ref={ref} className="position-standard-editor" open={pending?true:undefined}>
    <summary onClick={e=>{if(pending)e.preventDefault();}}>{name||'该技能'} · 技能说明与等级标准 <span className={complete?'complete':'incomplete'}>{complete?'L1–L5 标准已齐全':`已完成 ${completeCount}/5 个等级`}</span></summary>
    <p>{usage&&`当前被 ${usage.directions} 个方向、${usage.grades} 个职级引用。`}同名技能共用一套 L1–L5 标准，各岗位按最低等级引用。修改后会同步用于引用该技能的岗位和新申请；已有申请保留提交时的标准。</p>
    <label>技能说明 *<textarea data-standard-field="description" aria-label={`${name||'新技能'} 技能说明`} rows={3} maxLength={4000} value={value.description} placeholder="说明该技能解决什么问题、涵盖哪些能力和适用场景。例如：设计与实现具备工具调用、状态管理和异常恢复能力的 Agent。" onChange={e=>onChange({...value,description:e.target.value})}/></label>
    <div className="position-standard-levels" role="tablist" aria-label={`${name||'新技能'} 等级标准`}>{value.levels.map(l=><button type="button" role="tab" aria-selected={level===l.level} key={l.level} className={level===l.level?'active':''} onClick={()=>setLevel(l.level)}>L{l.level}{l.level===requiredLevel?' · 岗位要求':''}{l.anchor.trim()&&l.evidence.trim()?' ✓':' · 待补齐'}</button>)}</div>
    <label>L{level} 达标标准 *<textarea data-standard-field="anchor" aria-label={`${name||'新技能'} L${level} 达标标准`} rows={4} maxLength={4000} value={active.anchor} placeholder="写清能够独立完成的任务、复杂度和可验证的结果。例如：独立实现多工具 Agent，处理调用失败与重试，并用测试用例验证关键路径。" onChange={e=>patch('anchor',e.target.value)}/></label>
    <label>L{level} 证明材料要求 *<textarea data-standard-field="evidence" aria-label={`${name||'新技能'} L${level} 证明材料要求`} rows={3} maxLength={4000} value={active.evidence} placeholder="例如：代码或 PR、架构说明、关键测试用例及运行结果，注明个人承担部分。" onChange={e=>patch('evidence',e.target.value)}/></label>
    {!complete&&<p className="position-standard-warning">必须补齐技能说明及L1–L5全部达标标准和证明材料要求，才能保存。</p>}
    {pending&&<div className="position-section-head"><p className="position-standard-warning" role="status">首次配置新技能：完成五级标准后才能配置其他技能，也可移除取消。</p><button className="primary" type="button" disabled={!name.trim()||!complete} onClick={onComplete}>完成技能配置</button></div>}
  </details>;
}
