import { growthApi } from '@/api';
import type { SkillGrowthEvent } from '@shared/api.interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCertifications } from './certification-context';
import type { CertificationItem } from './certification-context';
import EvidenceGalaxy from './EvidenceGalaxy';
import CertificationList from './CertificationList';
import CertificationDetail from './CertificationDetail';
import SelfApplicationDrawer from './SelfApplicationDrawer';

const EvidencePage = () => {
  const [history, setHistory] = useState<SkillGrowthEvent[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const recentHistory = useMemo(() => [...history].sort((a, b) => {
    const time = (row: SkillGrowthEvent) => {
      if (row.occurredAt) return new Date(row.occurredAt).getTime() || 0;
      const [year, month = 1, day = 1] = row.date.split(/[.\-/]/).map(Number);
      return new Date(year, month - 1, day).getTime() || 0;
    };
    return time(b) - time(a);
  }), [history]);
  useEffect(() => {
    let active = true;
    growthApi.getGrowthEvents('all').then(result => { if (active) setHistory(result.events); }).catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, []);
  const {
    certifications,
    error,
    selfApplicationOpen,
    setSelfApplication,
    selectedCertificationId,
    selectCertification,
    certificationFilter,
    setCertificationFilter,
  } = useCertifications();
  const [selfSkillPreset, setSelfSkillPreset] = useState<string>('');
  const layoutRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(() => certifications.filter((item: CertificationItem) => {
    if (certificationFilter === 'all') return true;
    if (certificationFilter === 'approved') return item.status === 'approved';
    if (certificationFilter === 'review') return item.status === 'review' || item.status === 'review_submitted';
    return item.source === certificationFilter;
  }), [certifications, certificationFilter]);

  const activeItem: CertificationItem | undefined =
    visibleItems.find((item: CertificationItem) => item.id === selectedCertificationId) ?? visibleItems[0];

  const counts = useMemo(() => {
    const ready = certifications.filter((item: CertificationItem) => item.status === 'ready').length;
    const pending = certifications.filter((item: CertificationItem) => item.status === 'pending').length;
    const review = certifications.filter((item: CertificationItem) =>
      item.status === 'review' || item.status === 'review_submitted').length;
    const returned = certifications.filter((item: CertificationItem) => item.status === 'returned').length;
    const approved = new Set(certifications.filter((item: CertificationItem) => item.status === 'approved')
      .map((item: CertificationItem) => item.skillSlug ?? item.title)).size;
    return { ready, pending, review, returned, approved };
  }, [certifications]);

  const scrollToLayout = () => {
    layoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleGalaxyOpenDetail = (id: string) => {
    selectCertification(id);
    setCertificationFilter('all');
    scrollToLayout();
  };

  const handleGalaxyApply = (skillTitle: string | null) => {
    setSelfSkillPreset(skillTitle ?? '');
    setSelfApplication(true);
  };

  const handleReviewShortcut = () => {
    setCertificationFilter('review');
    scrollToLayout();
  };

  return (
    <section className="page active" id="evidence">
      {error ? <p style={{ color: '#d95850', margin: '0 0 8px' }}>{error}</p> : null}
      <EvidenceGalaxy
        certifications={certifications}
        onOpenDetail={handleGalaxyOpenDetail}
        onApply={handleGalaxyApply}
      />

      <section className="cert-flow" aria-label="技能点亮流程">
        <div className="flow-step done"><span>1</span><div><b>产生技能信号</b><small>员工提交或 AI 识别</small></div></div>
        <i>→</i>
        <div className="flow-step current"><span>2</span><div><b>员工确认申请</b><small>选择等级并核对证据</small></div></div>
        <i>→</i>
        <div className="flow-step"><span>3</span><div><b>管理者或 HR 审批</b><small>通过、退回补充或驳回</small></div></div>
        <i>→</i>
        <div className="flow-step"><span>4</span><div><b>正式点亮</b><small>记录等级、来源与有效期</small></div></div>
      </section>

      <section className="lifecycle-notice" aria-label="技能等级复核说明">
        <span className="lifecycle-notice-icon">↻</span>
        <div><b>技能等级会定期复核</b><p>长期无相关工作或产出只会触发复核，不会自动降级。你可以补充近期成果、说明暂无实践机会，并查看最终判断依据。</p></div>
        <button onClick={handleReviewShortcut}>查看 {counts.review} 项待复核</button>
      </section>

      <SelfApplicationDrawer open={selfApplicationOpen} skillPreset={selfSkillPreset} />

      <div className="cert-summary has-five" aria-label="认证状态汇总">
        <article><span>待我确认</span><strong id="ready-count">{counts.ready}</strong><small>AI 建议需由你发起申请</small></article>
        <article><span>审批中</span><strong id="pending-count">{counts.pending}</strong><small>管理者或 HR 正在处理</small></article>
        <article className="review-summary"><span>待复核</span><strong id="review-count">{counts.review}</strong><small>当前等级仍然有效</small></article>
        <article><span>待补充</span><strong id="returned-count">{counts.returned}</strong><small>补齐证据后可再次提交</small></article>
        <article><span>已点亮技能</span><strong id="approved-count">{counts.approved}</strong><small>含入职以来有效历史认证</small></article>
      </div>

      <div className="certification-layout" ref={layoutRef}>
        <CertificationList
          items={visibleItems}
          selectedId={activeItem?.id ?? null}
          onSelect={(id: string) => selectCertification(id)}
        />
        <CertificationDetail item={activeItem} />
      </div>

      <section className="panel certification-history">
        <div className="section-head"><div><h3>最近等级变更</h3><p>点亮、升级、维持与降级均保留完整记录</p></div><button className="ghost">查看全部记录</button></div>
        <div className="history-row history-head"><span>技能</span><span>等级变化</span><span>主要依据</span><span>审批人</span><span>生效时间</span></div>
        {historyError ? <p>等级变更记录加载失败，请刷新重试。</p> : !history.length && <p>暂无等级变更记录。</p>}
        {recentHistory.map((row, index) => (
          <div className="history-row" key={`${row.title}-${row.date}-${index}`}>
            <span><b>{row.title}</b><small>{row.category}</small></span>
            <span className={undefined}>{row.level}</span>
            <span>{row.evidence}</span>
            <span>{row.approver}</span>
            <span>{row.date}</span>
          </div>
        ))}
      </section>
    </section>
  );
};

export default EvidencePage;
