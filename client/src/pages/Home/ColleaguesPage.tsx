import { useEffect, useMemo, useState } from 'react';
import type { EmployeeListItem } from '@shared/api.interface';
import { listColleagues } from '@/api/employee';
import { useAuth } from './auth-context';

export default function ColleaguesPage() {
  const {user}=useAuth();
  const [people,setPeople]=useState<EmployeeListItem[]>([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;listColleagues().then(rows=>{if(active)setPeople(rows);})
    .catch(()=>{if(active)setError('同事目录暂时无法读取');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};},[]);
  const filtered=useMemo(()=>people.filter(person=>`${person.name} ${person.role} ${person.org}`
    .toLowerCase().includes(query.trim().toLowerCase())),[people,query]);
  return <section className="page active colleagues-page" id="colleagues">
    <div className="panel colleagues-panel">
      <div className="section-head"><div><h2>我的同事</h2><p>{user.department||'所在部门'} · 仅展示同部门的基础信息</p></div>
        <strong>{loading?'…':people.length} 人</strong></div>
      <label className="colleagues-search">搜索同事<input id="colleagues-search" value={query} onChange={event=>setQuery(event.target.value)}
        placeholder="姓名或岗位" /></label>
      {error && <p role="alert">{error}</p>}
      <div className="colleagues-grid">{filtered.map(person=><article key={person.id}>
        <div className="colleagues-avatar">{person.avatar||person.name.slice(0,1)}</div>
        <div><strong>{person.name}</strong><span>{person.role||'岗位未维护'}</span><small>{person.org}</small></div>
        {person.id===user.employeeSlug && <em>我</em>}
      </article>)}</div>
      {!loading && !error && filtered.length===0 && <p className="fc-empty">没有匹配的同事</p>}
    </div>
  </section>;
}
