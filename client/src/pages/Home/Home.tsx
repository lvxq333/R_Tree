import { useEffect, useState } from 'react';
import '@client/src/styles/legacy.css';
import { PAGE_TITLE_MAP, UIProvider, isManagerSurface, useUI } from './ui-context';
import { CertificationProvider, useCertifications } from './certification-context';
import type { PageId } from './types';
import OverviewPage from './OverviewPage';
import JudgingPage from './JudgingPage';
import IDPPage from './IDPPage';
import EvidencePage from './EvidencePage';
import ManagerPage from './ManagerPage';
import ProfilePage from './ProfilePage';
import ApprovalPage from './ApprovalPage';
import TalentPage from './TalentPage';
import SuccessionPage from './SuccessionPage';
import TeamPage from './TeamPage';
import EmployeeLookup from './EmployeeLookup';
import { EmployeeWorkspaceProvider, useEmployeeWorkspace, workspaceUpdateLabel } from './employee-workspace-context';
import { AuthGate, useAuth } from './auth-context';
import './auth.css';
import ValidationInbox from './ValidationInbox';
import FactCenterPage from './FactCenterPage';
import ColleaguesPage from './ColleaguesPage';
const EMPLOYEE_NAV: { page: PageId; icon: string; label: string; count?: 'evidence' }[] = [
  { page: 'overview', icon: '⌂', label: '成长概览' },
  { page: 'idp', icon: '◈', label: '个人发展计划' },
  { page: 'evidence', icon: '✦', label: '技能池', count: 'evidence' },
];

const MANAGER_NAV: { page: PageId; icon: string; label: string; count?: 'approval' }[] = [
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
  const managerWorkspaceLabel = user.personnelRole === 'expert' ? '专家工作台' : '管理者工作台';
  const managerNav = MANAGER_NAV.filter(item => user.personnelRole === 'hr' || ['manager', 'approval', 'talent'].includes(item.page));
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
      if (user.personnelRole === 'expert') { document.getElementById('expert-talent-search')?.focus(); return; }
      showToast('人才需求已保存，可继续调整条件或维护候选清单。');
      return;
    }
    if (page === 'succession') {
      showToast('梯队盘点摘要已生成，包含岗位风险、候选差距和培养动作。');
      return;
    }
    if (page === 'team') {
      showToast('组队方案已保存为草稿。');
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
          <button type="button" onClick={() => { void signOut(); }}>退出 / 切换账号</button>
        </div>}
      </aside>

      <main>
        {config.validationMode && <div className="validation-banner">隔离验证环境 · 工作材料、候选技能和通知均为测试样本，不代表员工真实经历</div>}
        <header className="topbar">
          <div><h1>{title}</h1><p>{page==='factCenter' && user.personnelRole==='expert'?'查看本部门及指派员工的事实与汇总宽表':page==='talent' && user.personnelRole==='expert'?'按权限查找本部门及指派员工':subtitle}</p></div>
          <div className="top-actions">
            {config.validationMode && <ValidationInbox />}
            <button className={`employee-lookup-trigger ${managerSurface && user.personnelRole==='hr' ? '' : 'hidden'}`} aria-expanded={lookupOpen} aria-controls="employee-lookup" onClick={() => setLookupOpen(true)}>
              <span>⌕</span> 搜索员工
            </button>
            <button
              className="ghost"
              onClick={workspaceError ? () => { void refresh(); } : undefined}
              disabled={refreshing}
              title={dataUpdateTitle}
            >{workspaceError ? '数据读取失败 · 重试' : workspaceUpdateLabel(workspace?.loadedAt ?? null, page === 'profile' ? '画像更新于' : '数据更新于')}</button>
            <button className="primary" onClick={handlePrimaryAction}>{page==='talent' && user.personnelRole==='expert'?'搜索人才':action}</button>
          </div>
        </header>

        {renderActivePage(page)}
      </main>

      {user.personnelRole==='hr' && <EmployeeLookup open={lookupOpen} onClose={() => setLookupOpen(false)} />}

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
