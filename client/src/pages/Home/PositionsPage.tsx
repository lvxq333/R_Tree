import { useEffect, useRef, useState } from 'react';
import type { JobFamily, PositionCatalog, PositionDirection, PositionInput, PositionImportPreview, PositionSkillStandard } from '@shared/api.interface';
import { deletePosition, exportPositions, getPositions, importPositions, previewPositions, savePosition } from '@/api/positions';
import { useUI } from './ui-context';
import './positions.css';
import SkillStandardEditor, { emptySkillStandard, type StandardFocus } from './SkillStandardEditor';
import { JOB_FAMILIES as FAMILIES, validatePosition, standardIssues, type PositionValidationIssue } from '@shared/position-validation';
function empty(family:JobFamily):PositionInput{return {family,name:'',grades:[1,2,3,4].map(n=>({code:`${family}${n}`,name:'',requirements:[]}))};}
function message(error:unknown){const e=error as {response?:{data?:{error?:{message?:string}}};message?:string};return e.response?.data?.error?.message??e.message??'操作失败，请重试';}
function template(){
  const headers=['序列','方向','职级','技能名称','技能等级','技能描述','是否必须','技能说明',...[1,2,3,4,5].flatMap(n=>[`L${n}达标标准`,`L${n}证明材料要求`])];
  const levels=[1,2,3,4,5].flatMap(n=>[`示例L${n}达标标准（请替换）`,`示例L${n}证明材料要求（请替换）`]);
  const rows=[headers,...[1,2,3,4].map(n=>['技术T','示例岗位方向',`T${n}`,'示例技能',`L${n}`,`示例L${n}达标标准（请替换）`,'是','示例技能说明（请替换）',...levels])];
  const text=rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='岗位技能导入模板.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function PositionsPage(){
  const {showToast}=useUI();
  const [catalog,setCatalog]=useState<PositionCatalog|null>(null),[family,setFamily]=useState<JobFamily>('T');
  const [selected,setSelected]=useState<string|undefined>(),[draft,setDraft]=useState<PositionInput|null>(null),[baseline,setBaseline]=useState('');
  const [grade,setGrade]=useState('T1'),[search,setSearch]=useState(''),[error,setError]=useState('');
  const [issues,setIssues]=useState<PositionValidationIssue[]>([]),[initialized,setInitialized]=useState<string[]>([]);
  const [focus,setFocus]=useState<{grade:string;index:number;request:StandardFocus}|null>(null);
  const pageRef=useRef<HTMLElement>(null);
  const [exporting,setExporting]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[importOpen,setImportOpen]=useState(false);
  const [preview,setPreview]=useState<PositionImportPreview|null>(null),[filename,setFilename]=useState(''),[importRevision,setImportRevision]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const dirty=Boolean(draft)&&JSON.stringify(draft)!==baseline;
  const pending=draft?.grades.flatMap(g=>g.requirements.map((r,index)=>({grade:g.code,index,name:r.skillName.trim()}))).find(r=>!catalog?.skills.includes(r.name)&&!initialized.includes(r.name));
  function pick(direction:PositionDirection){const input={family:direction.family,name:direction.name,revision:direction.revision,grades:structuredClone(direction.grades)};setSelected(direction.slug);setDraft(input);setBaseline(JSON.stringify(input));setGrade(`${direction.family}1`);setIssues([]);setInitialized([]);setFocus(null);}
  async function load(prefer?:string){
    setLoading(true);setError('');
    try{const data=await getPositions();setCatalog(data);const next=data.directions.find(d=>d.slug===prefer)??data.directions.find(d=>d.family===family);if(next){pick(next);setFamily(next.family);}else{setDraft(null);setSelected(undefined);setBaseline('');}}
    catch(e){setError(message(e));}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{const handler=()=>{if(pending){setError('请先完成新技能的L1–L5配置，或移除该技能');return;}setImportOpen(true);};window.addEventListener('positions:import',handler);return()=>window.removeEventListener('positions:import',handler);},[pending?.name]);
  useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  useEffect(()=>{if(!importOpen)return;const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setImportOpen(false);};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[importOpen,busy]);
  function maySwitch(){if(pending){setError('请先完成新技能的L1–L5配置，或移除该技能');return false;}return !dirty||window.confirm('有未保存的岗位配置，确定放弃修改？');}
  function switchFamily(value:JobFamily){if(!maySwitch())return;setFamily(value);setSearch('');setError('');const next=catalog?.directions.find(d=>d.family===value);if(next)pick(next);else{setDraft(null);setSelected(undefined);setBaseline('');}}
  function newDirection(){if(!maySwitch())return;const input=empty(family);setSelected(undefined);setDraft(input);setBaseline(JSON.stringify(input));setGrade(`${family}1`);setError('');setIssues([]);setInitialized([]);setFocus(null);}
  const directions=catalog?.directions.filter(d=>d.family===family&&d.name.toLowerCase().includes(search.toLowerCase()))??[];
  const active=draft?.grades.find(g=>g.code===grade);
  function patchGrade(update:Partial<NonNullable<typeof active>>){setDraft(value=>value?{...value,grades:value.grades.map(g=>g.code===grade?{...g,...update}:g)}:value);}
  function usageForSkill(name:string){
    const directions=[...(catalog?.directions.filter(d=>d.slug!==selected)??[]),...(draft?[draft]:[])];
    const counts=directions.map(d=>d.grades.filter(g=>g.requirements.some(r=>r.skillName.trim()===name.trim())).length);
    return {directions:counts.filter(Boolean).length,grades:counts.reduce((sum,n)=>sum+n,0)};
  }
  function renameSkill(index:number,name:string){
    if(!active||!draft||!catalog)return;
    const current=active.requirements[index];
    const shared=draft.grades.flatMap(g=>g.requirements).find(r=>r!==current&&r.skillName.trim()===name.trim());
    const stored=Object.hasOwn(catalog.skillStandards,name.trim())?catalog.skillStandards[name.trim()]:undefined;
    const standard=current.skillName.trim()===name.trim()?current.standard:shared?.standard??stored;
    patchGrade({requirements:active.requirements.map((r,i)=>i===index?{...r,skillName:name,standard:structuredClone(standard??emptySkillStandard())}:r)});
  }
  function patchStandard(name:string,standard:PositionSkillStandard){setDraft(value=>value?{...value,grades:value.grades.map(g=>({...g,requirements:g.requirements.map(r=>r.skillName.trim()===name.trim()?{...r,standard}:r)}))}:value);}
  function locate(issue:PositionValidationIssue){
    if(pending&&issue.grade!==pending.grade){setGrade(pending.grade);setError('请先完成当前新技能的L1–L5配置，再处理其余缺失项');return;}
    if(issue.grade)setGrade(issue.grade);
    if(issue.grade&&issue.skillIndex!==undefined&&['description','anchor','evidence'].includes(issue.field))setFocus({grade:issue.grade,index:issue.skillIndex,request:{key:Date.now(),field:issue.field,level:issue.level}});
    setTimeout(()=>{const selector=issue.skillIndex===undefined?`[data-pos-field="${issue.field}"]`:`[data-skill-index="${issue.skillIndex}"] [data-pos-field="${issue.field}"]`;const target=pageRef.current?.querySelector<HTMLElement>(selector);target?.focus();target?.scrollIntoView({block:'center',behavior:'smooth'});},0);
  }
  function changeFamily(value:JobFamily){if(!draft)return;setDraft({...draft,family:value,grades:draft.grades.map(g=>({...g,code:value+g.code.slice(1)}))});setGrade(value+grade.slice(1));}
  async function save(){
    if(!draft)return;const missing=validatePosition(draft);setIssues(missing);setError('');
    if(missing.length){locate(missing[0]);return;}
    if(pending){setError('请先点击“完成技能配置”，再保存岗位标准');return;}
    setBusy(true);try{const result=await savePosition(selected,draft);showToast('岗位标准已保存');await load(result.slug);}
    catch(e){const data=(e as {response?:{data?:{issues?:PositionValidationIssue[];error?:{issues?:PositionValidationIssue[];details?:string}}}}).response?.data;let missing=data?.issues??data?.error?.issues;try{if(!missing&&data?.error?.details)missing=JSON.parse(data.error.details).issues;}catch{/* 非结构化错误使用通用提示。 */}if(missing?.length){setIssues(missing);locate(missing[0]);}else setError(message(e));}finally{setBusy(false);}
  }
  async function removeDirection(){
    if(!selected||!catalog)return;
    const saved=catalog.directions.find(d=>d.slug===selected);if(!saved)return;
    if(!window.confirm(`确定删除“${saved.name}”方向？${dirty?'未保存修改将放弃。':''}删除后将从岗位管理、导出和职业路线中移除，已有员工关联及历史记录保留。`))return;
    setBusy(true);setError('');
    try{await deletePosition(selected,saved.revision);setInitialized([]);setIssues([]);showToast('方向已删除，历史记录已保留');await load();}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function download(){setExporting(true);setError('');try{await exportPositions();showToast('已导出全部已保存的岗位标准');}catch(e){setError(message(e));}finally{setExporting(false);}}
  function copyPrevious(){if(!draft||!active)return;const previous=draft.grades.find(g=>Number(g.code.slice(1))===Number(grade.slice(1))-1);if(previous&&(!active.requirements.length||window.confirm('将替换当前职级的技能配置，是否继续？')))patchGrade({requirements:structuredClone(previous.requirements)});}
  async function parse(file:File){setBusy(true);setError('');setPreview(null);setFilename(file.name);try{setPreview(await previewPositions(file));setImportRevision(catalog?.revision??'');}catch(e){setError(message(e));}finally{setBusy(false);}}
  async function confirmImport(){if(!preview||preview.errors.length||!maySwitch())return;setBusy(true);setError('');try{const result=await importPositions(preview.rows,importRevision);setImportOpen(false);setPreview(null);setFilename('');showToast(`已导入 ${result.directions} 个方向、${result.requirements} 项技能要求`);await load(selected);}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <section ref={pageRef} className="page active positions-page" id="positions" aria-busy={loading||busy}>
    <div className="position-intro"><div><h2>岗位与能力标准</h2><p>按序列管理岗位方向，为每个职级定义清晰的技能要求。</p></div><div className="position-actions"><button disabled={busy||loading||exporting||!catalog} onClick={()=>void download()}>{exporting?'正在导出…':'导出全部岗位标准'}</button><button onClick={template}>下载导入模板</button><button className="primary" disabled={busy||loading||!catalog||Boolean(pending)} onClick={()=>{setError('');setImportOpen(true);}}>导入文件</button></div></div>
    {dirty&&<p className="position-standard-warning">有未保存修改。导出以数据库中已保存的标准为准。</p>}
    {issues.length>0&&<div className="position-alert" role="alert"><b>无法保存，共有 {issues.length} 项未完成，请补齐后重新保存：</b><div className="position-validation-list">{issues.map((issue,index)=><button key={index} type="button" onClick={()=>locate(issue)}>{issue.message}</button>)}</div></div>}
    {error&&<div className="position-alert" role="alert">{error}{!catalog&&<button onClick={()=>void load()}>重新加载</button>}</div>}
    <div className="position-families" role="tablist" aria-label="岗位序列">{FAMILIES.map(f=><button key={f.code} role="tab" aria-selected={family===f.code} className={family===f.code?'active':''} disabled={busy||loading||Boolean(pending)} onClick={()=>switchFamily(f.code)}><strong>{f.code}</strong><span><b>{f.name}序列</b><small>{f.description}</small></span><em>{catalog?.directions.filter(d=>d.family===f.code).length??0} 个方向</em></button>)}</div>
    {loading?<div className="panel position-empty">正在读取岗位标准…</div>:catalog&&<div className="position-workspace">
      <aside className="panel position-sidebar"><div className="position-section-head"><h3>岗位方向</h3><button disabled={busy||Boolean(pending)} onClick={newDirection}>＋ 新增</button></div><input aria-label="搜索岗位方向" placeholder="搜索岗位方向" value={search} onChange={e=>setSearch(e.target.value)}/><div className="position-direction-list">{directions.map(d=><button className={selected===d.slug?'active':''} key={d.slug} disabled={busy||Boolean(pending)} onClick={()=>{if(maySwitch()){pick(d);setError('');}}}><b>{d.name}</b><small>4 个职级 · {d.grades.reduce((n,g)=>n+g.requirements.length,0)} 项技能要求</small></button>)}{!directions.length&&<p className="position-empty">暂无匹配方向，可新增或导入。</p>}</div></aside>
      <section className="panel position-editor">{draft?<><div className="position-section-head"><div><h3>{selected?draft.name:'新增岗位方向'}</h3><p>{draft.family} 序列 · {dirty?'有未保存修改':'标准配置'} · 技能等级 L1–L5</p></div><div className="position-actions">{selected&&<button className="position-delete" disabled={busy} onClick={()=>void removeDirection()}>删除方向</button>}<button className="primary" disabled={busy||(!dirty&&Boolean(selected))} onClick={()=>void save()}>{busy?'保存中…':'保存岗位标准'}</button></div></div>
        <fieldset disabled={busy}><div className="position-fields"><label>方向名称 *<input data-pos-field="name" disabled={Boolean(pending)} maxLength={128} value={draft.name} placeholder="例如：嵌入式软件" onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>所属序列 *<select data-pos-field="family" disabled={Boolean(pending)} value={draft.family} onChange={e=>changeFamily(e.target.value as JobFamily)}>{FAMILIES.map(f=><option value={f.code} key={f.code}>{f.code} · {f.name}</option>)}</select></label></div>
        <div data-pos-field="grades" className="position-grade-tabs" role="tablist" aria-label="职级配置">{draft.grades.map(g=><button type="button" role="tab" aria-selected={grade===g.code} className={grade===g.code?'active':''} key={g.code} disabled={Boolean(pending)&&pending?.grade!==g.code} onClick={()=>setGrade(g.code)}><b>{g.code}</b><span>{g.requirements.length} 项技能</span></button>)}</div>
        {active&&<><label className="position-grade-name">职级名称 *<input data-pos-field="gradeName" disabled={Boolean(pending)} aria-label="职级名称" maxLength={128} value={active.name} onChange={e=>patchGrade({name:e.target.value})}/></label><div className="position-section-head"><h4>{grade} 技能要求</h4><div className="position-actions">{grade.slice(1)!=='1'&&<button type="button" disabled={Boolean(pending)} onClick={copyPrevious}>复制上一职级</button>}<button data-pos-field="requirements" type="button" onClick={()=>patchGrade({requirements:[...active.requirements,{skillName:'',requiredLevel:1,standard:emptySkillStandard()}]})} disabled={Boolean(pending)||active.requirements.length>=200}>＋ 添加技能</button></div></div>
          <div className="position-skill-head"><span>技能名称 *</span><span>最低技能等级 *</span><span>是否必需 *</span><span>操作</span></div>
          {active.requirements.map((r,index)=><fieldset className="position-skill-block" data-skill-index={index} key={index} disabled={busy||Boolean(pending&&(pending.grade!==grade||pending.index!==index))}><div className="position-skill-row"><input data-pos-field="skillName" list="position-skills" aria-label={`技能 ${index+1}`} maxLength={128} placeholder="选择已有技能或输入新技能" value={r.skillName} onChange={e=>renameSkill(index,e.target.value)}/><select data-pos-field="requiredLevel" aria-label={`技能 ${index+1} 要求等级`} value={r.requiredLevel} onChange={e=>patchGrade({requirements:active.requirements.map((v,i)=>i===index?{...v,requiredLevel:Number(e.target.value)}:v)})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>L{n}</option>)}</select><select data-pos-field="isRequired" aria-label={`技能 ${index+1} 是否必需`} value={r.isRequired===undefined?'':r.isRequired?'yes':'no'} onChange={e=>patchGrade({requirements:active.requirements.map((v,i)=>i===index?{...v,isRequired:e.target.value===''?undefined:e.target.value==='yes'}:v)})}><option value="">请选择</option><option value="yes">是</option><option value="no">否</option></select><button type="button" aria-label={`移除技能 ${index+1}`} onClick={()=>patchGrade({requirements:active.requirements.filter((_,i)=>i!==index)})}>移除</button></div><p className="position-skill-description">L{r.requiredLevel} 技能描述：{(r.standard??catalog.skillStandards[r.skillName])?.levels.find(l=>l.level===r.requiredLevel)?.anchor||'未配置，请补齐等级标准'}</p><SkillStandardEditor usage={usageForSkill(r.skillName)} name={r.skillName} requiredLevel={r.requiredLevel} value={r.standard??catalog.skillStandards[r.skillName]??emptySkillStandard()} onChange={standard=>patchStandard(r.skillName,standard)} pending={Boolean(pending&&pending.grade===grade&&pending.index===index)}
          onComplete={()=>{const standard=r.standard??catalog.skillStandards[r.skillName];if(!standardIssues(standard).length&&r.skillName.trim()){setInitialized(names=>[...names,r.skillName.trim()]);setError('');}}}
          focusRequest={focus?.grade===grade&&focus.index===index?focus.request:undefined}/></fieldset>)}
          {!active.requirements.length&&<div className="position-empty">该职级尚未设置技能要求。每个职级至少配置一项必需技能后方可保存。</div>}<datalist id="position-skills">{catalog.skills.map(name=><option key={name} value={name}/>)}</datalist></>}
        </fieldset><p className="position-footnote">全部字段必填；技能说明及L1–L5达标标准、证明材料要求均需完整。保存后更新当前标准版本 {catalog.standardVersion}，用于资格自查、发展目标和团队技能差距计算。</p></>:<div className="position-empty">选择一个方向，或新增岗位方向开始配置。</div>}</section>
    </div>}
    {importOpen&&<div className="risk-modal-mask" onClick={e=>{if(e.target===e.currentTarget&&!busy)setImportOpen(false);}}><div className="position-import-modal" role="dialog" aria-modal="true" aria-label="导入岗位标准"><div className="position-section-head"><div><h3>导入岗位标准</h3><p>解析预览后确认保存；同名技能更新等级，其余配置保留。</p></div><button aria-label="关闭导入" disabled={busy} onClick={()=>setImportOpen(false)}>✕</button></div>
      <p>支持 Excel（.xlsx / .xls）、CSV、TSV、Markdown / TXT 表格，单文件最多 5MB、2000 行；Excel 请仅保留一个工作表。</p><p>基础七列：序列、方向、职级、技能名称、技能等级、技能描述、是否必须。新技能还需“技能说明”和L1–L5各级“达标标准、证明材料要求”（见完整模板）；已有技能复用库内标准。新方向必须配置全部四个职级。</p>
      <div className="position-upload"><input ref={fileRef} type="file" aria-label="上传岗位标准文件" accept=".xlsx,.xls,.csv,.tsv,.md,.markdown,.txt" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void parse(file);e.target.value='';}}/><button onClick={template}>下载 CSV 模板</button></div>
      {busy&&<p role="status">正在处理文件，请稍候…</p>}{error&&<div className="position-alert" role="alert">{error}</div>}
      {preview&&<><p><b>{filename}</b> · {preview.rows.length} 条有效要求 · {new Set(preview.rows.map(r=>`${r.family}/${r.direction}`)).size} 个方向</p>{preview.errors.length>0&&<div className="position-alert"><b>请修正全部错误后重新上传：</b><div className="position-validation-list">{preview.errors.map((e,i)=><p key={i}>{e}</p>)}</div></div>}
        <div className="position-preview"><table><thead><tr>{['序列','方向','职级','技能名称','技能等级','技能描述','是否必须'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr key={i}><td>{r.family}</td><td>{r.direction}</td><td>{r.grade}</td><td>{r.skillName}</td><td>L{r.requiredLevel}</td><td>{r.levelDescription||'复用库内标准'}</td><td>{r.isRequired===undefined?'未选择':r.isRequired?'是':'否'}</td></tr>)}</tbody></table></div></>}
      <div className="position-import-footer"><span>同方向按技能合并；任何缺失都会阻止整批导入。</span><button className="primary" disabled={busy||!preview||Boolean(preview.errors.length)||!preview.rows.length} onClick={()=>void confirmImport()}>确认导入{preview?.rows.length?` ${preview.rows.length} 项要求`:''}</button></div>
    </div></div>}
  </section>;
}
