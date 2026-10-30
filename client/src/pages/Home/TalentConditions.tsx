import { useEffect, useState } from 'react';
import type { TalentCatalog, TalentCriteria, TalentSkillCondition } from '@shared/api.interface';
interface Props {
  criteria:TalentCriteria; catalog:TalentCatalog; disabled:boolean; open:boolean;
  onToggle:()=>void; onChange:(criteria:TalentCriteria)=>void;
}
export default function TalentConditions({criteria,catalog,disabled,open,onToggle,onChange}:Props) {
  const [skill,setSkill]=useState(''),[level,setLevel]=useState(3),[kind,setKind]=useState<'required'|'bonus'>('required');
  const [keywords,setKeywords]=useState(criteria.keywords.join('、'));
  useEffect(()=>setKeywords(criteria.keywords.join('、')),[criteria.keywords]);
  const names=new Map(catalog.skills.map(s=>[s.slug,s.name]));
  const used=new Set([...criteria.required,...criteria.bonus].map(s=>s.skillSlug));
  const group=(key:'required'|'bonus',label:string,variant:string)=><div className={`condition-group ${variant}`}>
    <span>{label}</span><div>{criteria[key].length?criteria[key].map(item=><button key={item.skillSlug} disabled={disabled}
      aria-label={`移除${label} ${names.get(item.skillSlug) ?? item.skillSlug}`}
      onClick={()=>onChange({...criteria,[key]:criteria[key].filter(s=>s.skillSlug!==item.skillSlug)})}>
      {names.get(item.skillSlug) ?? item.skillSlug} L{item.level} ×</button>):<small>未设置</small>}
      <button className="add-condition" disabled={disabled} onClick={()=>{setKind(key);if(!open)onToggle();}} aria-label={`添加${label}`}>＋</button></div></div>;
  return <>
    <div className="talent-conditions" id="talent-conditions">
      <div className="condition-lead"><span className="condition-status">可编辑条件</span><b>{criteria.title}</b><small>调整后点击“按条件搜索”更新结果</small></div>
      {group('required','必需技能','required')}{group('bonus','加分技能','bonus')}
      <div className="condition-group"><span>经历关键词</span><div>{criteria.keywords.length?criteria.keywords.map(word=><button key={word} disabled={disabled} onClick={()=>onChange({...criteria,keywords:criteria.keywords.filter(w=>w!==word)})}>{word} ×</button>):<small>未设置</small>}</div></div>
      <div className="condition-meta"><span>◷ {criteria.startMonth || '开始月份待确认'}</span><span>◔ {criteria.minimumAvailability===null?'投入要求未设置':`至少投入 ${criteria.minimumAvailability}%`}</span>
        <button id="edit-conditions" disabled={disabled} aria-expanded={open} onClick={onToggle}>{open?'收起条件':'调整条件'}</button></div>
    </div>
    {open && <fieldset className="talent-condition-editor" disabled={disabled}><legend>手动调整搜索条件</legend>
      <div className="talent-editor-meta">
        <label>需求名称<input maxLength={100} value={criteria.title} onChange={e=>onChange({...criteria,title:e.target.value})}/></label>
        <label>开始月份<input type="month" value={criteria.startMonth} onChange={e=>onChange({...criteria,startMonth:e.target.value})}/></label>
        <label>最低投入比例（%）<input type="number" min={0} max={100} placeholder="不限制" value={criteria.minimumAvailability ?? ''} onChange={e=>onChange({...criteria,minimumAvailability:e.target.value===''?null:Number(e.target.value)})}/></label>
      </div>
      <div className="talent-add-skill">
        <label>技能<select value={skill} onChange={e=>setSkill(e.target.value)}><option value="">从技能目录选择</option>{catalog.skills.filter(s=>!used.has(s.slug)).map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
        <label>要求等级<select value={level} onChange={e=>setLevel(Number(e.target.value))}>{[1,2,3,4,5].map(l=><option key={l} value={l}>L{l}</option>)}</select></label>
        <label>条件类型<select value={kind} onChange={e=>setKind(e.target.value as 'required'|'bonus')}><option value="required">必需技能</option><option value="bonus">加分技能</option></select></label>
        <button type="button" disabled={!skill || disabled || criteria[kind].length>=30} onClick={()=>{onChange({...criteria,[kind]:[...criteria[kind],{skillSlug:skill,level}]});setSkill('');}}>添加技能</button>
      </div>
      {[...criteria.required.map(item=>({...item,kind:'required' as const})),...criteria.bonus.map(item=>({...item,kind:'bonus' as const}))].map(item=><div className="talent-skill-row" key={item.skillSlug}>
        <span>{names.get(item.skillSlug) ?? item.skillSlug}</span>
        <select aria-label={`${names.get(item.skillSlug)}条件类型`} value={item.kind} onChange={e=>{
          const destination=e.target.value as 'required'|'bonus';
          onChange({...criteria,[item.kind]:criteria[item.kind].filter(s=>s.skillSlug!==item.skillSlug),[destination]:[...criteria[destination],{skillSlug:item.skillSlug,level:item.level}]});
        }}><option value="required">必需技能</option><option value="bonus">加分技能</option></select>
        <select aria-label={`${names.get(item.skillSlug)}要求等级`} value={item.level} onChange={e=>onChange({...criteria,[item.kind]:criteria[item.kind].map((s:TalentSkillCondition)=>s.skillSlug===item.skillSlug?{...s,level:Number(e.target.value)}:s)})}>{[1,2,3,4,5].map(l=><option value={l} key={l}>L{l}</option>)}</select>
        <button type="button" aria-label={`删除条件 ${names.get(item.skillSlug)}`} onClick={()=>onChange({...criteria,[item.kind]:criteria[item.kind].filter(s=>s.skillSlug!==item.skillSlug)})}>移除</button>
      </div>)}
      <label className="talent-keywords-input">经历 / 领域关键词（用顿号、逗号分隔，最多 15 个）<input value={keywords} onChange={e=>{
        const text=e.target.value;setKeywords(text);
      }} onBlur={()=>onChange({...criteria,keywords:keywords.split(/[、,，;；\n]/).map(w=>w.trim()).filter(Boolean)})} placeholder="例如：机器人、仿真平台、真实硬件"/></label>
      <small>开始月份仅用于沟通参考；缺少投入比例的数据不会被视为可投入。经历关键词提供线索，不替代技能认证。</small>
    </fieldset>}
  </>;
}
