import { useEffect, useState } from 'react';
import '@client/src/styles/legacy.css';
import { PAGE_TITLE_MAP, UIProvider, isManagerSurface, useUI } from './ui-context';
import { CertificationProvider, useCertifications } from './certification-context';
import type { PageId } from './types';
import OverviewPage from './OverviewPage';
import JudgingPage from './JudgingPage';
import IDPPage from './IDPPage';
import EvidencePage from './EvidencePage';
import PositionsPage from './PositionsPage';
import ManagerPage from './ManagerPage';
import ProfilePage from './ProfilePage';
import ApprovalPage from './ApprovalPage';
import TalentPage from './TalentPage';
import SuccessionPage from './SuccessionPage';
import TeamPage from './TeamPage';
import EmployeeLookup from './EmployeeLookup';
import { EmployeeWorkspaceProvider, useEmployeeWorkspace, workspaceUpdateLabel } from './employee-workspace-context';
import { AuthGate, useAuth } from './auth-context';
import { teamApi } from '@/api';
import type { TeamInviteItem } from '@shared/api.interface';
import './auth.css';
import ValidationInbox from './ValidationInbox';
import FactCenterPage from './FactCenterPage';
import FeishuPanel from './FeishuPanel';
import ColleaguesPage from './ColleaguesPage';

/** 员工首页的组队邀请横幅：协调确认发出的邀请在此接受/拒绝 */
function TeamInviteBanner() {
  const { showToast } = useUI();
  const [invites, setInvites] = useState<TeamInviteItem[]>([]);
  const [rejecting, setRejecting] = useState<TeamInviteItem | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void teamApi.getTeamInvites().then((list) => { if (alive) setInvites(list); }).catch(() => {}); };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const respond = async (invite: TeamInviteItem, action: 'accept' | 'reject') => {
    if (busy) return;
    setBusy(invite.id);
    try {
      setInvites(await teamApi.respondTeamInvite({ roleSlug: invite.roleSlug, project: invite.projectSlug, action,
        note: action === 'reject' ? note.trim() : undefined }));
      setRejecting(null);
      setNote('');
      showToast(action === 'accept' ? '已接受组队邀请，通知已记录，飞书送达状态以实际发送结果为准。' : '已拒绝邀请，已通知组建者查看处理结果。');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(typeof message === 'string' && message ? message : '响应失败，请稍后重试。');
    } finally { setBusy(null); }
  };
  if (!invites.length) return null;
  return (
    <div className="team-invite-banner" aria-label="我的组队邀请">
      {invites.map((invite) => (
        <div className={`team-invite-item ${invite.state}`} key={invite.id}>
          <div>
            <b>{invite.state === 'accepted' ? '✓ 已接受组队邀请' : invite.state === 'rejected' ? '✕ 已拒绝组队邀请' : '◷ 待响应的组队邀请'}</b>
            <p>{invite.creatorName || '项目发起人'} 邀请你加入「{invite.projectTitle}」，担任 <b>{invite.roleTitle}</b></p>
            {invite.state === 'rejected' ? <p className="team-reject-note">拒绝理由：{invite.note || '未填写理由'}</p> : null}
            {invite.source === 'mock' ? <small className="team-mock-label">Mock 模拟响应</small> : null}
          </div>
          {invite.state === 'pending' ? <div className="team-invite-actions">
            <button type="button" className="primary" disabled={!!busy} onClick={() => void respond(invite, 'accept')}>接受邀请</button>
            <button type="button" disabled={!!busy} onClick={() => { setRejecting(invite); setNote(''); }}>拒绝</button>
          </div> : <span className={`member-response ${invite.state}`}>{invite.state === 'accepted' ? '已接受' : '已拒绝'}</span>}
        </div>
      ))}
      {rejecting ? <div className="development-modal">
        <form className="development-card team-response-dialog" role="dialog" aria-modal="true" aria-label="拒绝组队邀请"
          onSubmit={(event) => { event.preventDefault(); void respond(rejecting, 'reject'); }}>
          <h3>拒绝组队邀请</h3><p>拒绝「{rejecting.projectTitle}」邀请后，组建者可以查看你的回复。</p>
          <label>拒绝理由（选填）<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} rows={3} placeholder="可以不填写，最多 255 字" /></label>
          <div className="development-actions"><button type="button" disabled={!!busy} onClick={() => setRejecting(null)}>取消</button><button type="submit" disabled={!!busy}>{busy ? '提交中…' : '确认拒绝'}</button></div>
        </form>
      </div> : null}
    </div>
  );
}
const EMPLOYEE_NAV: { page: PageId; icon: string; label: string; count?: 'evidence' }[] = [
  { page: 'overview', icon: '⌂', label: '成长概览' },
  { page: 'idp', icon: '◈', label: '个人发展计划' },
  { page: 'evidence', icon: '✦', label: '技能池', count: 'evidence' },
];

const MANAGER_NAV: { page: PageId; icon: string; label: string; count?: 'approval' }[] = [
  { page: 'positions', icon: '▤', label: '岗位管理' },
  { page: 'manager', icon: '▦', label: '团队概览' },
  { page: 'approval', icon: '✓', label: '认证与复核', count: 'approval' },
  { page: 'talent', icon: '⌕', label: '人才搜索' },
  { page: 'succession', icon: '◇', label: '梯队与继任' },
  { page: 'team', icon: '＋', label: '项目组队' },
];

function renderActivePage(page: PageId) {
  switch (page) {
    case 'overview': return <OverviewPage />;
    case 'judging': return <JudgingPage />;
    case 'idp': return <IDPPage />;
    case 'evidence': return <EvidencePage />;
    case 'colleagues': return <ColleaguesPage />;
    case 'positions': return <PositionsPage />;
    case 'manager': return <ManagerPage />;
    case 'profile': return <ProfilePage />;
    case 'approval': return <ApprovalPage />;
    case 'talent': return <TalentPage />;
    case 'succession': return <SuccessionPage />;
    case 'team': return <TeamPage />;
    case 'factCenter': return <FactCenterPage />;
    default: return <OverviewPage />;
  }
}

const AppShell = () => {
  const { user, config, signOut } = useAuth();
  const { page, navigate, toast, showToast } = useUI();
  const { readyCount, pendingApprovalCount, setSelfApplication } = useCertifications();
  const { workspace, error: workspaceError, refreshing, refresh } = useEmployeeWorkspace();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [title, subtitle, action] = PAGE_TITLE_MAP[page];
  const managerSurface = isManagerSurface(page);
  const canUseManagerWorkspace = user.personnelRole !== 'employee';
  // 全项目功能统一：所有可进入管理侧的角色共用同一套「管理者工作台」，
  // 差异只体现在菜单项按权限增减（HR 最全）与各页面数据范围上。
  const managerWorkspaceLabel = '管理者工作台';
  const managerNav = MANAGER_NAV.filter(item => user.personnelRole === 'hr' || ['manager', 'positions', 'approval', 'talent', 'team'].includes(item.page));
  const dataUpdateTitle = workspaceError ?? (workspace
    ? `临时显示最近成功查询数据库的时间：${workspace.loadedAt}；每 10 秒检索一次，不代表数据发生变动。正式接入外部事实中心后按每 5 分钟及相关操作即时检查。`
    : '正在查询数据库');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLookupOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handlePrimaryAction = () => {
    if (page === 'colleagues') { document.getElementById('colleagues-search')?.focus(); return; }
    if (page === 'positions') { window.dispatchEvent(new Event('positions:import')); return; }
    if (page === 'manager') { window.dispatchEvent(new Event('manager:export')); return; }
    if (page === 'factCenter') { window.dispatchEvent(new Event('fact-center:refresh')); return; }
    if (page === 'idp') {
      window.dispatchEvent(new Event('idp:export'));
      return;
    }
    if (page === 'evidence') {
      setSelfApplication(true);
      return;
    }
    if (page === 'talent') {
      window.dispatchEvent(new Event('talent:save'));
      return;
    }
    if (page === 'succession') {
      window.dispatchEvent(new Event('succession:export'));
      return;
    }
    if (page === 'team') {
      window.dispatchEvent(new Event('team:save'));
      return;
    }
    if (page === 'profile') {
      showToast('画像摘要已导出，内容遵循当前查看权限。');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>技能树</strong><small>Talent Signal</small></div></div>
        <div className="sidebar-nav-section">
          <h2>员工工作台</h2>
          <nav className="nav-group" aria-label="员工工作台">
            {EMPLOYEE_NAV.map((item) => (
              <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)}>
                <i aria-hidden="true">{item.icon}</i>{item.label}
                {item.count === 'evidence' && <span className="count">{readyCount}</span>}
              </button>
            ))}
          </nav>
        </div>
        {canUseManagerWorkspace && <div className="sidebar-nav-section">
          <h2>{managerWorkspaceLabel}</h2>
          <nav className="nav-group" aria-label={managerWorkspaceLabel}>
            {managerNav.map((item) => (
              <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)}>
                <i aria-hidden="true">{item.icon}</i>{item.label}
                {item.count === 'approval' && <span className="count">{pendingApprovalCount}</span>}
              </button>
            ))}
          </nav>
        </div>}
        <div className="sidebar-foot">
          <div className="avatar">{workspace?.employee.avatar ?? user.name.slice(0, 1)}</div><div><strong>{workspace?.employee.name ?? user.name}</strong><small>{workspace?.employee.role ?? user.username}</small></div><button type="button" aria-label="账户与登录" title="账户与登录" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}>•••</button>
        </div>
        {accountMenuOpen && <div className="account-menu">
          <strong>{user.name}</strong><small>本地账号：{user.username}</small>
          <a href={config.feishuEnabled && !user.feishuLinked ? '/api/auth/feishu/start?link=1' : undefined} className={!config.feishuEnabled || user.feishuLinked ? 'disabled' : ''}>{user.feishuLinked ? '飞书身份已绑定' : config.feishuEnabled ? '绑定飞书身份' : '飞书应用待配置'}</a>
          <FeishuPanel />
          <button type="button" onClick={() => { void signOut(); }}>退出 / 切换账号</button>
        </div>}
      </aside>

      <main>
        {config.validationMode && <div className="validation-banner">隔离验证环境 · 工作材料、候选技能和通知均为测试样本，不代表员工真实经历</div>}
        <TeamInviteBanner />
        <header className="topbar">
          <div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="top-actions">
            {config.validationMode && <ValidationInbox />}
            <button className={`employee-lookup-trigger ${managerSurface && canUseManagerWorkspace ? '' : 'hidden'}`} aria-expanded={lookupOpen} aria-controls="employee-lookup" onClick={() => setLookupOpen(true)}>
              <span>⌕</span> 搜索员工
            </button>
            <button
              className="ghost"
              onClick={workspaceError ? () => { void refresh(); } : undefined}
              disabled={refreshing}
              title={dataUpdateTitle}
            >{workspaceError ? '数据读取失败 · 重试' : workspaceUpdateLabel(workspace?.loadedAt ?? null, page === 'profile' ? '画像更新于' : '数据更新于')}</button>
            <button className="primary" onClick={handlePrimaryAction}>{action}</button>
          </div>
        </header>

        {renderActivePage(page)}
      </main>

      {canUseManagerWorkspace && <EmployeeLookup open={lookupOpen} onClose={() => setLookupOpen(false)} />}

      <div className={`toast ${toast ? '' : 'hidden'}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
};

const Home = () => (
  <AuthGate>
    <UIProvider>
      <EmployeeWorkspaceProvider>
        <CertificationProvider>
          <AppShell />
        </CertificationProvider>
      </EmployeeWorkspaceProvider>
    </UIProvider>
  </AuthGate>
);

export default Home;
