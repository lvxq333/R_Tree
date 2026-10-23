import { useEffect, useRef, useState } from 'react';
import type {
  EmployeeWideRow,
  ShortlistResponse,
  TalentCandidate,
  TalentCandidatesResponse,
} from '@shared/api.interface';
import { talentApi } from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';
import { useAuth } from './auth-context';
import { listWideEmployees } from '@/api/fact-center';
import TalentConditions from './TalentConditions';
import TalentCandidateList from './TalentCandidateList';
import ShortlistPanel from './ShortlistPanel';

type TalentSegment = 'direct' | 'adjacent' | 'potential';
type AnalyzePhase = 'idle' | 'loading' | 'done';

const TALENT_SEGMENTS: { key: TalentSegment; title: string; note: string }[] = [
  { key: 'direct', title: '直接匹配', note: '已有相关能力与经历' },
  { key: 'adjacent', title: '相邻能力', note: '核心能力可迁移' },
  { key: 'potential', title: '潜力人才', note: '短期培养后可胜任' },
];

const SCOPE_OPTIONS: string[] = ['智能汽车事业群', 'AI 平台中心', '机器人创新中心'];
const ORG_FILTER_LABEL: string = '机器人创新中心';
const DEFAULT_PROMPT: string =
  '我需要找适合参与具身智能业务的人。项目预计 10 月启动，需要理解机器人感知、强化学习或运动控制，有真实机器人项目经验更好，可投入至少 50%。';
const DEFAULT_SCOPE_LABEL: string = '全公司人才技能池';

function HrTalentPage() {
  const { navigate, showToast } = useUI();
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [analyzePhase, setAnalyzePhase] = useState<AnalyzePhase>('idle');
  const [activeSegment, setActiveSegment] = useState<TalentSegment>('direct');
  const [availabilityOnly, setAvailabilityOnly] = useState<boolean>(false);
  const [orgAll, setOrgAll] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TalentCandidatesResponse>({
    direct: [],
    adjacent: [],
    potential: [],
  });
  const [shortlistItems, setShortlistItems] = useState<TalentCandidate[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<boolean>(false);
  const [scopeOpen, setScopeOpen] = useState<boolean>(false);
  const [scopeSelection, setScopeSelection] = useState<Set<string>>(() => new Set());
  const [scopeLabel, setScopeLabel] = useState<string>(DEFAULT_SCOPE_LABEL);
  const [scopeText, setScopeText] = useState<string>(`范围：${DEFAULT_SCOPE_LABEL}`);
  const [roleBuilderOpen, setRoleBuilderOpen] = useState<boolean>(false);
  const [roleName, setRoleName] = useState<string>('机器人运动控制工程师');
  const [roleCount, setRoleCount] = useState<string>('1');
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer: ReturnType<typeof setTimeout>) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const scope = scopeRef.current;
      if (scope && event.target instanceof Node && !scope.contains(event.target)) {
        setScopeOpen(false);
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [candidatesRes, shortlistRes]: [TalentCandidatesResponse, ShortlistResponse] =
          await Promise.all([talentApi.getTalentCandidates(), talentApi.getShortlist()]);
        if (cancelled) return;
        setCandidates(candidatesRes);
        setShortlistItems(shortlistRes.items);
        setDataError(false);
      } catch (error) {
        if (cancelled) return;
        logger.error('加载人才搜索数据失败', error);
        setDataError(true);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const shortlistIds: Set<string> = new Set(
    shortlistItems.map((item: TalentCandidate) => item.id),
  );

  const visibleItems: TalentCandidate[] = candidates[activeSegment].filter(
    (item: TalentCandidate) =>
      (!availabilityOnly || item.available) && (orgAll || item.org === ORG_FILTER_LABEL),
  );

  const applyShortlistResult = (res: ShortlistResponse) => {
    setShortlistItems(res.items);
  };

  const handleShortlistError = (action: string) => (error: unknown) => {
    logger.error(`候选清单操作失败：${action}`, error);
    showToast('候选清单操作失败，请稍后重试。');
  };

  const toggleShortlist = (id: string) => {
    const request: Promise<ShortlistResponse> = shortlistIds.has(id)
      ? talentApi.removeFromShortlist(id)
      : talentApi.addToShortlist(id);
    request.then(applyShortlistResult).catch(handleShortlistError('切换候选清单'));
  };

  const removeFromShortlist = (id: string) => {
    talentApi
      .removeFromShortlist(id)
      .then(applyShortlistResult)
      .catch(handleShortlistError('移除候选人'));
  };

  const clearShortlist = () => {
    talentApi.clearShortlist().then(applyShortlistResult).catch(handleShortlistError('清空候选清单'));
  };

  const expandPerson = (id: string) => {
    setExpandedId((current: string | null) => (current === id ? null : id));
  };

  const switchSegment = (segment: TalentSegment) => {
    setActiveSegment(segment);
    setExpandedId(null);
  };

  const toggleAvailabilityOnly = () => setAvailabilityOnly((current: boolean) => !current);

  const toggleOrgFilter = () => setOrgAll((current: boolean) => !current);

  const handleAnalyze = () => {
    if (!prompt.trim()) {
      showToast('请先描述项目需要。');
      promptRef.current?.focus();
      return;
    }
    setAnalyzePhase('loading');
    timersRef.current.push(
      setTimeout(() => {
        setAnalyzePhase('done');
        setActiveSegment('direct');
        setExpandedId(null);
        showToast('需求已拆解，推荐结果已按直接匹配、相邻能力和潜力人才重新分层。');
        timersRef.current.push(
          setTimeout(() => setAnalyzePhase('idle'), 1600),
        );
      }, 850),
    );
  };

  const focusPrompt = () => {
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const toggleScopeSelection = (org: string) => {
    setScopeSelection((current: Set<string>) => {
      const next = new Set(current);
      if (next.has(org)) next.delete(org);
      else next.add(org);
      return next;
    });
  };

  const applyScope = () => {
    const selected: string[] = Array.from(scopeSelection);
    const label = selected.length > 0 ? `${selected.length} 个业务中心` : DEFAULT_SCOPE_LABEL;
    setScopeLabel(label);
    setScopeText(`范围：${selected.length > 0 ? selected.join('、') : label}`);
    setScopeOpen(false);
    showToast(
      selected.length > 0
        ? `已将搜索范围限定为 ${selected.length} 个业务中心。`
        : '已恢复搜索全公司人才技能池。',
    );
  };

  const handleRoleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoleBuilderOpen(false);
    showToast('项目角色已保存，可继续为该角色设置独立的能力条件。');
  };

  const analyzeLabel =
    analyzePhase === 'loading' ? ' 正在解析项目需要…' : analyzePhase === 'done' ? ' 已更新推荐结果' : ' 解析需求并找人';
  const analyzeIcon = analyzePhase === 'done' ? '✓' : '✦';

  return (
    <section className="page active" id="talent">
      <section className="talent-brief panel">
        <div className="talent-brief-head">
          <div>
            <h2>描述项目需要，找到真正合适的人</h2>
            <p>系统会拆解领域、能力与经历要求；推荐结果保留证据、缺口和可用性，不代替管理判断。</p>
          </div>
          <div className="talent-mode" aria-label="人才配置模式">
            <button className="active">人才搜索</button>
            <button id="team-mode-button" onClick={() => navigate('team')}>
              项目组队 <span>可扩展</span>
            </button>
          </div>
        </div>
        <div className="talent-prompt-wrap">
          <textarea
            id="talent-prompt"
            aria-label="项目人才需求"
            value={prompt}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
          />
          <div className="talent-prompt-actions">
            <div className="scope-picker" id="scope-picker" ref={scopeRef}>
              <button
                className="scope-trigger"
                id="scope-trigger"
                aria-expanded={scopeOpen}
                onClick={() => setScopeOpen((open: boolean) => !open)}
              >
                <span className="scope-icon">⌾</span>
                <span><small>搜索范围</small><b id="scope-label">{scopeLabel}</b></span>
                <i>⌄</i>
              </button>
              <div className={`scope-menu ${scopeOpen ? '' : 'hidden'}`} id="scope-menu">
                <div><b>选择找人的业务中心</b><small>不选择时默认搜索全公司</small></div>
                {SCOPE_OPTIONS.map((org: string) => (
                  <label key={org}>
                    <input
                      type="checkbox"
                      value={org}
                      checked={scopeSelection.has(org)}
                      onChange={() => toggleScopeSelection(org)}
                    />
                    {' '}{org}
                  </label>
                ))}
                <button id="scope-confirm" onClick={applyScope}>应用范围</button>
              </div>
            </div>
            <button
              className={`analyze-button ${analyzePhase === 'loading' ? 'loading' : ''}`}
              id="analyze-talent"
              onClick={handleAnalyze}
            >
              <span>{analyzeIcon}</span>{analyzeLabel}
            </button>
          </div>
        </div>
        <TalentConditions onEditConditions={focusPrompt} />
      </section>

      <div className="talent-workspace">
        <section className="talent-results panel">
          <div className="talent-results-head">
            <div>
              <h3>推荐候选人</h3>
              <p>
                <b id="candidate-count">{visibleItems.length}</b>
                {' '}人进入当前分层 · 技能与经历证据更新至 2026-09-13
              </p>
            </div>
            <div className="result-controls">
              <button
                id="availability-filter"
                className={availabilityOnly ? 'active' : ''}
                onClick={toggleAvailabilityOnly}
              >
                仅看可投入
              </button>
              <button
                id="org-filter"
                className={orgAll ? '' : 'active'}
                onClick={toggleOrgFilter}
              >
                {orgAll ? '全部组织 ⌄' : `${ORG_FILTER_LABEL} ×`}
              </button>
              <button aria-label="更多筛选">☷ 筛选</button>
            </div>
          </div>
          <div className="talent-segments" role="tablist" aria-label="候选人匹配分层">
            {TALENT_SEGMENTS.map((segment) => (
              <button
                key={segment.key}
                className={activeSegment === segment.key ? 'active' : ''}
                data-talent-segment={segment.key}
                role="tab"
                onClick={() => switchSegment(segment.key)}
              >
                <span>{segment.title}</span>
                <b>{candidates[segment.key].length}</b>
                <small>{segment.note}</small>
              </button>
            ))}
          </div>
          {dataLoading ? (
            <div className="candidate-list" id="talent-candidate-list">
              <div className="empty-candidates">
                <b>正在加载候选人…</b>
                <p>数据来自后端接口，请稍候。</p>
              </div>
            </div>
          ) : dataError ? (
            <div className="candidate-list" id="talent-candidate-list">
              <div className="empty-candidates">
                <b>候选人加载失败</b>
                <p>请刷新页面重试。</p>
              </div>
            </div>
          ) : (
            <TalentCandidateList
              items={visibleItems}
              shortlist={shortlistIds}
              expandedId={expandedId}
              onTogglePerson={toggleShortlist}
              onExpandPerson={expandPerson}
            />
          )}
        </section>

        <ShortlistPanel
          items={shortlistItems}
          scopeText={scopeText}
          onRemove={removeFromShortlist}
          onClear={clearShortlist}
          onAddRole={() => setRoleBuilderOpen(true)}
        />
      </div>

      {roleBuilderOpen && (
        <div
          className="role-builder-modal"
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) setRoleBuilderOpen(false);
          }}
        >
          <form className="role-builder-card" onSubmit={handleRoleSubmit}>
            <h3>添加项目角色</h3>
            <p>角色会独立保存必需能力和人数，后续可以基于已锁定成员重新计算团队组合。</p>
            <label>
              角色名称
              <input value={roleName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRoleName(event.target.value)} />
            </label>
            <label>
              需要人数
              <input
                type="number"
                min={1}
                value={roleCount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRoleCount(event.target.value)}
              />
            </label>
            <div className="role-builder-actions">
              <button type="button" onClick={() => setRoleBuilderOpen(false)}>取消</button>
              <button type="submit">保存角色</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function ExpertTalentSearch() {
  const [people, setPeople] = useState<EmployeeWideRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    listWideEmployees().then(rows => {
      if (active) setPeople(rows);
    }).catch(cause => {
      logger.error('加载专家人才搜索失败', cause);
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filtered = people.filter(person =>
    `${person.name} ${person.role ?? ''} ${person.department ?? ''} ${person.jobGrade ?? ''} ${person.factTitles.join(' ')}`
      .toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="page active expert-talent-page" id="talent">
    <div className="panel expert-talent-panel">
      <div className="section-head"><div><h2>人才搜索</h2><p>仅展示本部门和指派给你复核的员工，按姓名、岗位、职级或事实标题查找。</p></div><strong>{filtered.length} 人</strong></div>
      <label className="expert-talent-search">搜索人才<input id="expert-talent-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入姓名、岗位、职级或项目关键词" /></label>
      {loading && <p>正在读取人才资料…</p>}
      {error && <p role="alert">读取失败，请刷新页面重试。</p>}
      {!loading && !error && <div className="expert-talent-grid">{filtered.map(person => <article key={person.employeeSlug}>
        <div><strong>{person.name}</strong><span>{person.jobGrade || '未定级'}</span></div>
        <p>{person.department || person.org || '未填写部门'} · {person.role || '未填写岗位'}</p>
        <small>项目 {person.projectCount} · 证据 {person.evidenceCount} · 有效事实 {person.factCount}</small>
        {person.factTitles.length > 0 && <p className="expert-talent-fact">{person.factTitles.slice(0, 2).join(' · ')}</p>}
      </article>)}</div>}
      {!loading && !error && filtered.length === 0 && <p>没有匹配的人才。</p>}
    </div>
  </section>;
}

export default function TalentPage() {
  const { user } = useAuth();
  return user.personnelRole === 'expert' ? <ExpertTalentSearch /> : <HrTalentPage />;
}
