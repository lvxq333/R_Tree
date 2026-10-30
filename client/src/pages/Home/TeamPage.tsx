import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TeamCandidateOption,
  TeamCandidateSearchResponse,
  TeamArchiveResponse,
  TeamProjectSummary,
  TeamProjectView,
  TeamResponse,
  TeamRole,
  TeamRoleSkillInput,
} from '@shared/api.interface';
import {
  teamApi,
  talentApi,
} from '@/api';
import { logger } from '@/lib/runtime';
import { useUI } from './ui-context';

interface TeamEntry {
  role: TeamRole;
  candidate: TeamCandidateOption;
}

interface BuilderState {
  mode: 'create' | 'edit';
  roleSlug: string | null;
  title: string;
  allocation: string;
  headcount: number;
  skills: TeamRoleSkillInput[];
}

interface PlanBuilderState {
  title: string;
  department: string;
  note: string;
}

const EMPTY_BUILDER: BuilderState = {
  mode: 'create',
  roleSlug: null,
  title: '',
  allocation: '50%',
  headcount: 1,
  skills: [],
};

const ALLOCATION_OPTIONS = ['20%', '30%', '50%', '80%', '100%'];
const STATUS_TEXT: Record<string, string> = {
  draft: '草稿',
  confirming: '协调确认中',
  adjusting: '需调整',
  confirmed: '组建完成',
};
const RESPONSE_TEXT: Record<string, string> = {
  pending: '待响应',
  accepted: '已接受',
  rejected: '已拒绝',
};

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: unknown } } })?.response;
  const message = response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export default function TeamPage() {
  const { showToast, openProfile } = useUI();
  const [project, setProject] = useState<TeamProjectView | null>(null);
  const [projects, setProjects] = useState<TeamProjectSummary[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<boolean>(false);
  const [activeTeamRole, setActiveTeamRole] = useState<string>('');
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [planBuilder, setPlanBuilder] = useState<PlanBuilderState | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<{ slug: string; name: string }[]>([]);
  const [savingRole, setSavingRole] = useState<boolean>(false);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [statusSaving, setStatusSaving] = useState<boolean>(false);
  const [candidateMode, setCandidateMode] = useState<'recommended' | 'search'>('recommended');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [searchResult, setSearchResult] = useState<TeamCandidateSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [mockDialog, setMockDialog] = useState<{ roleSlug: string; candidateSlug: string; name: string; action: 'accept' | 'reject'; note: string } | null>(null);
  const [mockSaving, setMockSaving] = useState(false);
  const [selectionDialog, setSelectionDialog] = useState<{ role: TeamRole; candidate: TeamCandidateOption } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [recordsTab, setRecordsTab] = useState<'history' | 'notifications'>('history');
  const [archive, setArchive] = useState<TeamArchiveResponse | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const [recordSlug, setRecordSlug] = useState('');
  const [recordProject, setRecordProject] = useState<TeamProjectView | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState(false);
  const recordsRef = useRef<HTMLElement | null>(null);

  const applyResponse = useCallback((res: TeamResponse) => {
    setProject(res.project);
    setProjects(res.projects);
    return res.project;
  }, []);

  const load = useCallback(async (projectSlug?: string) => {
    try {
      const res = await teamApi.getTeam(projectSlug);
      const next = applyResponse(res);
      setDataError(false);
      setActiveTeamRole((current) =>
        current && next.roles.some((role) => role.id === current) ? current : next.roles[0]?.id ?? '',
      );
    } catch (error) {
      // 无可见方案（如新部门尚未创建）按空态引导处理，不算加载失败
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setProject(null);
        setProjects([]);
        setDataError(false);
      } else {
        logger.error('加载项目组队数据失败', error);
        setDataError(true);
      }
    } finally {
      setDataLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!recordsExpanded) return;
    let alive = true;
    setArchiveLoading(true);
    setArchiveError(false);
    teamApi.getTeamArchive().then((result) => { if (alive) setArchive(result); })
      .catch(() => { if (alive) setArchiveError(true); })
      .finally(() => { if (alive) setArchiveLoading(false); });
    return () => { alive = false; };
  }, [recordsExpanded, project?.id, project?.updatedAt]);

  useEffect(() => {
    if (!recordSlug || !recordsExpanded) return;
    let alive = true;
    setRecordProject(null);
    setRecordLoading(true);
    setRecordError(false);
    teamApi.getTeam(recordSlug).then((result) => { if (alive) setRecordProject(result.project); })
      .catch(() => { if (alive) setRecordError(true); })
      .finally(() => { if (alive) setRecordLoading(false); });
    return () => { alive = false; };
  }, [recordSlug, recordsExpanded, project?.updatedAt]);

  // 顶栏「保存组队方案」：方案动作均已实时落库，这里做一次同步刷新并反馈真实方案状态。
  useEffect(() => {
    const handler = () => {
      void teamApi
        .getTeam(project?.id)
        .then(applyResponse)
        .then((next) => {
          const filled = Object.values(next.assignments).reduce((sum, members) => sum + members.length, 0);
          showToast(`组队方案已保存：${filled}/${next.roles.reduce((sum, role) => sum + role.headcount, 0)} 个成员名额已配置 · 当前状态「${STATUS_TEXT[next.status] ?? next.status}」。`);
        })
        .catch(() => showToast('组队方案同步失败，请稍后重试。'));
    };
    window.addEventListener('team:save', handler);
    return () => window.removeEventListener('team:save', handler);
  }, [applyResponse, showToast, project?.id]);

  const teamRoles: TeamRole[] = useMemo(() => project?.roles ?? [], [project]);
  const teamAssignments = project?.assignments ?? {};
  const teamResponses = project?.responses ?? {};
  const role: TeamRole | undefined =
    teamRoles.find((item) => item.id === activeTeamRole) || teamRoles[0];

  useEffect(() => {
    setCandidateQuery('');
    setSearchResult(null);
    setSearchError(false);
  }, [role?.id, project?.id]);

  useEffect(() => {
    if (candidateMode !== 'search' || !role || !candidateQuery.trim()) {
      setSearchResult(null);
      setSearchLoading(false);
      return;
    }
    let alive = true;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(false);
    const timer = window.setTimeout(() => {
      teamApi.searchTeamCandidates(role.id, candidateQuery.trim())
        .then((result) => { if (alive) setSearchResult(result); })
        .catch(() => { if (alive) setSearchError(true); })
        .finally(() => { if (alive) setSearchLoading(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [candidateMode, candidateQuery, role?.id, project?.updatedAt]);

  // Keep visible invitation responses current when an employee responds in another session.
  useEffect(() => {
    if (!project || !['confirming', 'adjusting'].includes(project.status)) return;
    let alive = true;
    const refresh = () => { void teamApi.getTeam(project.id).then((res) => { if (alive) applyResponse(res); }).catch(() => {}); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [project?.id, project?.status, applyResponse]);

  const handleMockResponse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mockDialog || !project || mockSaving) return;
    setMockSaving(true);
    try {
      const result = await teamApi.mockTeamResponse({ project: project.id, roleSlug: mockDialog.roleSlug,
        candidateSlug: mockDialog.candidateSlug, action: mockDialog.action,
        note: mockDialog.action === 'reject' ? mockDialog.note.trim() : undefined });
      applyResponse(result);
      setMockDialog(null);
      showToast(result.project.status === 'confirmed' ? '全员已接受邀请，组建完成。模拟飞书通知已记录。'
        : '模拟响应已保存，已为组建者生成模拟飞书通知。');
    } catch (error) { showToast(errorMessage(error, '模拟响应失败，请重试。')); }
    finally { setMockSaving(false); }
  };

  const openBuilder = useCallback(
    async (mode: 'create' | 'edit') => {
      if (project && project.status !== 'draft') {
        showToast('方案当前不在草稿状态，请先重新打开组队再调整角色。');
        return;
      }
      if (mode === 'edit' && role) {
        setBuilder({
          mode,
          roleSlug: role.id,
          title: role.title,
          allocation: role.allocation || '50%',
          headcount: role.headcount,
          skills: role.skills.map((item) => ({ skillSlug: item.skillSlug, level: item.level, type: item.type })),
        });
      } else {
        setBuilder({ ...EMPTY_BUILDER });
      }
      if (!skillCatalog.length) {
        try {
          const catalog = await talentApi.getTalentCatalog();
          setSkillCatalog(catalog.skills);
        } catch (error) {
          logger.error('加载技能目录失败', error);
          showToast('技能目录加载失败，请稍后重试。');
        }
      }
    },
    [role, project, skillCatalog.length, showToast],
  );

  const openPlanBuilder = useCallback(async () => {
    setPlanBuilder({ title: '', department: departments[0] ?? '', note: '' });
    if (!departments.length) {
      try {
        setDepartments(await teamApi.getTeamDepartments());
      } catch (error) {
        logger.error('加载部门列表失败', error);
        showToast('部门列表加载失败，请稍后重试。');
      }
    }
  }, [departments, showToast]);

  useEffect(() => {
    if (planBuilder && !departments.length) {
      teamApi
        .getTeamDepartments()
        .then((list) => {
          setDepartments(list);
          setPlanBuilder((prev) => (prev && !prev.department ? { ...prev, department: list[0] ?? '' } : prev));
        })
        .catch(() => showToast('部门列表加载失败，请稍后重试。'));
    }
  }, [planBuilder, departments.length, showToast]);

  const handleCreatePlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!planBuilder || savingPlan) return;
    if (!planBuilder.title.trim()) {
      showToast('请填写方案名称。');
      return;
    }
    if (!planBuilder.department) {
      showToast('请选择方案归属部门。');
      return;
    }
    setSavingPlan(true);
    try {
      const res = await teamApi.createTeamProject({
        title: planBuilder.title.trim(),
        department: planBuilder.department,
        note: planBuilder.note.trim() || undefined,
      });
      applyResponse(res);
      setActiveTeamRole(res.project.roles[0]?.id ?? '');
      setPlanBuilder(null);
      showToast(`组队方案「${res.project.title}」已创建，归属部门：${res.project.department}。其他部门不可见。`);
    } catch (error) {
      logger.error('创建组队方案失败', error);
      showToast(errorMessage(error, '创建方案失败，请稍后重试。'));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!builder || !project || savingRole) return;
    if (!builder.title.trim()) {
      showToast('请填写角色名称。');
      return;
    }
    if (!builder.skills.length) {
      showToast('请至少设置 1 项技能要求。');
      return;
    }
    setSavingRole(true);
    const input = {
      title: builder.title.trim(),
      allocation: builder.allocation,
      headcount: builder.headcount,
      skills: builder.skills,
    };
    try {
      if (builder.mode === 'edit' && builder.roleSlug) {
        await teamApi.updateTeamRole(builder.roleSlug, input);
        showToast(`「${input.title}」的需求已更新，推荐候选将按新条件重新计算。`);
      } else {
        const created = await teamApi.createTeamRole({ ...input, project: project.id });
        setActiveTeamRole(created.id);
        showToast('新角色已加入组队方案，候选推荐已按技能数据生成。');
      }
      applyResponse(await teamApi.getTeam(project.id));
      setBuilder(null);
    } catch (error) {
      logger.error('保存项目角色失败', error);
      showToast(errorMessage(error, '保存角色失败，请稍后重试。'));
    } finally {
      setSavingRole(false);
    }
  };

  const handleAssign = (roleItem: TeamRole, option: TeamCandidateOption, acknowledged = false) => {
    if (assigning) return;
    if (option.assignedElsewhere) {
      showToast(`${option.name} 已承担其他角色，请先在该角色下移除后再选择。`);
      return;
    }
    if (option.recentParticipations.length && !acknowledged) {
      setSelectionDialog({ role: roleItem, candidate: option });
      return;
    }
    setAssigning(true);
    teamApi
      .assignTeamMember(roleItem.id, option.candidateSlug, acknowledged)
      .then(applyResponse)
      .then((next) => {
        const assignedRole = next.roles.find((item) => item.id === roleItem.id);
        const assignedOption = assignedRole?.members.find((item) => item.candidateSlug === option.candidateSlug);
        const skillHint = assignedOption && assignedOption.requiredMet < assignedOption.requiredTotal
          ? `注意：必需技能达标 ${assignedOption.requiredMet}/${assignedOption.requiredTotal}。`
          : '必需技能均已达标。';
        setSelectionDialog(null);
        showToast(`${option.name} 已配置到 ${roleItem.title}。${skillHint}`);
      })
      .catch((error) => {
        const data = (error as { response?: { data?: { code?: string; recentParticipations?: TeamCandidateOption['recentParticipations'] } } })?.response?.data;
        if (data?.code === 'TEAM_RECENT_PARTICIPATION' && data.recentParticipations) {
          setSelectionDialog({ role: roleItem, candidate: { ...option, recentParticipations: data.recentParticipations } });
        } else {
          logger.error('配置团队成员失败', error);
          showToast(errorMessage(error, '成员配置失败，请稍后重试。'));
        }
      }).finally(() => setAssigning(false));
  };

  const handleRemoveMember = (roleId: string, candidateSlug: string) => {
    teamApi
      .removeTeamAssignment(roleId, candidateSlug)
      .then(applyResponse)
      .catch((error) => showToast(errorMessage(error, '移除成员失败，请稍后重试。')));
  };

  const handleUnlock = () => {
    if (!project) return;
    teamApi
      .clearTeamAssignments(project.id)
      .then(applyResponse)
      .then(() => showToast('已解除全部成员锁定，可以重新组队。'))
      .catch(() => showToast('解除锁定失败，请稍后重试。'));
  };

  const handleChangeStatus = (action: 'confirm' | 'reopen') => {
    if (!project || statusSaving) return;
    setStatusSaving(true);
    teamApi
      .setTeamStatus({ action, project: project.id })
      .then(applyResponse)
      .then((next) => {
        if (action === 'confirm') {
          const invited = Object.values(next.assignments).reduce((sum, members) => sum + members.length, 0);
          showToast(
            next.status === 'confirming'
              ? `方案已进入协调确认，当前共 ${invited} 位成员，已向待响应成员生成站内邀请，可在右侧模拟响应。`
              : `方案状态：${STATUS_TEXT[next.status] ?? next.status}。`,
          );
        } else {
          showToast('组队方案已重新打开为草稿，可继续调整角色与成员，未读邀请已撤回。');
        }
      })
      .catch((error) => {
        logger.error('更新组队状态失败', error);
        showToast(errorMessage(error, '状态更新失败，请先补齐配置。'));
      })
      .finally(() => setStatusSaving(false));
  };

  const entries: TeamEntry[] = teamRoles.flatMap((role) =>
    (teamAssignments[role.id] ?? []).flatMap((candidateSlug) => {
      const candidate = role.members.find((item) => item.candidateSlug === candidateSlug);
      return candidate ? [{ role, candidate }] : [];
    }),
  );
  const assignedCount = Object.values(teamAssignments).reduce((sum, members) => sum + members.length, 0);
  const requiredHeadcount = teamRoles.reduce((sum, role) => sum + role.headcount, 0);
  const filledRoleCount = teamRoles.filter((role) => (teamAssignments[role.id]?.length ?? 0) === role.headcount).length;
  const allAssigned = teamRoles.length > 0 && filledRoleCount === teamRoles.length;
  const roleCoverage = requiredHeadcount ? Math.round(assignedCount / requiredHeadcount * 100) : 0;
  const hasConflict = (project?.conflicts.length ?? 0) > 0;
  const status = project?.status ?? 'draft';
  const rejectedRoleIds = Object.entries(teamResponses)
    .filter(([, members]) => Object.values(members).some((item) => item.state === 'rejected'))
    .map(([roleId]) => roleId);
  const acceptedRespondCount = Object.values(teamResponses).flatMap(Object.values).filter((item) => item.state === 'accepted').length;
  const rejectedRespondCount = Object.values(teamResponses).flatMap(Object.values).filter((item) => item.state === 'rejected').length;
  const pendingRespondCount = Object.values(teamResponses).flatMap(Object.values).filter((item) => item.state === 'pending').length;
  const canConfirm =
    (status === 'draft' || status === 'adjusting') && allAssigned && !hasConflict && rejectedRoleIds.length === 0;
  const editingLocked = status !== 'draft';
  const canAssignToRole = (roleId: string) => {
    if (status === 'draft') return true;
    if (status === 'adjusting') return rejectedRoleIds.includes(roleId)
      || (teamAssignments[roleId]?.length ?? 0) < (teamRoles.find((item) => item.id === roleId)?.headcount ?? 0);
    return false;
  };

  function renderPlanModal() {
    if (!planBuilder) return null;
    return (
      <div
        className="development-modal"
        onClick={(event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) setPlanBuilder(null);
        }}
      >
        <form className="development-card" onSubmit={handleCreatePlan}>
          <h3>新建组队方案</h3>
          <p>方案按归属部门隔离：只有该部门的管理者与创建人可见，其他部门互相不可见。</p>
          <label>
            方案名称
            <input
              value={planBuilder.title}
              placeholder="例如：数据治理专项组队"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setPlanBuilder({ ...planBuilder, title: event.target.value })
              }
            />
          </label>
          <label>
            归属部门
            <select
              value={planBuilder.department}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setPlanBuilder({ ...planBuilder, department: event.target.value })
              }
            >
              <option value="" disabled>
                请选择部门
              </option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            备注（可选）
            <input
              value={planBuilder.note}
              placeholder="例如：Q4 数据平台建设"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setPlanBuilder({ ...planBuilder, note: event.target.value })
              }
            />
          </label>
          <div className="development-actions">
            <button type="button" onClick={() => setPlanBuilder(null)}>
              取消
            </button>
            <button type="submit" disabled={savingPlan}>
              {savingPlan ? '创建中…' : '创建方案'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderPlanHead(compact: boolean) {
    if (!project) return null;
    return (
      <section className="team-project-head panel">
        <div className="team-plan-bar">
          <select
            className="team-plan-switch"
            value={project?.id ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void load(event.target.value)}
            aria-label="切换组队方案"
          >
            {projects.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title} · {item.department}（{STATUS_TEXT[item.status] ?? item.status}）
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void openPlanBuilder()}>
            ＋ 新建方案
          </button>
          <button type="button" onClick={() => { setRecordsExpanded(true); recordsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>历史与协调通知</button>
        </div>
        <div className="team-project-copy">
          <span>
            组队方案 · {STATUS_TEXT[status] ?? status} · 归属 {project.department} · 发起人 {project.creatorName || '—'}
          </span>
          <h2>{project.title}</h2>
          <p>
            {project.period} · {teamRoles.length} 个角色 · {project.note}
          </p>
        </div>
        {!compact ? (
          <div className="team-progress" aria-label="组队进度">
            <div className="done">
              <i>1</i>
              <span>
                <b>定义角色</b>
                <small>已完成</small>
              </span>
            </div>
            <em></em>
            <div className={allAssigned && status === 'draft' ? 'active' : allAssigned ? 'done' : 'active'}>
              <i>2</i>
              <span>
                <b>选择成员</b>
                <small>{allAssigned ? '已完成' : '进行中'}</small>
              </span>
            </div>
            <em></em>
            <div className={status === 'confirming' || status === 'adjusting' ? 'active' : status === 'confirmed' ? 'done' : ''}>
              <i>3</i>
              <span>
                <b>协调确认</b>
                <small>
                  {status === 'confirming' ? '进行中' : status === 'adjusting' ? '有拒绝' : status === 'confirmed' ? '已完成' : '待开始'}
                </small>
              </span>
            </div>
            <em></em>
            <div className={status === 'confirmed' ? 'done' : ''}>
              <i>4</i>
              <span>
                <b>组建完成</b>
                <small>{status === 'confirmed' ? '全员已接受' : '待确认'}</small>
              </span>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="team-head-action"
          id="new-team-role"
          onClick={() => void openBuilder('create')}
          disabled={editingLocked}
        >
          ＋ 添加角色
        </button>
      </section>
    );
  }

  function renderRecords() {
    if (!project) return null;
    const summaries = archive?.projects ?? projects;
    return (
      <section ref={recordsRef} className="panel team-notification-panel" aria-label="组队历史与协调通知">
        <h3>历史与协调通知</h3><p>这里汇总所有可见组队方案。新建或切换当前方案后，仍可查看此前方案的整体内容、员工抉择及协调通知。</p>
        <div className="team-source-tabs" role="group" aria-label="历史记录分类">
          <button type="button" aria-pressed={recordsExpanded && recordsTab === 'history'} onClick={() => { setRecordsTab('history'); setRecordsExpanded(true); }}>历史组队方案（{summaries.length}）</button>
          <button type="button" aria-pressed={recordsExpanded && recordsTab === 'notifications'} onClick={() => { setRecordsTab('notifications'); setRecordsExpanded(true); }}>协调通知（{archive?.notifications.length ?? '…'}）</button>
          {recordsExpanded ? <button type="button" onClick={() => setRecordsExpanded(false)}>收起记录</button> : null}
        </div>
        {recordsExpanded && archiveLoading ? <p role="status">正在加载全部方案记录…</p> : null}
        {recordsExpanded && archiveError ? <p role="alert">历史记录加载失败。<button type="button" onClick={() => { setRecordsExpanded(false); }}>关闭后重试</button></p> : null}
        {recordsExpanded && recordsTab === 'history' ? <div className="team-archive-layout">
          <div className="team-archive-projects" aria-label="历史组队方案列表">
            {summaries.map((item) => <button type="button" className="team-archive-card" key={item.slug} aria-pressed={recordSlug === item.slug} onClick={() => setRecordSlug(item.slug)}>
              <b>{item.title}</b><span>{STATUS_TEXT[item.status]} · {item.department} · {item.roleCount} 个角色{item.slug === project.id ? ' · 当前方案' : ''}</span>
              <small>组建者：{item.creatorName || '未登记'} · 更新于 {item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '未登记'}</small>
            </button>)}
            {!summaries.length ? <p>暂无历史组队方案。</p> : null}
          </div>
          <div className="team-archive-detail" aria-label="历史方案详情">
            {recordLoading ? <p role="status">正在加载方案详情…</p> : recordError ? <p role="alert">方案详情加载失败。<button type="button" onClick={() => { setRecordSlug(''); }}>重新选择方案</button></p> : recordProject ? <>
              <h3>{recordProject.title}</h3><p>{STATUS_TEXT[recordProject.status]} · {recordProject.department} · 组建者：{recordProject.creatorName || '未登记'} · 只读查看</p>
              <p>{[recordProject.period, recordProject.note].filter(Boolean).join(' · ') || '未填写周期或备注'}</p>
              {recordProject.roles.map((item) => <section className="team-archive-role" key={item.id}>
                <h4>{item.title} · 需要 {item.headcount} 人 · 投入 {item.allocation}</h4>
                <p>{item.skills.map((skill) => `${skill.type === 'required' ? '必需' : '加分'} ${skill.name} L${skill.level}`).join('；')}</p>
                {item.members.length ? item.members.map((member) => {
                  const response = recordProject.responses[item.id]?.[member.candidateSlug];
                  return <div className={`team-history-member ${response?.state ?? 'pending'}`} key={member.candidateSlug}>
                    <b>{member.name}</b> · {RESPONSE_TEXT[response?.state ?? 'pending']}{response?.source === 'mock' ? ' · Mock' : ''}
                    {response?.state === 'rejected' ? <p>拒绝理由：{response.note || '未填写理由'}</p> : null}
                  </div>;
                }) : <p>该角色尚未选择成员。</p>}
              </section>)}
              {!recordProject.roles.length ? <p>该方案尚未定义角色。</p> : null}
              <details className="team-history-entry"><summary>查看该方案的历次成员抉择与变更记录（{recordProject.history.length}）</summary>
                {recordProject.history.map((entry) => <details className="team-history-entry" key={entry.id}>
                  <summary><b>{entry.description}</b><small>{new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })} · {entry.actorName} · {STATUS_TEXT[entry.snapshot.status]}</small></summary>
                  <p>{entry.snapshot.title} · 当时状态：{STATUS_TEXT[entry.snapshot.status]}</p>
                  <p>角色要求：{entry.snapshot.roles.map((item) => `${item.title} ${item.headcount} 人 / ${item.allocation}`).join('；') || '未配置角色'}</p>
                  {entry.snapshot.members.map((member, index) => <div className={`team-history-member ${member.response}`} key={`${member.candidateSlug}-${index}`}>
                    <b>{member.name}</b> · {member.roleTitle} · {RESPONSE_TEXT[member.response]}{member.source === 'mock' ? ' · Mock' : ''}
                    {member.response === 'rejected' ? <p>拒绝理由：{member.note || '未填写理由'}</p> : null}
                  </div>)}
                </details>)}
              </details>
            </> : <p>点击左侧方案名称，查看该组队方案的完整内容及员工的接受、拒绝和拒绝理由。</p>}
          </div>
        </div> : null}
        {recordsExpanded && recordsTab === 'notifications' ? <div>
          <p>按组队方案归类；包含邀请、撤回及响应信息。已绑定飞书的成员可通过真实消息卡片响应邀请。</p>
          {summaries.map((item) => {
            const notices = archive?.notifications.filter((notice) => notice.projectSlug === item.slug) ?? [];
            if (!notices.length) return null;
            return <section className="team-archive-notifications" key={item.slug}>
              <h4>{item.title}</h4>
              {notices.map((notice) => <article className={`team-notification ${notice.decision ?? 'neutral'}`} key={notice.id}>
                <b>{item.title} · {notice.event === 'invite' ? '组队邀请' : notice.decision === 'accepted' ? '✓ 成员已接受' : notice.decision === 'rejected' ? '✕ 成员已拒绝' : '响应通知'}</b><span>{notice.event === 'response' ? '成员响应通知' : '组队邀请通知'} · 收件人：{notice.recipientName} · {notice.state === 'withdrawn' ? '已撤回 · 保留记录' : '已记录'}</span>
                <p>{notice.body}</p><small>{new Date(notice.createdAt).toLocaleString('zh-CN', { hour12: false })}</small>
              </article>)}
            </section>;
          })}
          {!archiveLoading && !archiveError && !archive?.notifications.length ? <p>所有可见方案暂无协调通知。</p> : null}
        </div> : null}
      </section>
    );
  }

  function renderRoleModal() {
    if (!builder) return null;
    return (
        <div
          className="development-modal"
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) setBuilder(null);
          }}
        >
          <form className="development-card" onSubmit={handleSaveRole}>
            <h3>{builder.mode === 'edit' ? '编辑角色需求' : '添加项目角色'}</h3>
            <p>技能条件来自技能目录，候选推荐按有效认证技能实时计算。</p>
            <label>
              角色名称
              <input
                value={builder.title}
                placeholder="例如：数据平台工程师"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setBuilder({ ...builder, title: event.target.value })
                }
              />
            </label>
            <div className="builder-row">
              <label>
                人数
                <select
                  value={builder.headcount}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setBuilder({ ...builder, headcount: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((count) => (
                    <option key={count} value={count}>
                      {count} 人
                    </option>
                  ))}
                </select>
              </label>
              <label>
                投入比例
                <select
                  value={builder.allocation}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setBuilder({ ...builder, allocation: event.target.value })
                  }
                >
                  {ALLOCATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="builder-skills">
              <span>技能要求</span>
              {builder.skills.map((skill, index) => (
                <div className="builder-skill-row" key={`${skill.skillSlug}-${index}`}>
                  <select
                    value={skill.skillSlug}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                      const skills = [...builder.skills];
                      skills[index] = { ...skill, skillSlug: event.target.value };
                      setBuilder({ ...builder, skills });
                    }}
                  >
                    {skillCatalog.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={skill.level}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                      const skills = [...builder.skills];
                      skills[index] = { ...skill, level: Number(event.target.value) };
                      setBuilder({ ...builder, skills });
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        L{level}
                      </option>
                    ))}
                  </select>
                  <select
                    value={skill.type}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                      const skills = [...builder.skills];
                      skills[index] = { ...skill, type: event.target.value as TeamRoleSkillInput['type'] };
                      setBuilder({ ...builder, skills });
                    }}
                  >
                    <option value="required">必需</option>
                    <option value="bonus">加分</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder({ ...builder, skills: builder.skills.filter((_, i) => i !== index) })
                    }
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="builder-add-skill"
                disabled={!skillCatalog.length}
                onClick={() =>
                  setBuilder({
                    ...builder,
                    skills: [
                      ...builder.skills,
                      { skillSlug: skillCatalog[0]?.slug ?? '', level: 2, type: 'required' },
                    ],
                  })
                }
              >
                ＋ 添加技能要求
              </button>
            </div>
            <div className="development-actions">
              <button type="button" data-close-development onClick={() => setBuilder(null)}>
                取消
              </button>
              <button type="submit" disabled={savingRole || !skillCatalog.length}>
                {savingRole ? '保存中…' : '保存角色'}
              </button>
            </div>
          </form>
        </div>

    );
  }

  if (dataLoading) {
    return (
      <section className="page active" id="team">
        <section className="team-project-head panel">
          <div className="empty-candidates">
            <b>正在加载组队方案…</b>
            <p>正在按真实认证技能计算候选推荐。</p>
          </div>
        </section>
      </section>
    );
  }
  if (dataError) {
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
  if (!project) {
    return (
      <section className="page active" id="team">
        <section className="team-project-head panel">
          <div className="empty-candidates">
            <b>还没有可见的组队方案</b>
            <p>各部门的方案相互隔离：你可以为本部门创建组队方案，或查看自己创建的方案。</p>
            <button type="button" className="primary" onClick={() => void openPlanBuilder()}>
              ＋ 新建组队方案
            </button>
          </div>
          {planBuilder ? renderPlanModal() : null}
        </section>
      </section>
    );
  }
  if (!role || teamRoles.length === 0) {
    return (
      <section className="page active" id="team">
        {planBuilder ? renderPlanModal() : null}
        {renderPlanHead(true)}
        {renderRoleModal()}
        {renderRecords()}
        <section className="team-builder-layout">
          <aside className="panel team-role-panel">
            <div className="empty-candidates">
              <b>方案已创建，还没有角色</b>
              <p>点击右上角「添加角色」定义第一个项目角色及必需技能要求。</p>
            </div>
          </aside>
        </section>
      </section>
    );
  }

  return (
    <section className="page active" id="team">
      {planBuilder ? renderPlanModal() : null}
      {renderPlanHead(false)}
      <div className="team-builder-layout">
        <aside className="panel team-role-panel">
          <div className="team-panel-title">
            <div>
              <h3>项目角色</h3>
              <p>
                <b id="filled-role-count">{filledRoleCount}</b> / {teamRoles.length} 已配置
              </p>
            </div>
            <button
              type="button"
              id="edit-team-requirement"
              onClick={() => void openBuilder('edit')}
              disabled={editingLocked}
            >
              编辑当前角色
            </button>
          </div>
          <div id="team-role-list" className="team-role-list">
            {teamRoles.map((item, index) => {
              const members = teamAssignments[item.id] ?? [];
              const assigned = item.members.filter((option) => members.includes(option.candidateSlug));
              const rejected = rejectedRoleIds.includes(item.id);
              const full = members.length === item.headcount;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`team-role-item ${item.id === role.id ? 'active' : ''} ${rejected ? 'rejected' : ''}`}
                  onClick={() => setActiveTeamRole(item.id)}
                >
                  <span className="role-index">0{index + 1}</span>
                  <span>
                    <b>{item.title}</b>
                    <small>
                      {assigned.length
                        ? `${assigned.map((person) => person.name).join('、')} · ${members.length}/${item.headcount} 人`
                        : `${item.headcount} 人 · 投入 ${item.allocation}`}
                    </small>
                  </span>
                  <i className={`role-fill-state ${full ? 'filled' : ''} ${rejected ? 'warn' : ''}`}>
                    {rejected ? '已拒绝' : full ? '已配齐' : members.length ? '待补齐' : '待选择'}
                  </i>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="panel team-match-panel">
          <div className="team-match-head">
            <div>
              <span id="active-role-kicker">当前角色</span>
              <h3 id="active-role-title">{role.title}</h3>
              <p id="active-role-meta">
                需要 {role.headcount} 人 · 至少投入 {role.allocation}
                {rejectedRoleIds.includes(role.id)
                  ? ' · 成员已拒绝，请重新选择人员'
                  : ''}
              </p>
            </div>
          </div>
          <div className="role-skill-line" id="active-role-skills">
            {role.skills.map((skill) => (
              <span key={skill.skillSlug} className={skill.type === 'bonus' ? 'bonus' : ''}>
                {skill.type === 'bonus' ? '加分' : '必需'} · {skill.name} L{skill.level}
              </span>
            ))}
          </div>
          <div className="team-recommendation-note">
            <span>推荐逻辑</span>
            <p id="active-role-reason">
              按全员有效期内的已认证技能逐项比对：先算必需技能达标数，再按加分技能与投入情况排序。
            </p>
          </div>
          <div className="team-candidate-controls">
            <div className="team-source-tabs" role="group" aria-label="候选人来源">
              <button type="button" aria-pressed={candidateMode === 'recommended'} onClick={() => setCandidateMode('recommended')}>系统推荐</button>
              <button type="button" aria-pressed={candidateMode === 'search'} onClick={() => setCandidateMode('search')}>搜索员工</button>
            </div>
            {candidateMode === 'search' ? <label className="team-search-field">按姓名、员工标识、部门或岗位搜索
              <input aria-label="搜索组队员工" placeholder="输入员工姓名、部门或岗位" value={candidateQuery} maxLength={100}
                onChange={(event) => setCandidateQuery(event.target.value)} />
            </label> : <small>根据当前角色技能要求推荐候选人；也可以自行搜索员工。</small>}
            {candidateMode === 'search' && searchResult ? <small>找到 {searchResult.total} 位员工{searchResult.total > 50 ? '，展示前 50 位，请细化搜索词' : ''}</small> : null}
          </div>
          <div id="team-candidate-list" className="team-candidate-list" aria-live="polite">
            {(candidateMode === 'search' ? searchResult?.candidates ?? [] : role.recommendations).map((option) => {
              const conflict = option.insufficient || Boolean(option.assignedElsewhere);
              const memberState = teamResponses[role.id]?.[option.candidateSlug]?.state;
              const selectable = canAssignToRole(role.id) && !option.assignedHere
                && ((teamAssignments[role.id]?.length ?? 0) < role.headcount || (status === 'adjusting' && rejectedRoleIds.includes(role.id)));
              return (
                <article className="team-candidate" key={option.candidateSlug}>
                  <i className={`talent-avatar ${option.avatarTone}`}>{option.avatar}</i>
                  <div className="team-candidate-main">
                    <button
                      type="button"
                      className="team-profile-link"
                      onClick={() => openProfile(option.candidateSlug)}
                    >
                      {option.name} · {option.org}
                    </button>
                    <small>
                      {option.roleTitle} · 必需技能达标 {option.requiredMet}/{option.requiredTotal}
                      {option.bonusTotal > 0 ? ` · 加分 ${option.bonusMet}/${option.bonusTotal}` : ''}
                      {' · '}
                      {option.tier === 'direct' ? '完全匹配' : option.tier === 'adjacent' ? '部分匹配' : '潜力候选'}
                    </small>
                    <div className="team-candidate-tags">
                      {option.evidence.slice(0, 3).map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                      {option.evidence.length === 0 ? <span>暂无相关有效认证</span> : null}
                      <span className={option.insufficient ? 'warn' : ''}>{option.availabilityText}</span>
                      {option.assignedElsewhere ? <span className="warn">已被其他角色选用</span> : null}
                      {option.declinedPreviously ? <span className="warn">曾拒绝本方案 · 仅搜索可见</span> : null}
                      {option.recentParticipations.length ? <span className="warn">最近 90 天有 {option.recentParticipations.length} 条其他组队记录 · 选择需再次确认</span> : null}
                    </div>
                  </div>
                  <div className="team-candidate-action">
                    <button
                      type="button"
                      className={option.assignedHere ? `assigned ${memberState ?? 'pending'}` : ''}
                      disabled={!selectable || assigning}
                      onClick={() => handleAssign(role, option)}
                    >
                      {option.assignedHere ? memberState === 'rejected' ? '✕ 已拒绝' : memberState === 'accepted' ? '✓ 已接受' : '✓ 已选定' : conflict ? '仍选此人' : '选择此人'}
                    </button>
                    <small>
                      {option.assignedHere
                        ? memberState === 'rejected' ? '该成员已拒绝，请调整人选' : '已加入当前角色'
                        : !selectable
                        ? status === 'draft'
                          ? '角色人数已满，请先移除成员'
                          : status === 'confirming'
                          ? '协调确认中，暂不可调整'
                          : status === 'adjusting' ? '人选已配齐，请重新发起协调确认' : '已全员确认，重开组队后可调整'
                        : option.tier === 'direct'
                        ? '技能完全达标'
                        : option.tier === 'adjacent'
                        ? '部分技能待补'
                        : '备选方案'}
                    </small>
                  </div>
                </article>
              );
            })}
            {candidateMode === 'search' && (searchLoading || searchError || !candidateQuery.trim() || searchResult?.total === 0) ? (
              <div className="shortlist-empty">{searchLoading ? '正在搜索员工…' : searchError ? '搜索失败，请修改搜索词重试。'
                : !candidateQuery.trim() ? '输入搜索词，查找推荐列表以外的员工。' : '未找到符合搜索词的在职员工。'}</div>
            ) : candidateMode === 'recommended' && role.recommendations.length === 0 ? (
              <div className="shortlist-empty">暂无可推荐员工，可切换到搜索员工。</div>
            ) : null}
          </div>
        </section>
        <aside className="panel team-summary-panel">
          <div className="team-summary-head">
            <div>
              <span>当前团队</span>
              <h3>
                <b id="team-member-count">{assignedCount}</b> / {requiredHeadcount} 人
              </h3>
            </div>
            <button
              type="button"
              id="unlock-team"
              onClick={handleUnlock}
              disabled={assignedCount === 0 || editingLocked}
            >
              解除锁定
            </button>
          </div>
          {status !== 'draft' ? <div className="team-response-overview" role="status">
            <b>{status === 'confirmed' ? '✓ 组建完成' : status === 'adjusting' ? rejectedRespondCount > 0 ? '有成员拒绝，需调整人选' : '人选已调整，待重新协调' : '等待成员响应'}</b>
            <p><span className="accepted">✓ 已接受 {acceptedRespondCount}</span><span className="rejected">✕ 已拒绝 {rejectedRespondCount}</span><span>◷ 待响应 {pendingRespondCount}</span></p>
            <small>全员接受后，系统自动进入「组建完成」。</small>
          </div> : null}
          {project.mockResponsesEnabled && ['confirming', 'adjusting'].includes(status) ? <div className="team-mock-notice">
            <b>员工响应 · Mock 演示</b><p>点击成员下方「模拟响应」演示接受或拒绝；飞书通知仅模拟记录。</p>
          </div> : null}
          <div id="team-member-list" className="team-member-list">
            {entries.length ? (
              entries.map(({ role: memberRole, candidate }) => {
                const response = teamResponses[memberRole.id]?.[candidate.candidateSlug];
                const responseState = response?.state ?? 'pending';
                return (
                  <div className={`team-member ${responseState}`} key={`${memberRole.id}:${candidate.candidateSlug}`}>
                    <i className={`talent-avatar ${candidate.avatarTone}`}>{candidate.avatar}</i>
                    <span>
                      <b>
                        {candidate.name}
                        <i
                          className={`member-response ${responseState}`}
                          aria-label={`邀请状态：${RESPONSE_TEXT[responseState]}`}
                        >
                          {responseState === 'accepted' ? '✓ ' : responseState === 'rejected' ? '✕ ' : '◷ '}{RESPONSE_TEXT[responseState]}
                        </i>
                      </b>
                      <small>
                        {memberRole.title} · {memberRole.allocation}
                      </small>
                      {responseState === 'rejected' ? <small className="team-reject-note">拒绝理由：{response?.note || '未填写理由'}</small> : null}
                      {response?.source === 'mock' ? <small className="team-mock-label">Mock 模拟响应</small> : null}
                      {response?.respondedAt ? <small>{new Date(response.respondedAt).toLocaleString('zh-CN', { hour12: false })}</small> : null}
                      {project.mockResponsesEnabled && ['confirming', 'adjusting'].includes(status) && responseState === 'pending' ?
                        <button type="button" className="team-mock-trigger" aria-label={`模拟${candidate.name}的响应`}
                          onClick={() => setMockDialog({ roleSlug: memberRole.id, candidateSlug: candidate.candidateSlug, name: candidate.name, action: 'accept', note: '' })}>模拟响应</button> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(memberRole.id, candidate.candidateSlug)}
                      disabled={status !== 'draft' && !(status === 'adjusting' && responseState === 'rejected')}
                    >
                      移除
                    </button>
                  </div>
                );
              })
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
              <b id="skill-coverage">{project.skillCoverage}%</b>
            </div>
            <i>
              <em id="skill-coverage-track" style={{ width: `${project.skillCoverage}%` }}></em>
            </i>
          </div>
          {status === 'adjusting' ? (
            <div className="team-alert" id="team-alert-adjusting">
              <b>{rejectedRoleIds.length > 0 ? `${rejectedRoleIds.length} 个角色被拒绝，需调整` : '拒绝成员已替换，请重新发起协调确认'}</b>
              {rejectedRoleIds.map((roleId) => {
                const rejectedRole = teamRoles.find((item) => item.id === roleId);
                const note = Object.values(teamResponses[roleId] ?? {}).filter((item) => item.state === 'rejected').map((item) => item.note).filter(Boolean).join('；');
                return (
                  <p key={roleId}>
                    「{rejectedRole?.title ?? roleId}」{note ? `：${note}` : '：成员已拒绝，请重新选择人员'}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className={`team-alert ${hasConflict ? '' : 'resolved'}`} id="team-alert">
              {hasConflict ? (
                <>
                  <b>{project.conflicts.length} 项待处理冲突</b>
                  {project.conflicts.map((item) => (
                    <p key={`${item.kind}-${item.candidateSlug}`}>{item.detail}</p>
                  ))}
                </>
              ) : (
                <>
                  <b>当前无成员冲突</b>
                  <p>
                    {status === 'confirming'
                      ? `邀请已发出，等待 ${pendingRespondCount} 位成员响应。`
                      : project.pendingAvailabilityCount > 0
                      ? `${project.pendingAvailabilityCount} 位成员的投入比例未登记，确认前需与本人及管理者沟通。`
                      : '已选成员的可投入比例均满足当前角色要求。'}
                  </p>
                </>
              )}
            </div>
          )}
          {status === 'confirming' || status === 'confirmed' ? (
            <button
              type="button"
              className="primary team-confirm"
              id="reopen-team"
              disabled={statusSaving}
              onClick={() => handleChangeStatus('reopen')}
            >
              {statusSaving ? '处理中…' : '重新打开组队'}
            </button>
          ) : (
            <button
              type="button"
              className="primary team-confirm"
              id="confirm-team"
              disabled={!canConfirm || statusSaving}
              onClick={() => handleChangeStatus('confirm')}
            >
              {statusSaving ? '提交中…' : status === 'adjusting' ? '重新发起协调确认' : '进入协调确认'}
            </button>
          )}
          <small>
            {status === 'confirming'
              ? '成员可在平台首页或已送达的飞书卡片中接受或拒绝。全员接受后自动组建完成。'
              : status === 'adjusting'
              ? rejectedRoleIds.length > 0
                ? '请为被拒绝的角色重新选择人员，完成后重新发起协调确认。'
                : '被拒绝的角色已重新配置成员，可重新发起协调确认。'
              : status === 'confirmed'
              ? '全员已接受邀请，方案组建完成；如需调整请重新打开组队。'
              : canConfirm
              ? '进入协调确认后，将生成成员邀请；已绑定飞书的成员会收到真实卡片，响应后更新组队状态。'
              : allAssigned && hasConflict
              ? '存在待处理冲突，调整后才能进入协调确认。'
              : `还需配置 ${Math.max(0, requiredHeadcount - assignedCount)} 位成员，全部名额配齐后才能进入协调确认。`}
          </small>
        </aside>
      </div>
      {renderRecords()}
      {selectionDialog ? <div className="development-modal">
        <div className="development-card team-participation-dialog" role="dialog" aria-modal="true" aria-label="确认选择近期参与组队的员工">
          <h3>再次确认选择员工</h3><p>「{selectionDialog.candidate.name}」最近 90 天有以下其他组队记录，请核实投入后再选择。待响应表示曾被选入，尚未确认接受。</p>
          <div className="team-participation-list">{selectionDialog.candidate.recentParticipations.map((item, index) => <article key={index}>
            <b>{item.projectTitle}</b><p>{item.roleTitle} · {STATUS_TEXT[item.status]} · {RESPONSE_TEXT[item.response]}</p><small>记录于 {new Date(item.recordedAt).toLocaleString('zh-CN', { hour12: false })}</small>
          </article>)}</div>
          <p>是否仍将该员工加入「{selectionDialog.role.title}」？</p>
          <div className="development-actions"><button type="button" disabled={assigning} onClick={() => setSelectionDialog(null)}>取消选择</button><button type="button" disabled={assigning} onClick={() => handleAssign(selectionDialog.role, selectionDialog.candidate, true)}>{assigning ? '加入中…' : '确认仍选择该员工'}</button></div>
        </div>
      </div> : null}
      {mockDialog ? <div className="development-modal" onClick={(event) => { if (event.target === event.currentTarget && !mockSaving) setMockDialog(null); }}>
        <form className="development-card team-response-dialog" onSubmit={handleMockResponse} role="dialog" aria-modal="true" aria-label="模拟成员响应">
          <h3>模拟成员响应 <span className="team-mock-label">Mock</span></h3><p>模拟 {mockDialog.name} 对组队邀请的决定。响应后会更新方案状态，并生成给组建者的模拟飞书通知。</p>
          <div className="team-response-options" role="group" aria-label="响应选择">
            <button type="button" className="accepted" aria-pressed={mockDialog.action === 'accept'} onClick={() => setMockDialog({ ...mockDialog, action: 'accept' })}>✓ 接受邀请</button>
            <button type="button" className="rejected" aria-pressed={mockDialog.action === 'reject'} onClick={() => setMockDialog({ ...mockDialog, action: 'reject' })}>✕ 拒绝邀请</button>
          </div>
          {mockDialog.action === 'reject' ? <label>拒绝理由（选填）<textarea maxLength={255} rows={3} placeholder="可以不填写，最多 255 字" value={mockDialog.note} onChange={(event) => setMockDialog({ ...mockDialog, note: event.target.value })} /></label> : null}
          <div className="development-actions"><button type="button" disabled={mockSaving} onClick={() => setMockDialog(null)}>取消</button><button type="submit" disabled={mockSaving}>{mockSaving ? '保存中…' : '保存模拟响应'}</button></div>
        </form>
      </div> : null}
      {renderRoleModal()}
    </section>
  );
}
