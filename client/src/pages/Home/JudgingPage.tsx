import { useCallback, useEffect, useState } from 'react';
import { judgingApi } from '@/api';
import type {
  JudgingCandidate,
  JudgingGapDetail,
  JudgingLevelView,
  JudgingOverview,
  ReadinessState,
} from '@shared/api.interface';
import { useUI } from './ui-context';

const STATE_META: Record<ReadinessState, { label: string; color: string; bg: string }> = {
  certified: { label: '已持有', color: '#1d4ed8', bg: '#eef4ff' },
  ready: { label: '可申请', color: '#127a52', bg: '#eafaf1' },
  preparing: { label: '准备中', color: '#b25b00', bg: '#fff6e8' },
  blocked: { label: '不可申请', color: '#b42318', bg: '#fdeceb' },
};

function defaultSelection(overview: JudgingOverview): { track: string; level: string } | null {
  const preferred = overview.tracks.find(track => track.slug === overview.preferredTrack) ?? overview.tracks[0];
  if (!preferred) return null;
  // 默认聚焦「离申请最近」的层级：先看可申请的，再看达标数最多的准备中层级
  const ready = preferred.levels.find(level => level.state === 'ready');
  if (ready) return { track: preferred.slug, level: ready.levelCode };
  const preparing = [...preferred.levels]
    .filter(level => level.state === 'preparing')
    .sort((a, b) => b.met - a.met || a.levelOrder - b.levelOrder)[0];
  const target = preparing ?? preferred.levels[0];
  return { track: preferred.slug, level: target.levelCode };
}

const JudgingPage = () => {
  const { showToast } = useUI();
  const [overview, setOverview] = useState<JudgingOverview | null>(null);
  const [candidates, setCandidates] = useState<JudgingCandidate[]>([]);
  const [selected, setSelected] = useState<{ track: string; level: string } | null>(null);
  const [gap, setGap] = useState<JudgingGapDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOverview, nextCandidates] = await Promise.all([judgingApi.getOverview(), judgingApi.getCandidates()]);
      setOverview(nextOverview);
      setCandidates(nextCandidates.items);
      setSelected(current => current ?? defaultSelection(nextOverview));
      setError(null);
    } catch {
      setError('判定数据加载失败，请确认服务端已启动并已登录');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    judgingApi
      .getGap(selected.track, selected.level)
      .then(detail => { if (!cancelled) setGap(detail); })
      .catch(() => { if (!cancelled) setGap(null); });
    return () => { cancelled = true; };
  }, [selected]);

  const dismiss = async (key: string) => {
    try {
      await judgingApi.dismissCandidate(key);
      setCandidates(current => current.filter(item => item.key !== key));
      showToast('已忽略，7 天内不再提醒');
    } catch {
      showToast('忽略失败，请稍后重试');
    }
  };

  if (error) {
    return (
      <section className="panel" style={{ padding: '32px 28px' }}>
        <h3>资格自查暂不可用</h3>
        <p style={{ color: '#667085', marginTop: 8 }}>{error}</p>
        <button className="primary" style={{ marginTop: 16 }} onClick={() => { void load(); }}>重新加载</button>
      </section>
    );
  }

  if (loading && !overview) {
    return <section className="panel" style={{ padding: '32px 28px' }}><p style={{ color: '#667085' }}>正在计算资格与 Gap…</p></section>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="panel" style={{ padding: '14px 24px' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#475467' }}>
          当前职称：<b>{overview?.currentTitle ? `${overview.currentTitle.levelCode} ${overview.currentTitle.levelName}` : '尚未认证'}</b>
          {overview?.preferredTrack && <span style={{ marginLeft: 16 }}>所属序列：{overview.preferredTrack}</span>}
          <span style={{ marginLeft: 16, color: '#98a2b3' }}>判定实时计算自有效认证，标准版本 v2026-q4</span>
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
        {(overview?.tracks ?? []).map(track => (
          <section className="panel" key={track.slug} style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{track.name}</h3>
              <span style={{ color: '#98a2b3', fontSize: 12 }}>{track.slug}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {track.levels.map(level => {
                const meta = STATE_META[level.state];
                const active = selected?.track === track.slug && selected.level === level.levelCode;
                return (
                  <button
                    key={level.levelCode}
                    onClick={() => setSelected({ track: track.slug, level: level.levelCode })}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${active ? '#2f6fed' : '#e4e7ec'}`,
                      background: active ? '#f5f8ff' : '#fff',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {level.levelCode} · {level.levelName}
                        {level.isCrossLevel && (
                          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: '#b25b00' }}>跨级</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 999, background: '#eef0f4', overflow: 'hidden' }}>
                        <div style={{ width: `${level.total ? (level.met / level.total) * 100 : 0}%`, height: '100%', background: meta.color }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#667085' }}>{level.met}/{level.total}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {gap && <GapDetailPanel detail={gap} />}

      <section className="panel" style={{ padding: '20px 24px' }}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div><h3>候选提醒</h3><p>已达标或只差一项的职称目标，按序列去重后展示</p></div>
        </div>
        {candidates.length === 0
          ? <p style={{ color: '#667085' }}>暂无候选，继续积累认证后会自动出现。</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {candidates.map(item => (
                <div key={item.key} style={{ border: '1px solid #e4e7ec', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13 }}>{item.title}</b>
                    <span style={{ fontSize: 11, color: '#667085' }}>{item.trackSlug}/{item.levelCode}</span>
                  </div>
                  <p style={{ margin: '6px 0 10px', color: '#667085', fontSize: 12 }}>{item.description}</p>
                  <button className="ghost" style={{ fontSize: 12 }} onClick={() => { void dismiss(item.key); }}>忽略 7 天</button>
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
};

const GapDetailPanel = ({ detail }: { detail: JudgingGapDetail }) => {
  const meta = STATE_META[detail.state];
  // requirements 里只有子能力 slug；中文名从 gapItems 里拿，避免再发一次请求
  const competencyNamesBySlug = new Map(detail.gapItems.map(item => [item.skillSlug, item.competencyNames]));
  const shorten = (names: string[]) => names.length > 3 ? [...names.slice(0, 3), `等 ${names.length} 项`] : names;
  return (
    <section className="panel" style={{ padding: '20px 24px' }}>
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div>
          <h3>
            {detail.trackName} · {detail.levelCode} {detail.levelName}
          </h3>
          <p>
            达标 {detail.met}/{detail.total} 项
            <span style={{ marginLeft: 10, color: meta.color }}>{meta.label}</span>
            {detail.isCrossLevel && <span style={{ marginLeft: 10, color: '#b25b00' }}>跨级申请需追加独立专家复核</span>}
          </p>
        </div>
      </div>

      {detail.blockers.length > 0 && (
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, color: '#b42318', fontSize: 13 }}>
          {detail.blockers.map(blocker => (
            <li key={blocker.code}>
              {blocker.message}
              {blocker.until ? `（${blocker.until.slice(0, 10)} 解除）` : ''}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {detail.requirements.map(requirement => (
          <div
            key={requirement.skillSlug}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 12px', border: '1px solid #eef0f4', borderRadius: 10 }}
          >
            <div>
              <b style={{ fontSize: 13 }}>{requirement.skillName}</b>
              <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }}>
                {requirement.isRequired===false?'推荐技能（不影响资格）':'必需技能'} · 要求 L{requirement.requiredLevel} · 当前 L{requirement.currentLevel}
                {requirement.met
                  ? <span style={{ color: '#127a52', marginLeft: 8 }}>已达标</span>
                  : <span style={{ color: '#b25b00', marginLeft: 8 }}>差 {requirement.gapLevels} 级</span>}
                {(() => {
                  const names = competencyNamesBySlug.get(requirement.skillSlug)
                    ?? requirement.competencySlugs;
                  if (names.length === 0) return null;
                  return <span style={{ marginLeft: 8 }}>子能力：{shorten(names).join('、')}</span>;
                })()}
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#98a2b3', alignSelf: 'center' }}>{requirement.skillSlug}</span>
          </div>
        ))}
      </div>

      {detail.gapItems.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>补齐方向</h4>
          {detail.gapItems.map(item => (
            <div key={item.skillSlug} style={{ fontSize: 12, color: '#475467', marginBottom: 10 }}>
              <b>{item.skillName}</b>
              {item.competencyNames.length > 0 ? `：需在「${item.competencyNames.join('、')}」上补 ${item.gapLevels} 级` : `：需补 ${item.gapLevels} 级`}
              {item.resources.length > 0
                ? (
                  <div style={{ marginTop: 4, paddingLeft: 12, borderLeft: '2px solid #eef0f4' }}>
                    {item.resources.map(resource => (
                      <div key={resource.slug}>
                        {resource.title}
                        <span style={{ color: '#98a2b3' }}>（{resource.kind}{resource.estimatedEffort ? ` · ${resource.estimatedEffort}` : ''}）</span>
                      </div>
                    ))}
                  </div>
                )
                : <div style={{ color: '#98a2b3' }}>暂无匹配的学习资源，可与主管讨论实践机会</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default JudgingPage;
