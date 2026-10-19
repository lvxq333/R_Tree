import { useEffect, useRef, useState } from 'react';
import { useUI } from './ui-context';
import { employeeApi } from '@/api';
import { logger } from '@/lib/runtime';
import type { EmployeeProfile, ProfileSkillRecord } from '@shared/api.interface';
import type { PageId } from './types';

const RETURN_PAGES: PageId[] = ['manager', 'talent', 'succession', 'team'];

const ProfilePage = () => {
  const { navigate, profileId, profileReturnPage, showToast } = useUI();

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(false);
  const sourceCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sourcesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourcesOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    sourceCloseRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sourcesOpen]);

  useEffect(() => {
    let cancelled = false;
    employeeApi.getEmployeeProfile(profileId)
      .then((data: EmployeeProfile) => {
        if (!cancelled) {
          setProfile(data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取员工画像失败', error);
          setLoadError('画像数据加载失败，请稍后重试');
        }
      });
    return () => { cancelled = true; };
  }, [profileId]);

  if (loadError) {
    return (
      <section className="page active" id="profile">
        <div className="profile-trust-line"><span>{loadError}</span></div>
      </section>
    );
  }
  if (!profile) {
    return (
      <section className="page active" id="profile">
        <div className="profile-trust-line"><span>画像数据加载中…</span></div>
      </section>
    );
  }

  const handleBack = () => {
    const target: PageId = RETURN_PAGES.includes(profileReturnPage)
      ? profileReturnPage
      : 'manager';
    navigate(target);
  };

  const latestPerformance: string = profile.performance.length > 0
    ? `${profile.performance[0][0]} · ${profile.performance[0][1]}`
    : '暂无记录';
  const teamScope: string = profile.management ? profile.management.scope : '暂无记录';

  return (
    <section className="page active" id="profile">
      <nav className="profile-breadcrumb" aria-label="员工画像路径"><button onClick={handleBack}>← 返回</button><span>/</span><span>{profile.name}</span></nav>

      <section className="profile-head" aria-label="员工基础信息">
        <div className="profile-head-main">
          <i className={`profile-person-avatar ${profile.tone || ''}`}>{profile.avatar}</i>
          <div className="profile-head-person">
            <div className="profile-name-line"><h2>{profile.name}</h2><span>{profile.status}</span></div>
            <p>{profile.role}</p>
            <small>{profile.org}</small>
          </div>
          {profile.demographics ? (
            <dl className="profile-demographics">
              <div><dt>年龄</dt><dd>{profile.demographics.age || '—'}</dd></div>
              <div><dt>司龄</dt><dd>{profile.demographics.tenure || profile.tenureSummary || '—'}</dd></div>
              <div><dt>性别</dt><dd>{profile.demographics.gender || '—'}</dd></div>
              <div><dt>学历</dt><dd>{profile.demographics.education || '—'}</dd></div>
            </dl>
          ) : (
            <div className="profile-demographics profile-demographics--empty">暂无人口学信息</div>
          )}
        </div>
        <div className="profile-command-actions"><button className="ghost" onClick={() => showToast('已生成当前权限范围内的画像摘要，敏感字段不会包含在分享内容中。')}>分享画像摘要</button><button className="primary" onClick={() => showToast('已加入本次用人清单。')}>加入用人清单</button></div>
      </section>

      <div className="profile-trust-line"><span><i></i>画像信息有效</span><span>{profile.updated}</span><span>仅展示当前权限范围内信息</span><button onClick={() => setSourcesOpen(true)}>查看数据来源</button></div>

      <section className="profile-decision-summary" aria-labelledby="profile-summary-title">
        <div className="profile-summary-copy"><span>画像结论</span><h3 id="profile-summary-title">{profile.summary}</h3><p>{profile.summaryDescription}</p></div>
        <dl className="profile-facts"><div><dt>项目可用性</dt><dd>{profile.availability}</dd></div><div><dt>带团队经验</dt><dd>{teamScope}</dd></div><div><dt>最近绩效</dt><dd>{latestPerformance}</dd></div></dl>
      </section>

      <div className="profile-layout">
        <div className="profile-main-column">
          <section className="profile-section" aria-labelledby="profile-responsibilities-title">
            <div className="profile-section-head"><div><span className="profile-question-label">基础信息</span><h3 id="profile-responsibilities-title">当前责任与目标</h3><p>明确员工正在承接的目标、业务范围和交付责任。</p></div><span>{profile.responsibilities.length} 项责任</span></div>
            <div className="profile-responsibility-list">
              {profile.responsibilities.map(([label, value, meta]) => (
                <div className="profile-responsibility" key={label}><span>{label}</span><div><b>{value}</b><small>{meta}</small></div></div>
              ))}
            </div>
          </section>

          <section className="profile-section" aria-labelledby="profile-projects-title">
            <div className="profile-section-head"><div><span className="profile-question-label">核心能力</span><h3 id="profile-projects-title">从实际行动到业务影响</h3><p>每段经历都说明责任、行动、交付、影响、贡献角色和被证明的能力。</p></div><span>近 12 个月 {profile.projects.length} 项</span></div>
            <div className="profile-project-list">
              {profile.projects.map((project) => (
                <article className="profile-project" key={`${project.time}-${project.title}`}>
                  <header><div><span>{project.time}</span><h4>{project.title}</h4></div><em>{project.verification}</em></header>
                  <div className="profile-evidence-grid">
                    <div><span>责任范围</span><p>{project.responsibility}</p></div>
                    <div><span>关键行动</span><p>{project.actions}</p></div>
                    <div><span>交付结果</span><p>{project.outcome}</p></div>
                    <div className="profile-impact"><span>业务影响</span><p>{project.impact}</p></div>
                  </div>
                  <footer>
                    <span><b>贡献角色</b><strong>{project.contribution}</strong></span>
                    <span><b>证明能力</b>{project.skills.map((skill) => <i key={skill}>{skill}</i>)}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className="profile-section" aria-labelledby="profile-skills-title">
            <div className="profile-section-head"><div><span className="profile-question-label">核心能力</span><h3 id="profile-skills-title">核心技能与正式证据</h3><p>只显示仍在有效期内的正式等级，待确认信号不计入。</p></div><button onClick={() => showToast('技能等级均按当前生效的岗位标准版本展示。')}>查看技能标准</button></div>
            <div className="profile-skill-table"><div className="profile-skill-row profile-skill-head"><span>技能</span><span>当前等级</span><span>最近使用 / 状态</span><span>最近证据</span><span>有效期</span></div>
              <div>
                {profile.skills.map((skill: ProfileSkillRecord) => {
                  const lifecycle = skill.meta;
                  const status = lifecycle?.status || '有效';
                  const isReview = status !== '有效';
                  return (
                    <div className={`profile-skill-row ${isReview ? 'needs-review' : ''}`} key={skill.name}>
                      <span className="profile-skill-name"><b>{skill.name}</b><small>{skill.category}</small></span>
                      <span className="profile-level"><i></i>{skill.level}</span>
                      <span className="profile-skill-recency"><b>{lifecycle?.lastUsed || '近 6 个月'}</b><em className={isReview ? 'review' : ''}>{status}</em></span>
                      <span className="profile-skill-evidence">{skill.evidence}</span>
                      <span className="profile-validity">至 {skill.expiry}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="profile-section" aria-labelledby="profile-traits-title">
            <div className="profile-section-head"><div><span className="profile-question-label">核心能力</span><h3 id="profile-traits-title">综合核心特征</h3><p>由前述责任、行动、成果和能力证据归纳，不作为独立的人事结论。</p></div><span>{profile.traits.length} 项</span></div>
            <div className="profile-trait-list">
              {profile.traits.map(([, title, description, source]) => (
                <article className="profile-trait" key={title}><div><b>{title}</b><p>{description}</p><small>{source}</small></div></article>
              ))}
            </div>
          </section>
        </div>

        <aside className="profile-side-column">
          <section className="profile-aside-section"><div className="profile-section-head"><div><span className="profile-question-label">基础信息</span><h3>组织与任职经历</h3><p>{profile.tenureSummary}</p></div></div>
            <div className="profile-experience-list">
              {profile.experience.map(([time, role, org], index: number) => (
                <div className={`profile-experience ${index === 0 ? 'current' : ''}`} key={`${time}-${role}`}><i></i><div><span>{time}</span><b>{role}</b><small>{org}</small></div></div>
              ))}
            </div>
          </section>
          <section className="profile-aside-section"><div className="profile-section-head"><div><span className="profile-question-label">基础信息</span><h3>过往绩效</h3><p>按绩效周期呈现评级与管理评价摘要。</p></div></div>
            <div className="profile-experience-list">
              {profile.performance.length === 0
                ? <p className="profile-aside-empty">暂无绩效记录</p>
                : profile.performance.map(([period, rating, summary]) => (
                  <div className="profile-experience" key={period}><i></i><div><span>{period}</span><b>{rating}</b><small>{summary}</small></div></div>
                ))}
            </div>
          </section>
          <section className="profile-aside-section"><div className="profile-section-head"><div><span className="profile-question-label">管理经验</span><h3>管理经验与协作</h3><p>带团队情况、管理风格与跨团队协作适配性。</p></div></div>
            {profile.management ? (
              <dl className="profile-collaboration">
                <div><dt>带团队经验</dt><dd>{profile.management.hasTeam ? `有 · ${profile.management.scope} · ${profile.management.years}` : '暂无'}</dd></div>
                <div><dt>团队管理风格</dt><dd>{profile.management.style} · {profile.management.styleDetail}</dd></div>
                <div><dt>跨团队协作适配性</dt><dd>{profile.management.collaborationFit}</dd></div>
                {profile.collaboration.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            ) : (
              <p className="profile-aside-empty">暂无管理经验记录</p>
            )}
          </section>
          <section className="profile-aside-section profile-governance"><div className="profile-section-head"><div><h3>数据说明</h3></div></div><p>画像不包含私人聊天、健康家庭信息，也不生成忠诚度或离职风险判断。</p><button onClick={() => showToast('纠错申请已创建，提交后将通知数据责任人核对。')}>反馈信息有误</button></section>
        </aside>
      </div>

      {sourcesOpen && (
        <div className="profile-source-backdrop" onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) setSourcesOpen(false); }}>
          <aside className="profile-source-panel" role="dialog" aria-modal="true" aria-labelledby="profile-source-title">
            <button ref={sourceCloseRef} aria-label="关闭数据来源" onClick={() => setSourcesOpen(false)}>×</button>
            <h3 id="profile-source-title">数据来源</h3>
            <p>{profile.name}的画像由已授权数据汇总，每项特征均保留原始依据与更新时间。</p>
            <div className="profile-source-row"><b>HR 基础信息</b><span>岗位、职级、组织与任职状态 · 每日同步</span></div>
            <div className="profile-source-row"><b>技能认证记录</b><span>正式技能等级、证据、审批人与有效期 · {profile.updated}</span></div>
            <div className="profile-source-row"><b>项目与成果记录</b><span>本人提交或项目负责人确认的职责与量化成果</span></div>
            <div className="profile-source-row"><b>管理经验与绩效记录</b><span>直属管理者与 HR 共同确认</span></div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default ProfilePage;
