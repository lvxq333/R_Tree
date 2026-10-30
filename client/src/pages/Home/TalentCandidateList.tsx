import type { CSSProperties } from 'react';
import type { TalentCandidate } from './types';
import { useUI } from './ui-context';
import { useAuth } from './auth-context';

interface DimensionBarStyle extends CSSProperties {
  '--dimension': string;
}

interface TalentCandidateListProps {
  items: TalentCandidate[];
  busy?: boolean;
  shortlist: Set<string>;
  expandedId: string | null;
  onTogglePerson: (id: string) => void;
  onExpandPerson: (id: string) => void;
}

const TalentCandidateList = ({
  items,
  busy,
  shortlist,
  expandedId,
  onTogglePerson,
  onExpandPerson,
}: TalentCandidateListProps) => {
  const { openProfile } = useUI();
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <div className="candidate-list" id="talent-candidate-list" aria-live="polite">
        <div className="empty-candidates">
          <b>当前筛选下没有候选人</b>
          <p>可切换匹配分层、放宽技能条件，或取消组织与投入筛选。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-list" id="talent-candidate-list" aria-live="polite">
      {items.map((item: TalentCandidate) => {
        const selected = shortlist.has(item.id);
        const expanded = expandedId === item.id;
        return (
          <article key={item.id} className="talent-person" data-person-id={item.id}>
            <div className="person-top">
              <i className={`talent-avatar ${item.avatarTone}`}>{item.avatar}</i>
              <div className="person-identity">
                <h4>
                  <button className="person-profile-link" onClick={() => user.personnelRole==='hr' ? openProfile(item.id) : onExpandPerson(item.id)}>
                    {item.name}
                  </button>
                  <span>{item.org}</span>{item.isDemo && <small className="talent-demo-badge">演示员工</small>}
                </h4>
                <p>{item.role} · 数据更新于 {item.freshness}</p>
              </div>
              <div className="person-reason">
                <b>{item.reason}</b>
                <p>{item.note}</p>
              </div>
              <div className="person-actions">
                <button
                  aria-expanded={expanded}
                  onClick={() => onExpandPerson(item.id)}
                >
                  {expanded ? '收起依据' : '查看依据'}
                </button>
                <button
                  disabled={busy}
                  aria-pressed={selected}
                  className={`add-person ${selected ? 'selected' : ''}`}
                  onClick={() => onTogglePerson(item.id)}
                >
                  {selected ? '✓ 已加入' : '＋ 加入清单'}
                </button>
              </div>
            </div>
            <div className="person-evidence">
              {item.evidence.slice(0, 4).map((text: string) => (
                <span key={text} className="verified">{text}</span>
              ))}
              {item.evidence.length>4&&<span>另有 {item.evidence.length-4} 项认证</span>}
              <span className="gap">{item.gap}</span>
              <span className="availability">{item.availability}</span>
            </div>
            {expanded && (
              <div className="person-detail">
                <div>
                  <h5>技能依据与缺口</h5>
                  <p>{item.note}</p>
                  {item.requiredMatches?.length ? <table className="talent-match-table"><thead><tr><th>必需技能</th><th>要求</th><th>有效认证</th><th>判断</th></tr></thead><tbody>{item.requiredMatches.map(m=><tr key={m.skillSlug}><td>{m.name}</td><td>L{m.requiredLevel}</td><td>{m.currentLevel?`L${m.currentLevel}`:'无认证'}</td><td className={m.met?'talent-met':'talent-unmet'}>{m.met?'达标':'待补齐'}</td></tr>)}</tbody></table> : <p>未设置必需技能。</p>}
                  {!!item.bonusMatches?.length&&<><h5>加分技能</h5>{item.bonusMatches.map(m=><p key={m.skillSlug}>{m.name} · 要求 L{m.requiredLevel} · {m.currentLevel?`已认证 L${m.currentLevel}`:'无有效认证'}</p>)}</>}
                  <h5>全部已认证技能</h5><p>{item.evidence.join('、') || '暂无有效认证，不能据此判断不具备能力。'}</p>
                </div>
                <div>
                  <h5>登记项目经历</h5>
                  {item.projects?.length?item.projects.map((p,i)=><p key={`${p.title}-${i}`}><b>{p.title}</b><br/>{p.verification}</p>):<p>暂无登记项目经历。</p>}
                  {!!item.matchedKeywords?.length&&<p>关键词命中：{item.matchedKeywords.join('、')}</p>}
                  <h5>投入与时间</h5><p>{item.availability}。项目开始时间与正式投入均需进一步确认。</p>
                  {item.dimensions.map(([label,value])=>{
                    const barStyle:DimensionBarStyle={'--dimension':`${value}%`};
                    return <div key={label} className="dimension-row"><span>{label}</span><i style={barStyle}/><b>{value}%</b></div>;
                  })}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default TalentCandidateList;
