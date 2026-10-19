import { useEffect, useState } from 'react';
import type {
  SuccessionResponse,
  SuccessionRole,
  SuccessorPerson,
} from '@shared/api.interface';
import { successionApi } from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';

function renderLoadingPlaceholder(): React.ReactElement {
  return (
  <section className="page active" id="succession">
    <div className="succession-layout">
      <section className="panel succession-roles">
        <div className="empty-candidates">
          <b>正在加载岗位梯队数据…</b>
          <p>数据来自后端接口，请稍候。</p>
        </div>
      </section>
    </div>
  </section>
  );
}

function renderErrorPlaceholder(): React.ReactElement {
  return (
  <section className="page active" id="succession">
    <div className="succession-layout">
      <section className="panel succession-roles">
        <div className="empty-candidates">
          <b>梯队数据加载失败</b>
          <p>请刷新页面重试。</p>
        </div>
      </section>
    </div>
  </section>
  );
}

function SuccessorCard({ person }: { person: SuccessorPerson }) {
  const { openProfile } = useUI();
  return (
    <div className="successor-card">
      <i className={`talent-avatar ${person.tone}`}>{person.avatar}</i>
      <div>
        <button
          type="button"
          className="successor-profile-link"
          onClick={() => {
            if (person.employeeId) openProfile(person.employeeId);
          }}
        >
          {person.name}
        </button>
        <small>
          {person.role}
          <br />
          {person.gap}
        </small>
      </div>
      <span className={`readiness-state ${person.stateClass}`}>{person.state}</span>
    </div>
  );
}

export default function SuccessionPage() {
  const { showToast } = useUI();
  const [roles, setRoles] = useState<SuccessionRole[]>([]);
  const [selectedSuccessionRole, setSelectedSuccessionRole] = useState<string>('platform-architect');
  const [successionRiskOnly, setSuccessionRiskOnly] = useState<boolean>(false);
  const [developmentRole, setDevelopmentRole] = useState<SuccessionRole | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    successionApi
      .getSuccession()
      .then((res: SuccessionResponse) => {
        if (cancelled) return;
        setRoles(res.roles);
        setDataError(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.error('加载梯队与继任数据失败', error);
        setDataError(true);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const role: SuccessionRole | undefined =
    roles.find((item: SuccessionRole) => item.id === selectedSuccessionRole) || roles[0];
  const items: SuccessionRole[] = successionRiskOnly
    ? roles.filter((item: SuccessionRole) => item.health === 'risk')
    : roles;
  const developmentCandidate: SuccessorPerson | undefined =
    developmentRole?.ready[0] || developmentRole?.pipeline[0];

  const handleToggleRiskOnly = () => {
    const nextRiskOnly = !successionRiskOnly;
    setSuccessionRiskOnly(nextRiskOnly);
    if (nextRiskOnly) {
      const selectedStillVisible = roles.some(
        (item: SuccessionRole) => item.id === selectedSuccessionRole && item.health === 'risk',
      );
      if (!selectedStillVisible) {
        const firstRisk = roles.find((item: SuccessionRole) => item.health === 'risk');
        if (firstRisk) setSelectedSuccessionRole(firstRisk.id);
      }
    }
  };

  if (dataLoading) return renderLoadingPlaceholder();
  if (dataError || !role) return renderErrorPlaceholder();

  return (
    <section className="page active" id="succession">
      <section className="succession-intro">
        <div>
          <h2>关键岗位梯队盘点</h2>
          <p>把岗位风险、继任准备度和培养动作放在同一个决策视图中。</p>
        </div>
        <div className="succession-filters">
          <button type="button">平台工程部 ⌄</button>
          <button type="button">2026 Q3 ⌄</button>
          <button type="button">全部岗位族 ⌄</button>
        </div>
      </section>
      <div className="succession-metrics">
        <article>
          <span>关键岗位</span>
          <strong>12</strong>
          <small>本季度纳入盘点</small>
        </article>
        <article>
          <span>健康岗位</span>
          <strong>8</strong>
          <small className="positive">较上季度 +2</small>
        </article>
        <article>
          <span>高风险岗位</span>
          <strong className="risk-number">2</strong>
          <small>暂无成熟继任者</small>
        </article>
        <article>
          <span>培养动作按期率</span>
          <strong>71%</strong>
          <small>5 项即将到期</small>
        </article>
      </div>
      <div className="succession-layout">
        <section className="panel succession-roles">
          <div className="succession-section-head">
            <div>
              <h3>岗位梯队健康度</h3>
              <p>点击岗位查看候选梯队与差距</p>
            </div>
            <button
              type="button"
              id="succession-view-toggle"
              className={successionRiskOnly ? 'active' : undefined}
              onClick={handleToggleRiskOnly}
            >
              {successionRiskOnly ? '查看全部岗位' : '只看风险岗位'}
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
            {items.map((item: SuccessionRole) => (
              <button
                type="button"
                key={item.id}
                className={`succession-role-row ${item.id === selectedSuccessionRole ? 'selected' : ''}`}
                onClick={() => setSelectedSuccessionRole(item.id)}
              >
                <span>
                  <b>{item.title}</b>
                  <small>{item.family}</small>
                </span>
                <span>
                  <b>{item.incumbent}</b>
                  <small>{item.incumbentMeta}</small>
                </span>
                <span className="count-cell">{item.immediate}</span>
                <span className="count-cell">{item.developing}</span>
                <span>
                  <i className={`health-label ${item.health}`}>{item.healthText}</i>
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="panel succession-detail" id="succession-detail" aria-live="polite">
          <div className="succession-detail-top">
            <span>岗位继任详情</span>
            <h3>{role.title}</h3>
            <p>{role.summary}</p>
            <div className="incumbent-strip">
              <i className="talent-avatar blue">{role.incumbent === '空缺' ? '—' : role.incumbent[0]}</i>
              <span>
                <b>{role.incumbent}</b>
                <small>现任者 · {role.incumbentMeta}</small>
              </span>
              <span>{role.healthText}</span>
            </div>
          </div>
          <section className="pipeline-section">
            <div className="pipeline-title">
              <b>可立即接任 / 短期代理</b>
              <span>{role.ready.length} 人</span>
            </div>
            {role.ready.length ? (
              role.ready.map((person: SuccessorPerson) => (
                <SuccessorCard key={person.name} person={person} />
              ))
            ) : (
              <div className="successor-card">
                <i className="talent-avatar amber">!</i>
                <div>
                  <b>暂无成熟候选</b>
                  <small>建议扩大搜索范围或明确临时代理方案</small>
                </div>
                <span className="readiness-state gap">缺口</span>
              </div>
            )}
          </section>
          <section className="pipeline-section">
            <div className="pipeline-title">
              <b>6–12 个月可培养</b>
              <span>{role.pipeline.length} 人</span>
            </div>
            {role.pipeline.map((person: SuccessorPerson) => (
              <SuccessorCard key={person.name} person={person} />
            ))}
          </section>
          <div className="succession-actions">
            <div className="succession-risk-note">{role.risk}</div>
            <button type="button" onClick={() => setDevelopmentRole(role)}>
              创建继任培养计划
            </button>
          </div>
        </aside>
      </div>
      {developmentRole ? (
        <div
          className="development-modal"
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) setDevelopmentRole(null);
          }}
        >
          <div className="development-card">
            <h3>创建继任培养计划</h3>
            <p>
              {developmentRole.title} · 候选人 {developmentCandidate?.name || '待指定'}
              。计划将保留岗位标准版本、关键缺口与验证结果。
            </p>
            <div className="development-step">
              <span>70%</span>
              <div>
                <b>代理承担真实职责</b>
                <small>在关键项目中完成一次岗位级决策与复盘</small>
              </div>
            </div>
            <div className="development-step">
              <span>20%</span>
              <div>
                <b>现任者 / 专家辅导</b>
                <small>每两周一次案例评审与反馈</small>
              </div>
            </div>
            <div className="development-step">
              <span>10%</span>
              <div>
                <b>补充治理知识</b>
                <small>完成岗位缺口对应的课程或认证</small>
              </div>
            </div>
            <div className="development-actions">
              <button type="button" data-close-development onClick={() => setDevelopmentRole(null)}>
                取消
              </button>
              <button
                type="button"
                data-save-development
                onClick={() => {
                  setDevelopmentRole(null);
                  showToast('继任培养计划已创建，并已加入季度人才动作清单。');
                }}
              >
                创建计划
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
