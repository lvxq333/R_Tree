import type { CSSProperties } from 'react';
import type { TalentCandidate } from './types';
import { useUI } from './ui-context';

interface DimensionBarStyle extends CSSProperties {
  '--dimension': string;
}

interface TalentCandidateListProps {
  items: TalentCandidate[];
  shortlist: Set<string>;
  expandedId: string | null;
  onTogglePerson: (id: string) => void;
  onExpandPerson: (id: string) => void;
}

const TalentCandidateList = ({
  items,
  shortlist,
  expandedId,
  onTogglePerson,
  onExpandPerson,
}: TalentCandidateListProps) => {
  const { openProfile } = useUI();

  if (items.length === 0) {
    return (
      <div className="candidate-list" id="talent-candidate-list" aria-live="polite">
        <div className="empty-candidates">
          <b>当前筛选下没有候选人</b>
          <p>可取消“仅看可投入”或切换组织范围。</p>
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
                  <button className="person-profile-link" onClick={() => openProfile(item.id)}>
                    {item.name}
                  </button>
                  <span>{item.org}</span>
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
                  className={`add-person ${selected ? 'selected' : ''}`}
                  onClick={() => onTogglePerson(item.id)}
                >
                  {selected ? '✓ 已加入' : '＋ 加入清单'}
                </button>
              </div>
            </div>
            <div className="person-evidence">
              {item.evidence.map((text: string, index: number) => (
                <span key={text} className={index < 2 ? 'verified' : ''}>{text}</span>
              ))}
              <span className="gap">{item.gap}</span>
              <span className="availability">{item.availability}</span>
            </div>
            {expanded && (
              <div className="person-detail">
                <div>
                  <h5>推荐依据</h5>
                  <p>
                    {item.note}
                    系统仅汇总已授权的技能等级、项目成果与可用性，正式调配仍需管理者和员工确认。
                  </p>
                </div>
                <div>
                  <h5>分项判断</h5>
                  {item.dimensions.map(([label, value]: [string, number]) => {
                    const barStyle: DimensionBarStyle = { '--dimension': `${value}%` };
                    return (
                      <div key={label} className="dimension-row">
                        <span>{label}</span>
                        <i style={barStyle} />
                        <b>{value}%</b>
                      </div>
                    );
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
