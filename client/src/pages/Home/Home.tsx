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

const EMPLOYEE_NAV: { page: PageId; icon: string; label: string; count?: 'evidence' }[] = [
  { page: 'overview', icon: '⌂', label: '成长概览' },
  { page: 'judging', icon: '◎', label: '资格自查' },
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
    case 'manager': return <ManagerPage />;
    case 'profile': return <ProfilePage />;
    case 'approval': return <ApprovalPage />;
    case 'talent': return <TalentPage />;
    case 'succession': return <SuccessionPage />;
    case 'team': return <TeamPage />;
    default: return <OverviewPage />;
  }
}

const AppShell = () => {
  const { user, config, signOut } = useAuth();
  const { role, page, navigate, setRole, toast, showToast } = useUI();
  const { readyCount, pendingApprovalCount, setSelfApplication } = useCertifications();
  const { workspace, error: workspaceError, refreshing, refresh } = useEmployeeWorkspace();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [title, subtitle, action] = PAGE_TITLE_MAP[page];
  const managerSurface = isManagerSurface(page);
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
    if (page === 'evidence') {
      setSelfApplication(true);
      return;
    }
    if (page === 'talent') {
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
        <div className="workspace-switch">
          <span>当前工作台</span>
          <button onClick={() => setRoleMenuOpen((open: boolean) => !open)}>{role === 'manager' ? '管理者工作台 ' : '员工工作台 '}<span>⌄</span></button>
        </div>
        <nav className={`nav-group ${role === 'manager' ? 'hidden' : ''}`}>
          {EMPLOYEE_NAV.map((item) => (
            <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)}>
              <i>{item.icon}</i>{item.label}
              {item.count === 'evidence' && <span className="count">{readyCount}</span>}
            </button>
          ))}
        </nav>
        <nav className={`nav-group ${role === 'manager' ? '' : 'hidden'}`}>
          {MANAGER_NAV.map((item) => (
            <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)}>
              <i>{item.icon}</i>{item.label}
              {item.count === 'approval' && <span className="count">{pendingApprovalCount}</span>}
            </button>
          ))}
        </nav>
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
          <div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="top-actions">
            {config.validationMode && <ValidationInbox />}
            <button className={`employee-lookup-trigger ${managerSurface ? '' : 'hidden'}`} aria-expanded={lookupOpen} aria-controls="employee-lookup" onClick={() => setLookupOpen(true)}>
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

        {roleMenuOpen && (
          <div className="role-menu">
            <button onClick={() => { setRole('employee'); setRoleMenuOpen(false); }}><b>员工工作台</b><span>我的成长与能力证明</span></button>
            <button disabled={user.accessRole !== 'manager'} title={user.accessRole === 'manager' ? undefined : '当前账号为员工角色'} onClick={() => { setRole('manager'); setRoleMenuOpen(false); }}><b>管理者工作台</b><span>团队能力与人才配置</span></button>
          </div>
        )}

        {renderActivePage(page)}
      </main>

      <EmployeeLookup open={lookupOpen} onClose={() => setLookupOpen(false)} />

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
