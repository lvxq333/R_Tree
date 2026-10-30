import { useState, type ChangeEvent } from 'react';
import { useUI } from './ui-context';
import { useCertifications } from './certification-context';
import type { ApprovalAction, ApprovalItem } from './certification-context';

function fallbackAnchor(targetLevel: number): string {
  return `能够在真实工作场景中稳定表现出 L${targetLevel} 对应行为，并提供可复核成果。`;
}

/** 已处理结果标签（仅展示用，判定逻辑在后端 dueState/status） */
const PROCESSED_LABEL: Record<string, string> = {
  approved: '已通过并点亮',
  rejected: '已驳回',
  returned: '已退回补充',
  maintained: '已维持等级',
  extended: '已延长观察',
};

const ApprovalPage = () => {
  const { showToast } = useUI();
  const { approvals, approvalStats, error, pendingApprovalCount, decideApproval } = useCertifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const pending: ApprovalItem[] = approvals.filter(
    (item: ApprovalItem) => item.status === 'pending',
  );
  // 队列展示全部可见审批单：待处理在前（保持原有优先级排序），已处理在后，徽标按后端 dueState 渲染
  const queueItems: ApprovalItem[] = [
    ...pending,
    ...approvals.filter((item: ApprovalItem) => item.status !== 'pending'),
  ];

  const selectedFromState: ApprovalItem | undefined = selectedId
    ? approvals.find((entry: ApprovalItem) => entry.id === selectedId)
    : undefined;
  const activeItem: ApprovalItem | undefined =
    selectedFromState ?? pending[0];

  const evidence = activeItem?.evidence ?? [];
  const anchor: string = activeItem
    ? (activeItem.anchor?.trim() || fallbackAnchor(activeItem.targetLevel))
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
    // 已超过处理期限的单据不可再操作（后端同样会拒绝，这里同步拦截避免误点）
    if (activeItem.dueState === 'overdue') {
      showToast(`该申请已超过处理期限（${activeItem.due}），不可再操作。`);
      return;
    }
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
          <span><b>{approvalStats?.downgrade ?? 0}</b> 降级复核</span>
          <span><b>{approvalStats?.processedThisMonth ?? 0}</b> 本月已处理</span>
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
            {queueItems.length === 0 ? (
              <div className="approval-empty">
                <strong>待审批已处理完</strong>
                <span>新的申请会出现在这里</span>
              </div>
            ) : (
              queueItems.map((item: ApprovalItem) => {
                // 徽标按后端 dueState 判定渲染：已处理 > 已过期 > 降级复核 / 期限
                const pill = item.dueState === 'processed'
                  ? { cls: 'processed', text: '已处理' }
                  : item.dueState === 'overdue'
                    ? { cls: 'overdue', text: '已过期' }
                    : item.kind === 'downgrade'
                      ? { cls: 'review', text: '降级复核' }
                      : { cls: 'pending', text: `${item.due} 前` };
                return (
                  <button
                    key={item.id}
                    className={`approval-item ${item.id === activeItem?.id ? 'active' : ''} ${item.dueState === 'processed' ? 'done' : ''}`}
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
                    <em className={`status-pill ${pill.cls}`}>{pill.text}</em>
                  </button>
                );
              })
            )}
          </div>
        </section>
        <aside className="panel approval-detail" aria-live="polite">
          {!activeItem ? (
            <div className="approval-empty">
              <strong>没有待处理申请</strong>
              <span>可以返回团队概览查看其他管理事项</span>
            </div>
          ) : activeItem.status !== 'pending' ? (
            /* 已处理单据：只读结果卡，操作按钮不展示（处理动作只能作用于待处理单据） */
            <>
              <div className="detail-titlebar">
                <div>
                  <span className="review-type-label done-label">已处理</span>
                  <h3>{activeItem.applicant} · {activeItem.title}</h3>
                  <p>{activeItem.department} · {activeItem.sourceLabel}</p>
                </div>
                <strong className="level-change">
                  L{activeItem.currentLevel} → L{activeItem.targetLevel}
                </strong>
              </div>
              <dl className="review-facts">
                <div><dt>提交时间</dt><dd>{activeItem.submittedAt}</dd></div>
                <div><dt>处理期限</dt><dd>{activeItem.due}</dd></div>
                <div><dt>处理结果</dt><dd>{PROCESSED_LABEL[activeItem.status] ?? activeItem.status}</dd></div>
                <div><dt>员工反馈</dt><dd>{activeItem.employeeResponse || '—'}</dd></div>
              </dl>
              <div className="source-explanation">
                <b>处理说明：</b>该审批单已完成处理（{PROCESSED_LABEL[activeItem.status] ?? activeItem.status}），等级变化已按决定生效并计入成长记录。
              </div>
              <section className="evidence-section">
                <h4>关联证据</h4>
                {evidence.length === 0 ? (
                  <p className="evidence-empty">该审批单未关联结构化材料。</p>
                ) : evidence.map((entry) => (
                  <div className="evidence-entry" key={`${entry.type}-${entry.title}`}>
                    <span>{entry.type || '证据'}</span>
                    <div><b>{entry.title}</b>{entry.detail ? <small>{entry.detail}</small> : null}</div>
                  </div>
                ))}
              </section>
            </>
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
                <div><dt>催办记录</dt><dd>{activeItem.reminder.count > 0 ? `已催办 ${activeItem.reminder.count} 次，最近 ${activeItem.reminder.lastAt}` : '员工尚未催办'}</dd></div>
                <div><dt>复核期间</dt><dd>保留当前 L{activeItem.currentLevel}</dd></div>
                <div>
                  <dt>员工反馈</dt>
                  <dd>{activeItem.employeeResponse || '尚未补充说明'}</dd>
                </div>
              </dl>
              <div className="source-explanation review-explanation">
                <b>复核说明：</b>{activeItem.detail ?? '请结合技能行为锚点核对材料是否能够支持目标等级。'}
              </div>
              <section className="evidence-section">
                <h4>触发依据与反证</h4>
                {evidence.length === 0 ? (
                  <p className="evidence-empty">暂无结构化证据，请结合员工说明与事实中心记录人工判断。</p>
                ) : evidence.map((entry) => (
                  <div className="evidence-entry" key={`${entry.type}-${entry.title}`}>
                    <span>{entry.type || '证据'}</span>
                    <div><b>{entry.title}</b>{entry.detail ? <small>{entry.detail}</small> : null}</div>
                  </div>
                ))}
              </section>
              <section className="anchor-section">
                <h4>原 L{activeItem.currentLevel} 行为锚点</h4>
                <p style={{whiteSpace:'pre-wrap'}}>{anchor}</p>
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
              {activeItem.dueState === 'overdue' && (
                <div className="overdue-note" role="alert">
                  <b>已超过处理期限（{activeItem.due}）</b>
                  <span>按流程该复核单不可再处理，需重新发起复核；如需特殊处理请通过线下流程确认。</span>
                </div>
              )}
              <div className="detail-actions">
                <button className="ghost" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('maintain')}>
                  维持 L{activeItem.currentLevel}
                </button>
                <button className="ghost" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('extend')}>延长观察</button>
                <button className="primary downgrade-button" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('downgrade')}>
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
                <div><dt>催办记录</dt><dd>{activeItem.reminder.count > 0 ? `已催办 ${activeItem.reminder.count} 次，最近 ${activeItem.reminder.lastAt}` : '申请人尚未催办'}</dd></div>
                <div><dt>建议审核方式</dt><dd>直属管理者确认</dd></div>
                <div><dt>正式等级有效期</dt><dd>12 个月</dd></div>
              </dl>
              <div className="source-explanation"><b>申请摘要：</b>{activeItem.detail ?? '申请人已提交相关证明，请结合技能行为锚点核对材料是否能够支持目标等级。'}</div>
              <section className="evidence-section">
                <h4>申请证据</h4>
                {evidence.length === 0 ? (
                  <p className="evidence-empty">申请人暂未提交结构化材料，可通过「退回补充」要求其补充。</p>
                ) : evidence.map((entry) => (
                  <div className="evidence-entry" key={`${entry.type}-${entry.title}`}>
                    <span>{entry.type || '证据'}</span>
                    <div><b>{entry.title}</b>{entry.detail ? <small>{entry.detail}</small> : null}</div>
                  </div>
                ))}
              </section>
              <section className="anchor-section">
                <h4>L{activeItem.targetLevel} 行为锚点</h4>
                <p style={{whiteSpace:'pre-wrap'}}>{anchor}</p>
              </section>
              <section className="review-comment">
                <h4>审批意见</h4>
                <textarea
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="通过可简要说明判断依据；退回或驳回时必须填写原因。"
                />
              </section>
              {activeItem.dueState === 'overdue' && (
                <div className="overdue-note" role="alert">
                  <b>已超过处理期限（{activeItem.due}）</b>
                  <span>按流程该申请不可再审批，已提醒申请人重新提交；如需特殊处理请通过线下流程确认。</span>
                </div>
              )}
              <div className="detail-actions">
                <button className="ghost reject-button" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('reject')}>
                  驳回申请
                </button>
                <button className="ghost" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('return')}>退回补充</button>
                <button className="primary approve-button" disabled={activeItem.dueState === 'overdue'} onClick={() => handleAction('approve')}>
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
