import { useAuth } from './auth-context';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PageId, Role } from './types';

export const PAGE_TITLE_MAP: Record<PageId, [string, string, string]> = {
  overview: ['成长概览', '聚焦目标、差距与下一步行动', '更新成长计划'],
  evidence: ['技能池', '查看当前技能、成长信号与点亮进度', '申请点亮技能'],
  idp: ['个人职业发展计划', '基于个人情况与 Gap 生成的 24 个月职业生涯规划', '导出 IDP'],
  manager: ['团队概览', '看见能力供需、梯队风险与培养动作', '导出盘点摘要'],
  approval: ['认证与复核', '核对证据与等级锚点，处理技能升级、维持与降级', '批量处理'],
  talent: ['人才搜索', '从项目需要出发，找到有依据、可协调的候选人', '保存人才需求'],
  profile: ['员工画像', '查看核心特征、能力依据与发展方向', '导出画像摘要'],
  succession: ['梯队与继任', '识别关键岗位风险，推动继任准备与培养动作', '导出梯队盘点'],
  team: ['项目组队', '按角色覆盖能力，同时检查投入与组织冲突', '保存组队方案'],
};

export const MANAGER_PAGES: PageId[] = ['manager', 'approval', 'talent', 'succession', 'team', 'profile'];

export function isManagerSurface(page: PageId): boolean {
  return MANAGER_PAGES.includes(page);
}

interface UIContextValue {
  role: Role;
  page: PageId;
  navigate: (page: PageId) => void;
  setRole: (role: Role) => void;
  profileId: string;
  profileReturnPage: PageId;
  openProfile: (id: string) => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const initialPage: PageId = user.accessRole === 'manager' || !isManagerSurface(readInitialPage()) ? readInitialPage() : 'overview';
  const [role, setRoleState] = useState<Role>(() =>
    isManagerSurface(initialPage) ? 'manager' : 'employee',
  );
  const [page, setPage] = useState<PageId>(initialPage);
  const [profileId, setProfileId] = useState<string>(user.employeeSlug);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnPageRef = useRef<PageId>('manager');

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const navigate = useCallback((target: PageId) => {
    if (isManagerSurface(target) && user.accessRole !== 'manager') target = 'overview';
    setPage(target);
    setRoleState(isManagerSurface(target) ? 'manager' : 'employee');
    try {
      window.history.replaceState(null, '', `#${target}`);
    } catch {
      /* preview may restrict history */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user.accessRole]);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    navigate(next === 'manager' ? 'manager' : 'overview');
  }, [navigate]);

  const openProfile = useCallback((id: string) => {
    if (user.accessRole !== 'manager') return;
    setProfileId(id);
    setPage((current: PageId) => {
      if (current !== 'profile') returnPageRef.current = current;
      return 'profile';
    });
    setRoleState('manager');
    try {
      window.history.replaceState(null, '', '#profile');
    } catch {
      /* preview may restrict history */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user.accessRole]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1) as PageId;
      if (hash in PAGE_TITLE_MAP) navigate(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [navigate]);

  const value = useMemo<UIContextValue>(() => ({
    role,
    page,
    navigate,
    setRole,
    profileId,
    profileReturnPage: returnPageRef.current,
    openProfile,
    toast,
    showToast,
  }), [role, page, navigate, setRole, profileId, openProfile, toast, showToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

function readInitialPage(): PageId {
  const hash = window.location.hash.slice(1) as PageId;
  return hash in PAGE_TITLE_MAP ? hash : 'overview';
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
}
