import type { TalentCandidate } from './types';
import { useUI } from './ui-context';

interface ShortlistPanelProps {
  items: TalentCandidate[];
  scopeText: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddRole: () => void;
}

function coverageValue(count: number): number {
  return Math.min(96, count > 0 ? 58 + count * 25 : 0);
}

function coverageNote(count: number): string {
  if (count > 1) return '核心能力已形成互补；下一步可增加项目角色并检查人员冲突。';
  if (count === 1) return '强化学习与机器人感知已有可靠覆盖；运动控制仍建议补充 1 位候选。';
  return '加入候选人后，系统会按能力覆盖、经历与可用性分别提示风险。';
}

const ShortlistPanel = ({ items, scopeText, onRemove, onClear, onAddRole }: ShortlistPanelProps) => {
  const { showToast } = useUI();
  const coverage = coverageValue(items.length);

  return (
    <aside className="shortlist-panel panel">
      <div className="shortlist-head">
        <div>
          <span>候选清单</span>
          <h3><b id="shortlist-count">{items.length}</b> 位候选人</h3>
        </div>
        <button id="clear-shortlist" onClick={onClear}>清空</button>
      </div>
      <div className="shortlist-context">
        <span>当前需求</span>
        <b>具身智能业务探索</b>
        <small id="shortlist-scope">{scopeText}</small>
      </div>
      <div id="shortlist-items" className="shortlist-items">
        {items.length > 0 ? (
          items.map((item: TalentCandidate) => (
            <div key={item.id} className="shortlist-item">
              <i className={`talent-avatar ${item.avatarTone}`}>{item.avatar}</i>
              <span>
                <b>{item.name}</b>
                <small>{item.role.split(' · ')[0]} · {item.availability}</small>
              </span>
              <button
                data-remove-shortlist={item.id}
                aria-label={`从候选清单移除 ${item.name}`}
                onClick={() => onRemove(item.id)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="shortlist-empty">
            还没有加入候选人。<br />从左侧推荐结果中加入合适的人。
          </div>
        )}
      </div>
      <div className="shortlist-readiness">
        <div><span>必需能力覆盖</span><b id="coverage-value">{coverage}%</b></div>
        <div className="readiness-track"><i id="coverage-track" style={{ width: `${coverage}%` }} /></div>
        <p id="coverage-note">{coverageNote(items.length)}</p>
      </div>
      <div className="next-stage">
        <span>后续可扩展</span>
        <p>添加项目角色后，可计算团队组合、人员冲突与跨组织协调路径。</p>
        <button id="add-role-button" onClick={onAddRole}>＋ 添加项目角色</button>
      </div>
      <button
        className="primary shortlist-primary"
        id="create-shortlist"
        disabled={items.length === 0}
        onClick={() =>
          showToast(`已生成包含 ${items.length} 位候选人的名单，可发起跨组织沟通。`)
        }
      >
        生成候选名单
      </button>
      <small className="privacy-note">跨组织候选默认仅展示授权摘要，发起沟通后进入确认流程。</small>
    </aside>
  );
};

export default ShortlistPanel;
