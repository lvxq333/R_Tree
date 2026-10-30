import { useEffect, useState, type JSX } from 'react';
import type { ApprovalItem, CertificationEvidence, CertificationItem } from '@shared/api.interface';
import { certificationApi } from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';
import { useCertifications } from './certification-context';
import SkillAssessmentPanel from './SkillAssessmentPanel';

function isReviewStatus(status: string): boolean {
  return status === 'review' || status === 'review_submitted';
}

export interface CertificationDetailProps {
  item: CertificationItem | undefined;
}

const CertificationDetail = ({ item }: CertificationDetailProps) => {
  const { decideCertification } = useCertifications();
  const { showToast } = useUI();
  // 本人提交的审批单与催办状态来自后端（含能否催办的真实原因），不使用前端模拟
  const [myApprovals, setMyApprovals] = useState<ApprovalItem[]>([]);
  const [reminding, setReminding] = useState(false);

  const reloadMyApprovals = async (): Promise<void> => {
    try {
      setMyApprovals(await certificationApi.listMyApprovals());
    } catch (error) {
      logger.error('获取我的申请失败', error);
    }
  };

  useEffect(() => {
    void reloadMyApprovals();
  }, []);

  const handleRemind = async (slug: string): Promise<void> => {
    if (reminding) return;
    setReminding(true);
    try {
      const result = await certificationApi.remindApproval(slug);
      showToast(`${result.deliveredTo}，已发起第 ${result.approval.reminder.count} 次催办。`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      showToast(message ?? '催办失败，请稍后重试。');
    } finally {
      setReminding(false);
      await reloadMyApprovals();
    }
  };

  if (!item) return <aside className="panel cert-detail" id="cert-detail" aria-live="polite" />;

  const isReview = isReviewStatus(item.status);

  let actions: JSX.Element;
  if (item.status === 'ready') {
    actions = (
      <>
        <span className="detail-note">提交后进入管理者或 HR 审批</span>
        <button className="ghost" onClick={() => decideCertification(item.id, 'dismiss')}>暂不申请</button>
        <button className="primary" onClick={() => decideCertification(item.id, 'submit')}>发起点亮申请</button>
      </>
    );
  } else if (item.status === 'review') {
    actions = (
      <>
        <span className="detail-note">复核完成前仍按当前 L3 参与计算</span>
        <button className="ghost" onClick={() => decideCertification(item.id, 'explain')}>说明暂无实践机会</button>
        <button className="primary" onClick={() => decideCertification(item.id, 'add-evidence')}>补充近期成果</button>
      </>
    );
  } else if (item.status === 'review_submitted') {
    actions = (
      <>
        <span className="detail-note">已补充说明，当前等级保持有效</span>
        <button className="ghost" disabled>等待复核</button>
      </>
    );
  } else if (item.status === 'returned') {
    actions = (
      <>
        <span className="detail-note">请按审核意见补充证明</span>
        <button className="primary" onClick={() => decideCertification(item.id, 'resubmit')}>补充并重新提交</button>
      </>
    );
  } else if (item.status === 'pending') {
    // 催办按钮只在本人发起的待审批申请上出现；能否催办与原因均由后端判定
    const linkedApproval = myApprovals.find(
      (entry: ApprovalItem) => entry.linkedId === item.id && entry.status === 'pending',
    );
    const reminder = linkedApproval?.reminder;
    const remindedNote = reminder && reminder.count > 0 ? ` · 已催办 ${reminder.count} 次` : '';
    actions = (
      <>
        <span className="detail-note">已提交，审批通过前不会修改正式等级{remindedNote}</span>
        {linkedApproval && (
          <button
            className="ghost remind-button"
            disabled={!reminder?.canRemind || reminding}
            title={reminder?.reason ?? '提醒审批人尽快处理'}
            onClick={() => { void handleRemind(linkedApproval.id); }}
          >
            {reminding ? '催办中…' : '催办提醒'}
          </button>
        )}
        <button className="ghost" disabled>等待审批</button>
      </>
    );
  } else {
    actions = <span className="detail-note">该技能等级已正式生效</span>;
  }

  return (
    <aside className="panel cert-detail" id="cert-detail" aria-live="polite">
      <div className="detail-titlebar">
        <div><h3>{item.title}</h3><p>{item.sourceLabel} · {item.category}</p></div>
        <strong className="level-change">{item.status === 'approved' ? `L${item.targetLevel} 已点亮` : `L${item.currentLevel} → L${item.targetLevel}`}</strong>
      </div>
      <div className={`source-explanation ${isReview ? 'review-explanation' : ''}`}>
        <b>{item.status === 'approved' ? '认证说明：' : isReview ? '为什么需要复核：' : '为什么推荐：'}</b>
        {item.explanation}
      </div>
      {isReview ? (
        <dl className="review-deadline">
          <div><dt>当前正式等级</dt><dd>L{item.currentLevel}，复核期间有效</dd></div>
          <div><dt>拟调整等级</dt><dd>L{item.targetLevel}</dd></div>
          <div><dt>复核截止</dt><dd>{item.deadline}</dd></div>
        </dl>
      ) : item.status === 'approved' ? null : item.source==='ai_validation' ? <p>隔离验证候选建议，不提供正式认证分数。</p> : (
        <div className="confidence-row">
          <span>依据完整度</span>
          <i><span style={{ width: `${item.confidence}%` }} /></i>
          <strong>{item.confidence}%</strong>
        </div>
      )}
      <section className="evidence-section">
        <h4>{item.historical ? '历史认证记录' : isReview ? '触发依据与最近记录' : item.status === 'approved' ? '已批准申请依据' : '本次申请依据'}</h4>
        {item.historical && <p>对象表记录了正式生效的技能等级；这条历史认证未关联原申请材料。</p>}
        {item.evidence.map((entry: CertificationEvidence) => (
          <div key={`${entry.type}-${entry.title}`} className="evidence-entry">
            <span>{entry.type}</span>
            <div><b>{entry.title}</b><small>{entry.detail}</small></div>
          </div>
        ))}
      </section>
      {isReview || item.anchor ? <section className="anchor-section">
        <h4>{isReview ? `当前 L${item.currentLevel} 行为锚点` : `本次申请采用的 L${item.targetLevel} 标准`}</h4>
        <p style={{whiteSpace:'pre-wrap'}}>{item.anchor}</p>
      </section> : null}
      {!isReview && item.skillSlug && !item.historical
        ? <SkillAssessmentPanel key={item.id} item={item}/> : null}
      <div className="detail-actions">{actions}</div>
    </aside>
  );
};

export default CertificationDetail;
