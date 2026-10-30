import type { TalentCandidate, TalentCriteria } from '@shared/api.interface';
interface Props {
  items:TalentCandidate[]; criteria:TalentCriteria; scopeText:string; busy:boolean; exporting:boolean;
  onRemove:(id:string)=>void; onClear:()=>void; onExport:()=>void;
}
export default function ShortlistPanel({items,criteria,scopeText,busy,exporting,onRemove,onClear,onExport}:Props) {
  const covered=criteria.required.filter(skill=>items.some(p=>p.requiredMatches?.some(m=>m.skillSlug===skill.skillSlug&&m.met))).length;
  const coverage=criteria.required.length?Math.round(covered/criteria.required.length*100):null;
  const missing=criteria.required.filter(skill=>!items.some(p=>p.requiredMatches?.some(m=>m.skillSlug===skill.skillSlug&&m.met)));
  const unknown=items.filter(p=>p.availabilityPercent===null).length;
  return <aside className="shortlist-panel panel" aria-label="个人候选清单">
    <div className="shortlist-head"><div><span>我的候选清单</span><h3><b id="shortlist-count">{items.length}</b> 位候选人</h3></div><button id="clear-shortlist" disabled={busy||!items.length} onClick={onClear}>清空</button></div>
    <div className="shortlist-context"><span>当前匹配需求</span><b>{criteria.title}</b><small id="shortlist-scope">{scopeText}</small><small>按当前账号保存，跨页面刷新保留</small></div>
    <div id="shortlist-items" className="shortlist-items">{items.length?items.map(item=><div className="shortlist-item" key={item.id}>
      <i className={`talent-avatar ${item.avatarTone}`}>{item.avatar}</i><span><b>{item.name}</b><small>{item.org} · {item.availability}</small></span>
      <button disabled={busy} aria-label={`从候选清单移除 ${item.name}`} onClick={()=>onRemove(item.id)}>×</button>
    </div>):<div className="shortlist-empty">还没有加入候选人。<br/>从左侧搜索结果中加入合适的人。</div>}</div>
    <div className="shortlist-readiness"><div><span>必需技能覆盖</span><b id="coverage-value">{coverage===null?'未设置':`${coverage}%`}</b></div>
      <div className="readiness-track"><i id="coverage-track" style={{width:`${coverage ?? 0}%`}}/></div>
      <p id="coverage-note">{coverage===null?'添加必需技能后，按候选人的有效认证计算覆盖情况。':`已覆盖 ${covered}/${criteria.required.length} 项必需技能。${missing.length?`仍有 ${missing.length} 项缺少达标候选人。`:'每项至少有一位候选人达标。'}`}</p>
      {unknown>0&&<p>{unknown} 位候选人的投入比例待确认。</p>}
    </div>
    <button className="primary shortlist-primary" id="create-shortlist" disabled={busy||exporting||!items.length} onClick={onExport}>{exporting?'正在导出…':'↓ 导出 Excel 候选名单'}</button>
    <small className="privacy-note">导出包含当前权限内的候选人、技能依据和缺口，供后续沟通确认。</small>
  </aside>;
}
