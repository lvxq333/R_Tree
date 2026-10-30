import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Criticality,
  KeyPositionCatalog,
  KeyPositionRecord,
  SuccessionCandidateView,
  SuccessionOverview,
  SuccessionPositionView,
} from '@shared/api.interface';
import { successionApi } from '@/api';
import type { SuccessionQuery } from '@/api/succession';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';
import './succession.css';

const EMPTY_FILTERS: SuccessionQuery = { department: '', track: '', level: '' };
const BUCKET_PAGE = 5;
const EMPTY_DATA: SuccessionOverview = {
  positions: [],
  summary: { keyPositions: 0, healthy: 0, attention: 0, risk: 0, unrated: 0, readyCount: 0, developingCount: 0, covered: 0 },
  filters: { departments: [], tracks: [], levels: [] },
  updatedAt: '',
};
const CRITICALITY_OPTIONS: { value: Criticality; label: string; hint: string }[] = [
  { value: 'core', label: '核心', hint: '中断会直接影响交付' },
  { value: 'key', label: '关键', hint: '影响单条业务线' },
  { value: 'normal', label: '一般', hint: '需关注但可替代' },
];
const HEALTH_CLASS: Record<SuccessionPositionView['health'], string> = {
  healthy: 'healthy', attention: 'watch', risk: 'risk', unrated: 'unrated',
};
const STATE_CLASS: Record<SuccessionCandidateView['state'], string> = { ready: '', developing: 'develop', watch: 'gap' };

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
  const message = data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('；');
  return fallback;
}

const keyOf = (trackSlug: string, levelCode: string) => `${trackSlug}:${levelCode}`;

function CandidateCard({
  candidate,
  expanded,
  onToggle,
}: {
  candidate: SuccessionCandidateView;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { openProfile } = useUI();
  return (
    <div className="succession-candidate">
      <i className={`talent-avatar ${candidate.tone}`}>{candidate.avatar}</i>
      <div className="succession-candidate-main">
        <div className="succession-candidate-head">
          <button type="button" className="succession-person-link" onClick={() => openProfile(candidate.employeeId)}>
            {candidate.name}
          </button>
          <small>{candidate.grade} · {candidate.trackName} · {candidate.department}</small>
        </div>
        <div className="succession-meter" title={`逐项达标 ${candidate.met}/${candidate.total} 项；加权接近度 ${candidate.weighted}%`}>
          <i><em style={{ width: `${candidate.weighted}%` }} /></i>
          <span>{candidate.met}/{candidate.total} 项达标 · 接近度 {candidate.weighted}%</span>
        </div>
        {expanded ? (
          <ul className="succession-gap-list">
            {candidate.gaps.length ? candidate.gaps.map(gap => (
              <li key={gap.skillName}>
                <b>{gap.skillName}</b>
                <span>{gap.current ? `L${gap.current}` : '无有效认证'} → L{gap.required}</span>
                <em>{gap.current ? `差 ${Math.max(0, gap.required - gap.current)} 级` : '未建立认证'}</em>
              </li>
            )) : <li className="met">必备技能全部达标，可直接进入任命与交接流程</li>}
          </ul>
        ) : null}
      </div>
      <div className="succession-candidate-side">
        <span className={`readiness-state ${STATE_CLASS[candidate.state]}`}>{candidate.stateText}</span>
        <button type="button" className="succession-gap-toggle" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? '收起缺口' : '缺口详情'}
        </button>
      </div>
    </div>
  );
}

export default function SuccessionPage() {
  const { showToast, openProfile } = useUI();
  const [filters, setFilters] = useState<SuccessionQuery>(EMPTY_FILTERS);
  const [riskOnly, setRiskOnly] = useState(false);
  const [data, setData] = useState<SuccessionOverview>(EMPTY_DATA);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [bucketLimit, setBucketLimit] = useState(BUCKET_PAGE);
  const [catalog, setCatalog] = useState<KeyPositionCatalog | null>(null);
  const [draft, setDraft] = useState<Record<string, KeyPositionRecord>>({});
  const [maintainOpen, setMaintainOpen] = useState(false);
  const [maintainSearch, setMaintainSearch] = useState('');
  const [onlyStaffed, setOnlyStaffed] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adviceFor, setAdviceFor] = useState<SuccessionPositionView | null>(null);
  const [adviceCandidateId, setAdviceCandidateId] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(async (query: SuccessionQuery) => {
    const id = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const next = await successionApi.getSuccession(query);
      if (id !== requestRef.current) return;
      setData(next);
      setExpandedCandidate(null);
    } catch (cause) {
      if (id !== requestRef.current) return;
      logger.error('加载梯队与继任数据失败', cause);
      setError(errorMessage(cause, '梯队数据读取失败，请重试。'));
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
    return () => { requestRef.current += 1; };
  }, [filters, load]);

  const visiblePositions = riskOnly
    ? data.positions.filter(item => item.health === 'risk')
    : data.positions;
  const active: SuccessionPositionView | undefined =
    visiblePositions.find(item => item.slug === selected)
    || data.positions.find(item => item.slug === selected)
    || visiblePositions[0];

  useEffect(() => {
    if (!visiblePositions.length) { setSelected(''); return; }
    if (visiblePositions.some(item => item.slug === selected)) return;
    // 默认打开有候选人的岗位，避免首屏落在两个空分层上。
    const informative = visiblePositions.find(item => item.ready.length || item.developing.length);
    setSelected((informative ?? visiblePositions[0]).slug);
  }, [visiblePositions, selected]);

  useEffect(() => { setBucketLimit(BUCKET_PAGE); }, [active?.slug]);

  const openMaintain = async () => {
    setMaintainOpen(true);
    setMaintainSearch('');
    setCatalogLoading(true);
    setError('');
    try {
      const next = await successionApi.getKeyPositionCatalog();
      setCatalog(next);
      const nextDraft: Record<string, KeyPositionRecord> = {};
      for (const track of next.tracks) {
        for (const level of track.levels) {
          if (!level.selected) continue;
          nextDraft[keyOf(track.slug, level.code)] = {
            trackSlug: track.slug, levelCode: level.code,
            criticality: level.criticality, reason: level.reason, impact: level.impact,
          };
        }
      }
      setDraft(nextDraft);
    } catch (cause) {
      logger.error('加载关键岗位名录失败', cause);
      setError(errorMessage(cause, '关键岗位名录读取失败，请重试。'));
      setMaintainOpen(false);
    } finally {
      setCatalogLoading(false);
    }
  };

  const saveMaintain = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await successionApi.saveKeyPositions({ positions: Object.values(draft) });
      showToast(`关键岗位名录已保存，共 ${Object.keys(draft).length} 个岗位`);
      setMaintainOpen(false);
      await load(filters);
    } catch (cause) {
      logger.error('保存关键岗位名录失败', cause);
      showToast(errorMessage(cause, '保存失败，请重试。'));
    } finally {
      setSaving(false);
    }
  };

  const exportWorkbook = useCallback(async (query: SuccessionQuery) => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await successionApi.exportSuccession(query);
      const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `梯队盘点_${stamp}.xlsx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      showToast('梯队盘点已导出，含岗位、现任者、候选与缺口明细。');
    } catch (cause) {
      logger.error('导出梯队盘点失败', cause);
      showToast(errorMessage(cause, '导出失败，请重试。'));
    } finally {
      setExporting(false);
    }
  }, [exporting, showToast]);

  useEffect(() => {
    const handler = () => { void exportWorkbook(filters); };
    window.addEventListener('succession:export', handler);
    return () => window.removeEventListener('succession:export', handler);
  }, [exportWorkbook, filters]);

  useEffect(() => {
    if (!maintainOpen && !adviceFor) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (saving) return;
      setMaintainOpen(false);
      setAdviceFor(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maintainOpen, adviceFor, saving]);

  const adviceCandidates = adviceFor
    ? [...adviceFor.ready, ...adviceFor.developing, ...adviceFor.watch]
    : [];
  const adviceCandidate = adviceCandidates.find(item => item.employeeId === adviceCandidateId) ?? adviceCandidates[0];
  const selectedCount = Object.keys(draft).length;
  const totalKeyPositions = data.summary.keyPositions;
  const isEmpty = !loading && totalKeyPositions === 0 && !filters.department && !filters.track && !filters.level;
  const maintainTracks = (catalog?.tracks ?? [])
    .map(track => ({ track, holders: track.levels.reduce((sum, level) => sum + level.holders, 0) }))
    .sort((left, right) => right.holders - left.holders || left.track.name.localeCompare(right.track.name, 'zh-Hans-CN'))
    .filter(({ track, holders }) => (!onlyStaffed || holders > 0 || track.levels.some(level => draft[keyOf(track.slug, level.code)]))
      && (!maintainSearch.trim() || track.name.includes(maintainSearch.trim())
        || track.levels.some(level => level.name.includes(maintainSearch.trim()))));
  const hiddenTracks = (catalog?.tracks.length ?? 0) - maintainTracks.length;

  const renderBucket = (
    position: SuccessionPositionView,
    title: string,
    items: SuccessionCandidateView[],
    note: string,
    total = items.length,
  ) => (
    <section className="pipeline-section">
      <div className="pipeline-title">
        <b>{title}</b>
        <span>{total} 人</span>
      </div>
      <p className="succession-bucket-note">{note}</p>
      {items.length ? items.map(candidate => (
        <CandidateCard
          key={`${position.slug}-${candidate.employeeId}`}
          candidate={candidate}
          expanded={expandedCandidate === `${position.slug}-${candidate.employeeId}`}
          onToggle={() => setExpandedCandidate(current =>
            current === `${position.slug}-${candidate.employeeId}` ? null : `${position.slug}-${candidate.employeeId}`)}
        />
      )) : (
        <div className="successor-card succession-empty-card">
          <i className="talent-avatar amber">!</i>
          <div>
            <b>该分层暂无候选人</b>
            <small>候选池按「职级低于目标岗位或同职级跨序列」筛选，共 {position.poolSize} 人参与比对</small>
          </div>
          <span className="readiness-state gap">空</span>
        </div>
      )}
      {total > items.length ? (
        <button type="button" className="succession-more" onClick={() => setBucketLimit(limit => limit + BUCKET_PAGE)}>
          显示更多（已显示 {items.length}/{total}）
        </button>
      ) : null}
    </section>
  );

  return (
    <section className="page active" id="succession" aria-busy={loading}>
      <section className="succession-intro">
        <div>
          <h2>关键岗位梯队盘点</h2>
          <p>以岗位必备技能与有效期内的认证逐项比对，判断谁能接任、谁需要培养。</p>
        </div>
        <div className="succession-filters">
          <label>
            <span>部门</span>
            <select aria-label="按部门筛选" value={filters.department}
              onChange={event => setFilters({ ...filters, department: event.target.value })}>
              <option value="">全部部门</option>
              {data.filters.departments.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>序列</span>
            <select aria-label="按序列筛选" value={filters.track}
              onChange={event => setFilters({ ...filters, track: event.target.value })}>
              <option value="">全部序列</option>
              {data.filters.tracks.map(track => <option key={track.slug} value={track.slug}>{track.name}</option>)}
            </select>
          </label>
          <label>
            <span>职级</span>
            <select aria-label="按职级筛选" value={filters.level}
              onChange={event => setFilters({ ...filters, level: event.target.value })}>
              <option value="">全部职级</option>
              {data.filters.levels.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="button" className="succession-maintain-trigger" onClick={() => void openMaintain()}>
            维护关键岗位名录
          </button>
        </div>
      </section>

      {error && <div className="succession-alert" role="alert">{error} <button type="button" onClick={() => void load(filters)}>重试</button></div>}

      <div className="succession-metrics">
        <article>
          <span>关键岗位</span>
          <strong>{loading ? '…' : totalKeyPositions}</strong>
          <small>{filters.department ? '该部门内有人任职的关键岗位' : '由 HR 指定的盘点对象'}</small>
        </article>
        <article>
          <span>可立即接任</span>
          <strong className={data.summary.readyCount ? 'positive' : undefined}>{loading ? '…' : data.summary.readyCount}</strong>
          <small>覆盖 {loading ? '…' : data.summary.covered} 个岗位 · 人次</small>
        </article>
        <article>
          <span>高风险岗位</span>
          <strong className="risk-number">{loading ? '…' : data.summary.risk}</strong>
          <small>{data.summary.unrated ? `另有 ${data.summary.unrated} 个岗位待配置标准` : '空缺或无达标候选人'}</small>
        </article>
        <article>
          <span>6–12 个月可培养</span>
          <strong>{loading ? '…' : data.summary.developingCount}</strong>
          <small>{data.summary.attention} 个岗位有半数达标候选</small>
        </article>
      </div>

      {isEmpty ? (
        <section className="panel succession-empty-panel">
          <b>还没有指定关键岗位</b>
          <p>梯队盘点先要有一个「盘点对象」。请从已配置技能标准的岗位方向中选出关键岗位，系统会按在职员工的真实认证计算现任者与继任准备度。</p>
          <button type="button" className="succession-primary" onClick={() => void openMaintain()}>去维护关键岗位名录</button>
        </section>
      ) : (
        <div className="succession-layout">
          <section className="panel succession-roles">
            <div className="succession-section-head">
              <div>
                <h3>岗位梯队健康度</h3>
                <p>{filters.department
                  ? `${filters.department} 内有人任职的关键岗位；候选人同样取自该部门`
                  : '按风险优先排序，点击岗位查看候选梯队与缺口'}</p>
              </div>
              <button
                type="button"
                id="succession-view-toggle"
                className={riskOnly ? 'active' : undefined}
                onClick={() => setRiskOnly(value => !value)}
              >
                {riskOnly ? '查看全部岗位' : '只看风险岗位'}
              </button>
            </div>
            <div className="succession-table-head">
              <span>关键岗位</span>
              <span>现任者</span>
              <span>立即接任</span>
              <span>6–12 个月</span>
              <span>健康度</span>
            </div>
            <div id="succession-role-list">
              {loading ? (
                <div className="empty-candidates"><b>正在计算梯队数据…</b><p>按有效认证与岗位标准实时比对。</p></div>
              ) : visiblePositions.length ? visiblePositions.map(item => (
                <button
                  type="button"
                  key={item.slug}
                  className={`succession-role-row ${item.slug === active?.slug ? 'selected' : ''}`}
                  onClick={() => { setSelected(item.slug); setExpandedCandidate(null); }}
                >
                  <span>
                    <b>{item.title}</b>
                    <small>{item.trackName} · {item.criticalityText}</small>
                  </span>
                  <span>
                    <b>{item.incumbentLabel}</b>
                    <small>{item.incumbentMeta}</small>
                  </span>
                  <span className="count-cell">{item.ready.length}</span>
                  <span className="count-cell">{item.developing.length}</span>
                  <span><i className={`health-label ${HEALTH_CLASS[item.health]}`}>{item.healthText}</i></span>
                </button>
              )) : (
                <div className="empty-candidates">
                  <b>{riskOnly ? '当前没有高风险岗位' : '当前筛选条件下没有关键岗位'}</b>
                  <p>{riskOnly ? '所有关键岗位都已有达标候选或处于健康状态。' : '可调整部门、序列或职级筛选，或维护关键岗位名录。'}</p>
                </div>
              )}
            </div>
          </section>

          <aside className="panel succession-detail" id="succession-detail" aria-live="polite">
            {active ? (
              <>
                <div className="succession-detail-top">
                  <span>岗位继任详情 · {active.levelCode}</span>
                  <h3>{active.title}</h3>
                  <p>{active.trackName} · {active.criticalityText}岗位{active.reason ? ` · ${active.reason}` : ''}</p>
                  <div className="succession-requirement-line">
                    {active.requirements.length ? active.requirements.map(requirement => (
                      <span key={requirement.skillName}>
                        {requirement.skillName} L{requirement.requiredLevel}
                        <em>达标 {requirement.metCount} 人</em>
                      </span>
                    )) : <span className="missing">该职级尚未配置必备技能，无法计算准备度</span>}
                  </div>
                  <div className="incumbent-strip">
                    <i className="talent-avatar blue">{active.vacancy ? '—' : active.incumbents[0].avatar}</i>
                    <span>
                      <b>{active.incumbentLabel}</b>
                      <small>现任者 · {active.incumbentMeta}</small>
                    </span>
                    <span>{active.healthText}</span>
                  </div>
                  {active.incumbents.length > 1 ? (
                    <div className="succession-incumbent-list">
                      {active.incumbents.slice(0, 10).map(person => (
                        <button type="button" key={person.employeeId} onClick={() => openProfile(person.employeeId)}>
                          <i className={`talent-avatar ${person.tone}`}>{person.avatar}</i>
                          {person.name}
                        </button>
                      ))}
                      {active.incumbents.length > 10 ? <span>另有 {active.incumbents.length - 10} 人在任</span> : null}
                    </div>
                  ) : null}
                </div>
                {renderBucket(active, '可立即接任', active.ready.slice(0, bucketLimit), '目标岗位必备技能已全部达标（有效期内认证）', active.ready.length)}
                {renderBucket(active, '6–12 个月可培养', active.developing.slice(0, bucketLimit), '已达标半数以上，缺口可在两个考核周期内补齐', active.developing.length)}
                {active.watch.length ? renderBucket(active, '待观察（最接近）', active.watch, '方向相关但差距较大，可作为长期储备') : null}
                <div className="succession-actions">
                  <div className="succession-risk-note">{active.riskNote}</div>
                  <button
                    type="button"
                    disabled={!active.ready.length && !active.developing.length && !active.watch.length}
                    onClick={() => {
                      setAdviceFor(active);
                      setAdviceCandidateId((active.ready[0] ?? active.developing[0] ?? active.watch[0])?.employeeId ?? '');
                    }}
                  >
                    查看继任培养建议
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-candidates"><b>选择左侧岗位查看详情</b></div>
            )}
          </aside>
        </div>
      )}

      {maintainOpen && (
        <div className="risk-modal-mask" onClick={event => { if (event.target === event.currentTarget && !saving) setMaintainOpen(false); }}>
          <div className="succession-maintain-modal" role="dialog" aria-modal="true" aria-label="维护关键岗位名录">
            <div className="succession-maintain-head">
              <div>
                <h3>维护关键岗位名录</h3>
                <p>勾选需要纳入梯队盘点的岗位（序列 + 职级）。盘点只统计在职员工的有效认证，不会写入任何评价结论。</p>
              </div>
              <button type="button" aria-label="关闭" disabled={saving} onClick={() => setMaintainOpen(false)}>✕</button>
            </div>
            <div className="succession-maintain-toolbar">
              <input
                aria-label="搜索岗位"
                placeholder="搜索序列或职级名称"
                value={maintainSearch}
                onChange={event => setMaintainSearch(event.target.value)}
              />
              <label className="succession-maintain-only">
                <input type="checkbox" checked={onlyStaffed} onChange={() => setOnlyStaffed(value => !value)} />
                只看有在职员工的序列
              </label>
              <span>已选 <b>{selectedCount}</b> 个岗位 · 在任人数来自当前在职员工</span>
            </div>
            <div className="succession-maintain-body">
              {catalogLoading ? <p className="succession-maintain-empty">正在读取岗位标准…</p> : maintainTracks
                .map(({ track }) => (
                  <section className="succession-maintain-track" key={track.slug}>
                    <header>
                      <b>{track.name}</b>
                      <small>{track.family} 序列 · {track.levels.length} 个职级</small>
                    </header>
                    <div className="succession-maintain-levels">
                      {track.levels
                        .filter(level => !maintainSearch.trim() || track.name.includes(maintainSearch.trim()) || level.name.includes(maintainSearch.trim()))
                        .map(level => {
                          const key = keyOf(track.slug, level.code);
                          const record = draft[key];
                          return (
                            <div className={`succession-maintain-level ${record ? 'checked' : ''}`} key={key}>
                              <label className="succession-level-check">
                                <input
                                  type="checkbox"
                                  checked={Boolean(record)}
                                  onChange={() => setDraft(current => {
                                    const next = { ...current };
                                    if (next[key]) delete next[key];
                                    else next[key] = { trackSlug: track.slug, levelCode: level.code, criticality: 'key', reason: '', impact: '' };
                                    return next;
                                  })}
                                />
                                <span>
                                  <b>{level.name}</b>
                                  <small>{level.code} · 在任 {level.holders} 人</small>
                                </span>
                              </label>
                              {record ? (
                                <div className="succession-level-detail">
                                  <label>
                                    关键性
                                    <select
                                      aria-label={`${level.name} 关键性`}
                                      value={record.criticality}
                                      onChange={event => setDraft(current => ({
                                        ...current,
                                        [key]: { ...record, criticality: event.target.value as Criticality },
                                      }))}
                                    >
                                      {CRITICALITY_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label} · {option.hint}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    关键理由
                                    <input
                                      aria-label={`${level.name} 关键理由`}
                                      maxLength={255}
                                      placeholder="例如：核心链路唯一架构负责人"
                                      value={record.reason}
                                      onChange={event => setDraft(current => ({
                                        ...current,
                                        [key]: { ...record, reason: event.target.value },
                                      }))}
                                    />
                                  </label>
                                  <label>
                                    影响范围
                                    <input
                                      aria-label={`${level.name} 影响范围`}
                                      maxLength={255}
                                      placeholder="例如：影响 3 个业务线交付"
                                      value={record.impact}
                                      onChange={event => setDraft(current => ({
                                        ...current,
                                        [key]: { ...record, impact: event.target.value },
                                      }))}
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </section>
                ))}
              {!catalogLoading && catalog && !catalog.tracks.some(track => track.levels.some(level => level.code)) && (
                <p className="succession-maintain-empty">当前标准版本还没有可用的职级，请先在岗位管理中发布标准。</p>
              )}
              {!catalogLoading && hiddenTracks > 0 && (
                <p className="succession-maintain-empty">
                  另有 {hiddenTracks} 个序列当前没有在职员工或其岗位未被指定为关键岗位，已折叠。
                  <button type="button" onClick={() => setOnlyStaffed(false)}>显示全部序列</button>
                </p>
              )}
            </div>
            <div className="succession-maintain-footer">
              <span>名录只决定盘点对象；岗位风险与候选均由实时数据计算。</span>
              <div>
                <button type="button" disabled={saving} onClick={() => setMaintainOpen(false)}>取消</button>
                <button type="button" className="succession-primary" disabled={saving || catalogLoading} onClick={() => void saveMaintain()}>
                  {saving ? '保存中…' : `保存名录（${selectedCount}）`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {adviceFor && adviceCandidate && (
        <div className="development-modal" onClick={event => { if (event.target === event.currentTarget) setAdviceFor(null); }}>
          <div className="development-card succession-advice-card">
            <h3>继任培养建议</h3>
            <p>
              {adviceFor.title} · 依据 {adviceFor.levelCode} 职级的 {adviceFor.requirements.length} 项必备技能与候选人有效期内的认证逐项比对。
            </p>
            {adviceCandidates.length > 1 && (
              <div className="succession-advice-picker">
                {adviceCandidates.map(candidate => (
                  <button
                    type="button"
                    key={candidate.employeeId}
                    className={candidate.employeeId === adviceCandidate.employeeId ? 'active' : ''}
                    onClick={() => setAdviceCandidateId(candidate.employeeId)}
                  >
                    {candidate.name}
                    <small>{candidate.met}/{candidate.total} 项</small>
                  </button>
                ))}
              </div>
            )}
            <div className="succession-advice-summary">
              <b>{adviceCandidate.name}</b>
              <span>{adviceCandidate.grade} · {adviceCandidate.trackName} · 缺口 {adviceCandidate.gaps.length} 项</span>
            </div>
            <div className="succession-advice-actions">
              {adviceCandidate.gaps.length ? adviceCandidate.gaps.map(gap => (
                <div className="development-step" key={gap.skillName}>
                  <span>L{gap.required}</span>
                  <div>
                    <b>{gap.skillName}：{gap.current ? `L${gap.current}` : '暂无认证'} → L{gap.required}</b>
                    <small>实践：承担一项需要该能力的真实任务并留证；辅导：现任者双周复盘；验证：提交证据走正式认证</small>
                  </div>
                </div>
              )) : (
                <div className="development-step">
                  <span>交接</span>
                  <div>
                    <b>必备技能已全部达标</b>
                    <small>可直接安排任命准备：交接清单、关键干系人对齐、三个月跟踪</small>
                  </div>
                </div>
              )}
            </div>
            <p className="succession-advice-note">
              这是按缺口生成的培养建议，尚未写入数据库。计划落地方式（联动候选人个人发展计划，或独立的继任计划表）待确认后再接入。
            </p>
            <div className="development-actions">
              <button type="button" onClick={() => setAdviceFor(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
