import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import type { EmployeeWideRow, FactRecord } from '@shared/api.interface';
import * as api from '@/api/fact-center';
import { useAuth } from './auth-context';
import './fact-center.css';

const kindNames: Record<string,string> = { project:'项目', performance:'绩效', legacy_evidence:'历史证据',
  git_commit:'代码提交', okr:'OKR', employee_transfer:'员工调动', work_artifact:'工作成果' };
const blankFact = { kind:'project',title:'',occurredAt:new Date().toISOString().slice(0,10),detail:'' };
function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const value = error.response?.data?.error?.message;
    if (typeof value === 'string') return value;
  }
  return '操作失败，请重试';
}

export default function FactCenterPage() {
  const {user}=useAuth();
  const canEdit=user.personnelRole==='hr';
  const [rows,setRows] = useState<EmployeeWideRow[]>([]);
  const [selected,setSelected] = useState('');
  const [facts,setFacts] = useState<FactRecord[]>([]);
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [editing,setEditing] = useState(false);
  const [form,setForm] = useState({name:'',role:'',org:'',department:'',jobGrade:'',personnelRole:'employee',workLocation:'',preferredTrack:'',status:'',hireDate:'',summary:''});
  const [factForm,setFactForm] = useState(blankFact);
  const [adding,setAdding] = useState(false);
  const [editingFactId,setEditingFactId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);setError('');
    try {
      const result = await api.listWideEmployees();
      setRows(result);
      const requested=sessionStorage.getItem('fact-center:selected-employee');
      if(requested)sessionStorage.removeItem('fact-center:selected-employee');
      setSelected(current => requested && result.some(item=>item.employeeSlug===requested) ? requested
        : result.some(item => item.employeeSlug===current) ? current : result[0]?.employeeSlug ?? '');
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); const refresh=() => { void load(); }; window.addEventListener('fact-center:refresh',refresh);
    return () => window.removeEventListener('fact-center:refresh',refresh); },[load]);
  useEffect(() => {
    if (!selected) { setFacts([]); return; }
    let active=true;
    api.listEmployeeFacts(selected).then(result => { if(active) setFacts(result); })
      .catch(cause => { if(active) setError(message(cause)); });
    return () => { active=false; };
  },[selected,rows]);
  const person=rows.find(row => row.employeeSlug===selected);
  useEffect(() => { if(person) setForm({name:person.name,role:person.role??'',org:person.org??'',status:person.status??'',
    department:person.department??'',jobGrade:person.jobGrade??'',personnelRole:person.personnelRole,
    workLocation:person.workLocation??'',preferredTrack:person.preferredTrack??'',
    hireDate:person.hireDate??'',summary:person.summary??''}); setEditing(false);setAdding(false);setEditingFactId(null); },[selected]);
  const filtered=useMemo(() => rows.filter(row => `${row.name} ${row.employeeSlug} ${row.org??''} ${row.role??''}`.toLowerCase().includes(query.trim().toLowerCase())),[rows,query]);
  const totals=useMemo(() => ({people:rows.length,facts:rows.reduce((sum,row)=>sum+row.factCount,0),
    projects:rows.reduce((sum,row)=>sum+row.projectCount,0)}),[rows]);
  const reload=async () => { await load(); if(selected) setFacts(await api.listEmployeeFacts(selected)); };
  const saveEmployee=async (event:FormEvent) => { event.preventDefault(); setBusy(true);setError('');
    try { await api.updateEmployee(selected,form); await reload();setEditing(false);setNotice('员工信息已保存'); }
    catch(cause) { setError(message(cause)); } finally { setBusy(false); } };
  const saveFact=async (event:FormEvent) => { event.preventDefault();setBusy(true);setError('');
    try { const input={...factForm,occurredAt:new Date(`${factForm.occurredAt}T12:00:00`).toISOString()};
      if(editingFactId) await api.updateFact(editingFactId,input); else await api.addFact(selected,input);
      await reload();setFactForm(blankFact);setAdding(false);setEditingFactId(null);setNotice(editingFactId?'事实已修订，并写入变更记录':'事实已录入，并写入变更记录'); }
    catch(cause) { setError(message(cause)); } finally { setBusy(false); } };
  const revoke=async (fact:FactRecord) => { if(!window.confirm(`撤销「${fact.title}」？记录将保留在版本历史中。`)) return;
    setBusy(true);setError(''); try { await api.revokeFact(fact.sourceKey);await reload();setNotice('事实已撤销'); }
    catch(cause) { setError(message(cause)); } finally { setBusy(false); } };
  const editFact=(fact:FactRecord) => { setEditingFactId(fact.sourceKey);setFactForm({kind:fact.kind,title:fact.title,
    occurredAt:fact.occurrenceLabel?.slice(0,10)??new Date().toISOString().slice(0,10),
    detail:typeof fact.content.detail==='string'?fact.content.detail:''});setAdding(true); };

  return <section className="page active fact-center-page" id="fact-center">
    <div className="fc-summary">
      <div><small>员工总数</small><strong>{totals.people}</strong></div><div><small>有效事实</small><strong>{totals.facts}</strong></div>
      <div><small>项目事实</small><strong>{totals.projects}</strong></div><div><small>汇总粒度</small><strong>1 人 / 行</strong></div>
    </div>
    <div className="fc-layout">
      <section className="panel fc-list">
        <div className="fc-panel-head"><div><h2>员工汇总宽表</h2><p>员工主数据与事实中心实时汇总</p></div><button type="button" onClick={() => void load()} disabled={loading}>刷新</button></div>
        <label className="fc-search"><span>搜索员工</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="姓名、工号、组织或岗位" /></label>
        <div className="fc-table-scroll"><table><thead><tr><th>员工</th><th>部门 / 岗位</th><th>职级</th><th>人员类型</th><th>项目</th><th>绩效</th><th>证据</th><th>其他</th><th>事实总数</th></tr></thead>
          <tbody>{filtered.map(row=><tr key={row.employeeSlug} className={selected===row.employeeSlug?'selected':''} onClick={()=>setSelected(row.employeeSlug)}>
            <td><button type="button" onClick={()=>setSelected(row.employeeSlug)}><b>{row.name}</b><small>{row.employeeSlug}</small></button></td>
            <td><span>{row.department||row.org||'未填写'}</span><small>{row.role||'未填写'}{row.isDemo?' · 模拟':''}</small></td>
            <td>{row.jobGrade||'—'}</td><td>{row.personnelRole==='hr'?'HR':row.jobGrade==='T4'?'专家':'员工'}</td>
            <td>{row.projectCount}</td><td>{row.performanceCount}</td>
            <td>{row.evidenceCount}</td><td>{row.otherFactCount}</td><td><b>{row.factCount}</b></td></tr>)}</tbody></table>
          {!loading && filtered.length===0 && <p className="fc-empty">没有匹配的员工</p>}{loading && <p className="fc-empty">正在读取汇总数据…</p>}</div>
      </section>
      <section className="panel fc-detail">
        {person ? <><div className="fc-panel-head"><div><h2>{person.name}</h2><p>{person.employeeSlug} · {person.org||'未填写组织'}</p></div>
          {canEdit && <button type="button" onClick={()=>setEditing(value=>!value)}>{editing?'取消':'编辑资料'}</button>}</div>
          {editing && canEdit ? <form className="fc-form" onSubmit={saveEmployee}>
            {([['name','姓名'],['org','组织'],['department','部门'],['role','岗位'],['workLocation','工作地点'],['preferredTrack','发展序列'],['status','状态'],['hireDate','入职日期']] as const).map(([key,label])=><label key={key}>{label}<input type={key==='hireDate'?'date':'text'} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))} required={key==='name'} /></label>)}
            <label>职级<select value={form.jobGrade} onChange={event=>setForm(current=>({...current,jobGrade:event.target.value}))}><option value="">未定级</option>{['T','P','M','F'].flatMap(f=>[1,2,3,4].map(n=>`${f}${n}`)).map(grade=><option key={grade}>{grade}</option>)}</select></label>
            <label>人员类型<select value={form.personnelRole} onChange={event=>setForm(current=>({...current,personnelRole:event.target.value}))}><option value="employee">员工</option><option value="hr">HR</option></select></label>
            <label className="full">个人简介<textarea value={form.summary} onChange={event=>setForm(current=>({...current,summary:event.target.value}))} rows={3} /></label>
            <button className="primary" disabled={busy}>保存资料</button></form> : <div className="fc-meta"><span>状态：{person.status||'未填写'}</span><span>入职：{person.hireDate||'未填写'}</span><p>{person.summary||'暂无个人简介'}</p></div>}
          <div className="fc-panel-head fc-facts-head"><div><h3>事实记录</h3><p>展示最近 200 条有效事实；模拟数据单独标识</p></div>
            {canEdit && <button type="button" onClick={()=>{ setAdding(value=>!value);setEditingFactId(null);setFactForm(blankFact); }}>{adding?'取消':'录入事实'}</button>}</div>
          {adding && canEdit && <form className="fc-form fc-fact-form" onSubmit={saveFact}>
            <label>类别<select value={factForm.kind} onChange={event=>setFactForm(current=>({...current,kind:event.target.value}))}><option value="project">项目</option><option value="performance">绩效</option><option value="work_artifact">工作成果</option></select></label>
            <label>发生日期<input type="date" value={factForm.occurredAt} onChange={event=>setFactForm(current=>({...current,occurredAt:event.target.value}))} required /></label>
            <label className="full">标题<input value={factForm.title} onChange={event=>setFactForm(current=>({...current,title:event.target.value}))} maxLength={200} required /></label>
            <label className="full">事实内容<textarea value={factForm.detail} onChange={event=>setFactForm(current=>({...current,detail:event.target.value}))} rows={3} maxLength={4000} required /></label>
            <button className="primary" disabled={busy}>{editingFactId?'保存修订':'保存事实'}</button></form>}
          <div className="fc-facts">{facts.length ? facts.map(fact=><article key={fact.id}><div><span className="fc-kind">{kindNames[fact.kind]??fact.kind}</span>
            {fact.provenance==='simulated' && <span className="fc-simulated">模拟</span>}{fact.provenance==='manager_entered' && <span className="fc-manual">人工录入</span>}
            <small>{fact.occurrenceLabel||'时间未记录'}</small></div><h4>{fact.title}</h4>
            <p>{typeof fact.content.detail==='string'?fact.content.detail:JSON.stringify(fact.content)}</p>
            <footer><span>版本 {fact.version} · {fact.sourceTable}</span>{canEdit && fact.provenance==='manager_entered' && <span className="fc-fact-actions"><button type="button" disabled={busy} onClick={()=>editFact(fact)}>编辑</button><button type="button" disabled={busy} onClick={()=>void revoke(fact)}>撤销</button></span>}</footer></article>) : <p className="fc-empty">该员工暂无有效事实</p>}</div>
        </> : <p className="fc-empty">请选择员工查看详情</p>}
      </section>
    </div>
    {error && <div className="fc-message error" role="alert">{error}</div>}{notice && <div className="fc-message" role="status">{notice}</div>}
  </section>;
}
