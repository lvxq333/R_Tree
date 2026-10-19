import { useState, type ChangeEvent } from 'react';
import { useUI } from './ui-context';
import { useCertifications } from './certification-context';
import type { ApprovalAction, ApprovalItem } from './certification-context';

const DEFAULT_DETAIL_TEXT =
  '申请人已提交相关证明，请结合技能行为锚点核对材料是否能够支持目标等级。';

function fallbackEvidence(title: string): [string, string, string][] {
  return [
    ['成果', `${title}相关项目材料`, '申请人提交 · 已完成基础校验'],
    ['记录', '工作过程与结果记录', '事实中心归集 · 等待人工复核'],
  ];
}

function fallbackAnchor(targetLevel: number): string {
  return `能够在真实工作场景中稳定表现出 L${targetLevel} 对应行为，并提供可复核成果。`;
}

const ApprovalPage = () => {
  const { showToast } = useUI();
  const { approvals, error, pendingApprovalCount, decideApproval } = useCertifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const pending: ApprovalItem[] = approvals.filter(
    (item: ApprovalItem) => item.status === 'pending',
  );

  const selectedFromState: ApprovalItem | undefined = selectedId
    ? approvals.find((entry: ApprovalItem) => entry.id === selectedId)
    : undefined;
  const activeItem: ApprovalItem | undefined =
    selectedFromState && selectedFromState.status === 'pending'
      ? selectedFromState
      : pending[0];

  const detailText: string = activeItem?.detail ?? DEFAULT_DETAIL_TEXT;
  const evidence: [string, string, string][] = activeItem
    ? fallbackEvidence(activeItem.title)
    : [];
  const anchor: string = activeItem
    ? fallbackAnchor(activeItem.targetLevel)
    : '';

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setComment('');
  };

  const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value);
  };

  const handleAction = (action: ApprovalAction) => {
    if (!activeItem) return;
    const trimmed = comment.trim();
    if (activeItem.kind === 'downgrade' && !trimmed) {
      showToast('请先填写复核意见，说明本次判断依据。');
      return;
    }
    if ((action === 'return' || action === 'reject') && !trimmed) {
      showToast('退回或驳回申请时，请先填写审批意见。');
      return;
    }
    decideApproval(activeItem.id, action, trimmed);
    setComment('');
  };

  return (
    <section className="page active" id="approval">
      {error ? <p style={{ color: '#d95850', margin: '0 0 8px' }}>{error}</p> : null}
      <section className="approval-heading">
        <div>
          <h2>技能认证与复核</h2>
          <p>统一处理点亮、升级和降级复核。任何正式等级变化都需要明确依据。</p>
        </div>
        <div className="approval-stats">
          <span><b>{pendingApprovalCount}</b> 待处理</span>
          <span><b>1</b> 降级复核</span>
          <span><b>12</b> 本月已处理</span>
        </div>
      </section>
      <div className="approval-layout">
        <section className="panel approval-queue">
          <div className="section-head">
            <div>
              <h3>待处理队列</h3>
              <p>优先显示降级复核、临近截止和补充后再次提交的申请</p>
            </div>
            <button className="ghost">筛选 ⌄</button>
          </div>
          <div className="approval-list">
            {pending.length === 0 ? (
              <div className="approval-empty">
                <strong>待审批已处理完</strong>
                <span>新的申请会出现在这里</span>
              </div>
            ) : (
              pending.map((item: ApprovalItem) => (
                <button
                  key={item.id}
                  className={`approval-item ${item.id === activeItem?.id ? 'active' : ''}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <i className={`applicant-avatar ${item.kind === 'downgrade' ? 'review' : ''}`}>
                    {item.kind === 'downgrade' ? '↻' : item.avatar}
                  </i>
                  <span>
                    <b>{item.applicant} · {item.title}</b>
                    <small>{item.department} · {item.sourceLabel}</small>
                    <span className="item-meta">
                      <span>L{item.currentLevel} → L{item.targetLevel}</span>
                      <span>提交于 {item.submittedAt}</span>
                    </span>
                  </span>
                  <em className={`status-pill ${item.kind === 'downgrade' ? 'review' : 'pending'}`}>
                    {item.kind === 'downgrade' ? '降级复核' : `${item.due} 前`}
                  </em>
                </button>
              ))
            )}
          </div>
        </section>
        <aside className="panel approval-detail" aria-live="polite">
          {!activeItem ? (
            <div className="approval-empty">
              <strong>没有待处理申请</strong>
              <span>可以返回团队概览查看其他管理事项</span>
            </div>
          ) : activeItem.kind === 'downgrade' ? (
            <>
              <div className="detail-titlebar">
                <div>
                  <span className="review-type-label">降级复核</span>
                  <h3>{activeItem.applicant} · {activeItem.title}</h3>
                  <p>{activeItem.department} · {activeItem.sourceLabel}</p>
                </div>
                <strong className="level-change level-down">
                  L{activeItem.currentLevel} → L{activeItem.targetLevel}
                </strong>
              </div>
              <dl className="review-facts">
                <div><dt>触发时间</dt><dd>{activeItem.submittedAt}</dd></div>
                <div><dt>处理期限</dt><dd>{activeItem.due}</dd></div>
                <div><dt>复核期间</dt><dd>保留当前 L{activeItem.currentLevel}</dd></div>
                <div>
                  <dt>员工反馈</dt>
                  <dd>{activeItem.employeeResponse || '尚未补充说明'}</dd>
                </div>
              </dl>
              <div className="source-explanation review-explanation">
                <b>复核说明：</b>{detailText}
              </div>
              <section className="evidence-section">
                <h4>触发依据与反证</h4>
                {evidence.map(([type, title, meta]) => (
                  <div className="evidence-entry" key={title}>
                    <span>{type}</span>
                    <div><b>{title}</b><small>{meta}</small></div>
                  </div>
                ))}
              </section>
              <section className="anchor-section">
                <h4>原 L{activeItem.currentLevel} 行为锚点</h4>
                <p>{anchor}</p>
              </section>
              <section className="review-comment">
                <h4>复核意见</h4>
                <textarea
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="请写明维持、延长观察或降级的具体判断依据。"
                />
              </section>
              <div className="review-impact-note">
                <b>确认降级后</b>
                <span>
                  新等级将参与 Gap、人才匹配和技能供需计算；历史等级和证据继续保留，员工可在 10 个工作日内申诉。
                </span>
              </div>
              <div className="detail-actions">
                <button className="ghost" onClick={() => handleAction('maintain')}>
                  维持 L{activeItem.currentLevel}
                </button>
                <button className="ghost" onClick={() => handleAction('extend')}>延长观察</button>
                <button className="primary downgrade-button" onClick={() => handleAction('downgrade')}>
                  确认降至 L{activeItem.targetLevel}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="detail-titlebar">
                <div>
                  <h3>{activeItem.applicant} · {activeItem.title}</h3>
                  <p>{activeItem.department} · {activeItem.sourceLabel}</p>
                </div>
                <strong className="level-change">
                  L{activeItem.currentLevel} → L{activeItem.targetLevel}
                </strong>
              </div>
              <dl className="review-facts">
                <div><dt>申请时间</dt><dd>{activeItem.submittedAt}</dd></div>
                <div><dt>处理期限</dt><dd>{activeItem.due}</dd></div>
                <div><dt>建议审核方式</dt><dd>直属管理者确认</dd></div>
                <div><dt>正式等级有效期</dt><dd>12 个月</dd></div>
              </dl>
              <div className="source-explanation"><b>申请摘要：</b>{detailText}</div>
              <section className="evidence-section">
                <h4>申请证据</h4>
                {evidence.map(([type, title, meta]) => (
                  <div className="evidence-entry" key={title}>
                    <span>{type}</span>
                    <div><b>{title}</b><small>{meta}</small></div>
                  </div>
                ))}
              </section>
              <section className="anchor-section">
                <h4>L{activeItem.targetLevel} 行为锚点</h4>
                <p>{anchor}</p>
              </section>
              <section className="review-comment">
                <h4>审批意见</h4>
                <textarea
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="通过可简要说明判断依据；退回或驳回时必须填写原因。"
                />
              </section>
              <div className="detail-actions">
                <button className="ghost reject-button" onClick={() => handleAction('reject')}>
                  驳回申请
                </button>
                <button className="ghost" onClick={() => handleAction('return')}>退回补充</button>
                <button className="primary approve-button" onClick={() => handleAction('approve')}>
                  通过并点亮
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
};

export default ApprovalPage;
