import { useEffect, useRef, useState } from 'react';
import type {
  CreateTeamRoleInput,
  TalentCandidate,
  TalentCandidatesResponse,
  TeamProjectView,
  TeamResponse,
  TeamRole,
  TeamRoleSkill,
} from '@shared/api.interface';
import { teamApi, talentApi } from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';

interface TeamEntry {
  role: TeamRole;
  candidate: TalentCandidate;
}

export default function TeamPage() {
  const { navigate, showToast, openProfile } = useUI();
  const [project, setProject] = useState<TeamProjectView | null>(null);
  const [candidateMap, setCandidateMap] = useState<Map<string, TalentCandidate>>(
    () => new Map(),
  );
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<boolean>(false);
  const [activeTeamRole, setActiveTeamRole] = useState<string>('perception');
  const [teamConflictResolved, setTeamConflictResolved] = useState<boolean>(false);
  const [builderOpen, setBuilderOpen] = useState<boolean>(false);
  const [builderTitle, setBuilderTitle] = useState<string>('机器人系统集成');
  const [builderAllocation, setBuilderAllocation] = useState<string>('50%');
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchPanelRef = useRef<HTMLElement | null>(null);

  useEffect(
    () => () => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [teamRes, talentRes]: [TeamResponse, TalentCandidatesResponse] =
          await Promise.all([teamApi.getTeam(), talentApi.getTalentCandidates()]);
        if (cancelled) return;
        const map = new Map<string, TalentCandidate>();
        [
          ...talentRes.direct,
          ...talentRes.adjacent,
          ...talentRes.potential,
        ].forEach((item: TalentCandidate) => map.set(item.id, item));
        setCandidateMap(map);
        setProject(teamRes.project);
        setDataError(false);
      } catch (error) {
        if (cancelled) return;
        logger.error('加载项目组队数据失败', error);
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

  const teamRoles: TeamRole[] = project?.roles ?? [];
  const teamAssignments: Record<string, string> = project?.assignments ?? {};
  const candidateById = (id: string): TalentCandidate | undefined =>
    candidateMap.get(id);

  const role: TeamRole | undefined =
    teamRoles.find((item: TeamRole) => item.id === activeTeamRole) || teamRoles[0];

  if (dataLoading) {
    return (
      <section className="page active" id="team">
        <section className="team-project-head panel">
          <div className="empty-candidates">
            <b>正在加载组队方案…</b>
            <p>数据来自后端接口，请稍候。</p>
          </div>
        </section>
      </section>
    );
  }
  if (dataError || !project || !role) {
    return (
      <section className="page active" id="team">
        <section className="team-project-head panel">
          <div className="empty-candidates">
            <b>组队数据加载失败</b>
            <p>请刷新页面重试。</p>
          </div>
        </section>
      </section>
    );
  }

  const entries: TeamEntry[] = Object.entries(teamAssignments)
    .filter(([, id]: [string, string]) => Boolean(id))
    .map(([roleId, candidateId]: [string, string]) => {
      const matchedRole = teamRoles.find((item: TeamRole) => item.id === roleId);
      const candidate = candidateById(candidateId);
      return matchedRole && candidate ? { role: matchedRole, candidate } : null;
    })
    .filter((entry: TeamEntry | null): entry is TeamEntry => entry !== null);

  const roleCoverage: number = Math.round((entries.length / teamRoles.length) * 100);
  const skillCoverage: number = Math.min(96, entries.length ? 48 + entries.length * 15 : 0);
  const hasConflict: boolean =
    entries.some((entry: TeamEntry) => !entry.candidate.available) && !teamConflictResolved;
  const confirmDisabled: boolean = entries.length < teamRoles.length || hasConflict;

  const handleAssign = (candidateId: string) => {
    const occupiedRoleId = Object.keys(teamAssignments).find(
      (roleId: string) => roleId !== activeTeamRole && teamAssignments[roleId] === candidateId,
    );
    if (occupiedRoleId) {
      const occupiedRole = teamRoles.find((item: TeamRole) => item.id === occupiedRoleId);
      const candidate = candidateById(candidateId);
      if (occupiedRole && candidate) {
        showToast(`${candidate.name} 已承担“${occupiedRole.title}”，请先调整该角色。`);
      }
      return;
    }
    teamApi
      .assignTeamMember(activeTeamRole, candidateId)
      .then((res: TeamResponse) => {
        setProject(res.project);
        setTeamConflictResolved(false);
        const candidate = candidateById(candidateId);
        if (candidate) showToast(`${candidate.name} 已配置到 ${role.title}。`);
      })
      .catch((error: unknown) => {
        logger.error('配置团队成员失败', error);
        showToast('成员配置失败，请稍后重试。');
      });
  };

  const handleRemoveMember = (roleId: string) => {
    teamApi
      .removeTeamAssignment(roleId)
      .then((res: TeamResponse) => setProject(res.project))
      .catch((error: unknown) => {
        logger.error('移除团队成员失败', error);
        showToast('移除成员失败，请稍后重试。');
      });
  };

  const handleUnlock = () => {
    teamApi
      .clearTeamAssignments()
      .then((res: TeamResponse) => {
        setProject(res.project);
        setTeamConflictResolved(true);
        showToast('已解除全部成员锁定，可以重新组队。');
      })
      .catch((error: unknown) => {
        logger.error('解除全部成员锁定失败', error);
        showToast('解除锁定失败，请稍后重试。');
      });
  };

  const handleResolveConflict = () => {
    if (!teamConflictResolved) {
      setActiveTeamRole('simulation');
      if (matchPanelRef.current) {
        matchPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      showToast('已定位到“仿真训练平台”，请选择无投入冲突的备选成员。');
    } else {
      showToast('已重新检查，当前成员时间安排无冲突。');
    }
  };

  const handleRecalculate = () => {
    if (recalculating) return;
    setRecalculating(true);
    recalcTimer.current = setTimeout(() => {
      setRecalculating(false);
      showToast('已根据锁定成员重新计算其余角色推荐。');
    }, 700);
  };

  const handleCreateRole = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: CreateTeamRoleInput = {
      title: builderTitle || '新项目角色',
      allocation: builderAllocation || '50%',
      skills: [
        { name: '系统集成 L2', type: 'required' },
        { name: '跨团队协作 L3', type: 'required' },
      ],
      candidates: ['he-jing', 'zhou-chen', 'gao-yu'],
    };
    teamApi
      .createTeamRole(input)
      .then((created: TeamRole) => {
        setProject((prev: TeamProjectView | null) =>
          prev ? { ...prev, roles: [...prev.roles, created] } : prev,
        );
        setActiveTeamRole(created.id);
        setBuilderOpen(false);
        showToast('新角色已加入组队方案，可以继续选择候选成员。');
      })
      .catch((error: unknown) => {
        logger.error('创建项目角色失败', error);
        showToast('创建角色失败，请稍后重试。');
      });
  };

  return (
    <section className="page active" id="team">
      <section className="team-project-head panel">
        <div className="team-project-copy">
          <span>组队方案 · 草稿</span>
          <h2>{project.title}</h2>
          <p>{project.period} · {teamRoles.length} 个角色 · {project.note}</p>
        </div>
        <div className="team-progress" aria-label="组队进度">
          <div className="done">
            <i>1</i>
            <span>
              <b>定义角色</b>
              <small>已完成</small>
            </span>
          </div>
          <em></em>
          <div className="active">
            <i>2</i>
            <span>
              <b>选择成员</b>
              <small>进行中</small>
            </span>
          </div>
          <em></em>
          <div>
            <i>3</i>
            <span>
              <b>协调确认</b>
              <small>待开始</small>
            </span>
          </div>
        </div>
        <button type="button" className="team-head-action" id="new-team-role" onClick={() => setBuilderOpen(true)}>
          ＋ 添加角色
        </button>
      </section>
      <div className="team-builder-layout">
        <aside className="panel team-role-panel">
          <div className="team-panel-title">
            <div>
              <h3>项目角色</h3>
              <p>
                <b id="filled-role-count">{entries.length}</b> / {teamRoles.length} 已配置
              </p>
            </div>
            <button type="button" id="edit-team-requirement" onClick={() => navigate('talent')}>
              编辑需求
            </button>
          </div>
          <div id="team-role-list" className="team-role-list">
            {teamRoles.map((item: TeamRole, index: number) => {
              const assigned = candidateById(teamAssignments[item.id]);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`team-role-item ${item.id === activeTeamRole ? 'active' : ''}`}
                  onClick={() => setActiveTeamRole(item.id)}
                >
                  <span className="role-index">0{index + 1}</span>
                  <span>
                    <b>{item.title}</b>
                    <small>
                      {assigned
                        ? `${assigned.name} · 已锁定`
                        : `${item.headcount} 人 · 投入 ${item.allocation}`}
                    </small>
                  </span>
                  <i className={`role-fill-state ${assigned ? 'filled' : ''}`}>
                    {assigned ? '已配置' : '待选择'}
                  </i>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="panel team-match-panel" ref={matchPanelRef}>
          <div className="team-match-head">
            <div>
              <span id="active-role-kicker">当前角色</span>
              <h3 id="active-role-title">{role.title}</h3>
              <p id="active-role-meta">
                需要 {role.headcount} 人 · 至少投入 {role.allocation}
              </p>
            </div>
            <button type="button" id="recalculate-team" onClick={handleRecalculate}>
              {recalculating ? '计算中…' : '↻ 重新计算'}
            </button>
          </div>
          <div className="role-skill-line" id="active-role-skills">
            {role.skills.map((skill: TeamRoleSkill) => (
              <span key={skill.name} className={skill.type === 'bonus' ? 'bonus' : ''}>
                {skill.type === 'bonus' ? '加分' : '必需'} · {skill.name}
              </span>
            ))}
          </div>
          <div className="team-recommendation-note">
            <span>推荐逻辑</span>
            <p id="active-role-reason">优先满足必需技能，再检查项目经历、可投入时间与团队互补。</p>
          </div>
          <div id="team-candidate-list" className="team-candidate-list" aria-live="polite">
            {role.candidates.map((id: string, index: number) => {
              const candidate = candidateById(id);
              if (!candidate) return null;
              const assigned = teamAssignments[role.id] === id;
              const conflict = !candidate.available;
              return (
                <article className="team-candidate" key={id}>
                  <i className={`talent-avatar ${candidate.avatarTone}`}>{candidate.avatar}</i>
                  <div className="team-candidate-main">
                    <button
                      type="button"
                      className="team-profile-link"
                      onClick={() => openProfile(candidate.id)}
                    >
                      {candidate.name} · {candidate.org}
                    </button>
                    <small>{candidate.reason}</small>
                    <div className="team-candidate-tags">
                      <span>{candidate.evidence[0]}</span>
                      <span>{candidate.evidence[1]}</span>
                      <span className={conflict ? 'warn' : ''}>{candidate.availability}</span>
                    </div>
                  </div>
                  <div className="team-candidate-action">
                    <button
                      type="button"
                      className={assigned ? 'assigned' : ''}
                      onClick={() => handleAssign(id)}
                    >
                      {assigned ? '✓ 已选定' : '选择此人'}
                    </button>
                    <small>{index === 0 ? '当前角色首选' : '备选方案'}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="panel team-summary-panel">
          <div className="team-summary-head">
            <div>
              <span>当前团队</span>
              <h3>
                <b id="team-member-count">{entries.length}</b> / {teamRoles.length} 人
              </h3>
            </div>
            <button type="button" id="unlock-team" onClick={handleUnlock}>
              解除锁定
            </button>
          </div>
          <div id="team-member-list" className="team-member-list">
            {entries.length ? (
              entries.map(({ role: memberRole, candidate }: TeamEntry) => (
                <div className="team-member" key={memberRole.id}>
                  <i className={`talent-avatar ${candidate.avatarTone}`}>{candidate.avatar}</i>
                  <span>
                    <b>{candidate.name}</b>
                    <small>
                      {memberRole.title} · {memberRole.allocation}
                    </small>
                  </span>
                  <button type="button" onClick={() => handleRemoveMember(memberRole.id)}>
                    移除
                  </button>
                </div>
              ))
            ) : (
              <div className="shortlist-empty">尚未选择项目成员</div>
            )}
          </div>
          <div className="team-coverage">
            <div>
              <span>角色覆盖</span>
              <b id="role-coverage">{roleCoverage}%</b>
            </div>
            <i>
              <em id="role-coverage-track" style={{ width: `${roleCoverage}%` }}></em>
            </i>
            <div>
              <span>必需技能覆盖</span>
              <b id="skill-coverage">{skillCoverage}%</b>
            </div>
            <i>
              <em id="skill-coverage-track" style={{ width: `${skillCoverage}%` }}></em>
            </i>
          </div>
          <div className={`team-alert ${hasConflict ? '' : 'resolved'}`} id="team-alert">
            {hasConflict ? (
              <>
                <b>1 项投入冲突</b>
                <p>陈然在 10 月已有核心项目，当前只能投入 20%。</p>
              </>
            ) : (
              <>
                <b>当前无时间冲突</b>
                <p>已选择成员的可用时间满足当前角色投入要求。</p>
              </>
            )}
            <button type="button" id="resolve-conflict" onClick={handleResolveConflict}>
              {hasConflict ? '查看替代方案' : '重新检查'}
            </button>
          </div>
          <button
            type="button"
            className="primary team-confirm"
            id="confirm-team"
            disabled={confirmDisabled}
            onClick={() => showToast('组队方案已进入协调确认，将按组织权限逐一发起沟通。')}
          >
            进入协调确认
          </button>
          <small>确认前不会向候选人或其管理者发送通知。</small>
        </aside>
      </div>
      {builderOpen ? (
        <div
          className="development-modal"
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) setBuilderOpen(false);
          }}
        >
          <form className="development-card" onSubmit={handleCreateRole}>
            <h3>添加项目角色</h3>
            <p>每个角色可以独立设置人数、投入比例、必需技能和加分技能。</p>
            <label>
              角色名称
              <input
                value={builderTitle}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setBuilderTitle(event.target.value)
                }
              />
            </label>
            <label>
              投入比例
              <input
                value={builderAllocation}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setBuilderAllocation(event.target.value)
                }
              />
            </label>
            <div className="development-actions">
              <button type="button" data-close-development onClick={() => setBuilderOpen(false)}>
                取消
              </button>
              <button type="submit">保存角色</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
