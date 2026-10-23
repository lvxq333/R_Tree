import type { CertificationItem, CertificationFilter } from './certification-context';
import { useCertifications } from './certification-context';

const CERT_FILTERS: { key: CertificationFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'approved', label: '已点亮' },
  { key: 'review', label: '待复核' },
  { key: 'manual', label: '主动申请' },
  { key: 'worklog', label: '日报 / 工时' },
  { key: 'performance', label: '绩效成果' },
];

function statusClass(status: string): string {
  if (status === 'pending') return 'pending';
  if (status === 'review' || status === 'review_submitted') return 'review';
  if (status === 'returned' || status === 'rejected') return 'returned';
  if (status === 'approved') return 'approved';
  return '';
}

function isReviewStatus(status: string): boolean {
  return status === 'review' || status === 'review_submitted';
}

function levelSummary(item: CertificationItem): string {
  if (item.status === 'approved') return `L${item.targetLevel} · 已点亮`;
  if (isReviewStatus(item.status)) return `当前 L${item.currentLevel} · 拟调整 L${item.targetLevel}`;
  return `L${item.currentLevel} → L${item.targetLevel}`;
}

function metaNote(item: CertificationItem): string {
  if (item.historical) return `生效于 ${item.approvedAt}`;
  if (item.status === 'approved') return '人工审批已通过';
  if (isReviewStatus(item.status)) return `复核截止 ${item.deadline}`;
  return `依据可信度 ${item.confidence}%`;
}

export interface CertificationListProps {
  items: CertificationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const CertificationList = ({ items, selectedId, onSelect }: CertificationListProps) => {
  const { certificationFilter, setCertificationFilter } = useCertifications();

  return (
    <section className="panel cert-inbox">
      <div className="section-head"><div><h3>全部技能</h3><p>当前事项与入职以来有效的历史技能认证</p></div></div>
      <div className="cert-filters" role="tablist" aria-label="按来源筛选">
        {CERT_FILTERS.map((filter) => (
          <button
            key={filter.key}
            className={certificationFilter === filter.key ? 'active' : ''}
            onClick={() => setCertificationFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div id="cert-list" className="cert-list">
        {items.length === 0 && <div className="cert-empty">当前筛选下没有技能记录</div>}
        {items.map((item: CertificationItem) => (
          <button
            key={item.id}
            className={`cert-item ${item.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <i className={`source-icon ${item.source}`}>{item.sourceShort}</i>
            <span>
              <b>{item.title}</b>
              <small>{item.sourceLabel} · {item.category}</small>
              <span className="item-meta"><span>{levelSummary(item)}</span><span>{metaNote(item)}</span></span>
            </span>
            <em className={`status-pill ${statusClass(item.status)}`}>{item.statusLabel}</em>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CertificationList;
