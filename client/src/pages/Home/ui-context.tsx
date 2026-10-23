import { useAuth } from './auth-context';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PageId } from './types';

export const PAGE_TITLE_MAP: Record<PageId, [string, string, string]> = {
  overview: ['成长概览', '聚焦目标、差距与下一步行动', '更新成长计划'],
  evidence: ['技能池', '查看当前技能、成长信号与点亮进度', '申请点亮技能'],
  judging: ['资格自查', '对照职称标准查看 4 项要求达标情况与 Gap', '提交申请'],
  idp: ['个人职业发展计划', '基于个人情况与 Gap 生成的 24 个月职业生涯规划', '导出 IDP'],
  colleagues: ['我的同事', '查看同部门同事的基础信息', '搜索同事'],
  manager: ['团队概览', '按权限查看技能供需、风险与成员发展', '导出盘点摘要'],
  approval: ['认证与复核', '核对证据与等级锚点，处理技能升级、维持与降级', '批量处理'],
  talent: ['人才搜索', '从项目需要出发，找到有依据、可协调的候选人', '保存人才需求'],
  profile: ['员工画像', '查看核心特征、能力依据与发展方向', '导出画像摘要'],
  succession: ['梯队与继任', '识别关键岗位风险，推动继任准备与培养动作', '导出梯队盘点'],
  team: ['项目组队', '按角色覆盖能力，同时检查投入与组织冲突', '保存组队方案'],
  factCenter: ['事实中心', '管理员工信息、查看事实记录与员工汇总宽表', '刷新汇总'],
};

export const MANAGER_PAGES: PageId[] = ['manager', 'approval', 'talent', 'succession', 'team', 'profile', 'factCenter'];

export function isManagerSurface(page: PageId): boolean {
  return MANAGER_PAGES.includes(page);
}
function canOpenManagerPage(page:PageId,personnelRole:'employee'|'hr'|'expert') {
  return !isManagerSurface(page) || personnelRole==='hr' || (personnelRole==='expert' && ['manager','approval','talent','factCenter'].includes(page));
}

interface UIContextValue {
  page: PageId;
  navigate: (page: PageId) => void;
  profileId: string;
  profileReturnPage: PageId;
  openProfile: (id: string) => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const requestedPage=window.location.hash ? readInitialPage() : user.personnelRole==='employee' ? 'overview' : 'manager';
  const initialPage: PageId = canOpenManagerPage(requestedPage,user.personnelRole) ? requestedPage : 'overview';
  const [page, setPage] = useState<PageId>(initialPage);
  const [profileId, setProfileId] = useState<string>(()=>readProfileId()??user.employeeSlug);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnPageRef = useRef<PageId>('manager');

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const navigate = useCallback((target: PageId) => {
    if (!canOpenManagerPage(target,user.personnelRole)) target = 'overview';
    setPage(target);
    try {
      if(window.location.hash!==`#${target}`)window.history.pushState(null, '', `#${target}`);
    } catch {
      /* preview may restrict history */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user.personnelRole]);

  const openProfile = useCallback((id: string) => {
    if (user.personnelRole !== 'hr') return;
    setProfileId(id);
    setPage((current: PageId) => {
      if (current !== 'profile') returnPageRef.current = current;
      return 'profile';
    });
    try {
      const target=`#profile/${encodeURIComponent(id)}`;
      if(window.location.hash!==target)window.history.pushState(null, '', target);
    } catch {
      /* preview may restrict history */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user.personnelRole]);

  useEffect(() => {
    const onHashChange = () => {
      const profile=readProfileId();
      if(profile && user.personnelRole==='hr'){setProfileId(profile);setPage('profile');return;}
      const hash = window.location.hash.slice(1) as PageId;
      if (hash in PAGE_TITLE_MAP) navigate(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {window.removeEventListener('hashchange', onHashChange);window.removeEventListener('popstate', onHashChange);};
  }, [navigate,user.personnelRole]);

  const value = useMemo<UIContextValue>(() => ({
    page,
    navigate,
    profileId,
    profileReturnPage: returnPageRef.current,
    openProfile,
    toast,
    showToast,
  }), [page, navigate, profileId, openProfile, toast, showToast]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

function readInitialPage(): PageId {
  if(readProfileId())return 'profile';
  const hash = window.location.hash.slice(1) as PageId;
  return hash in PAGE_TITLE_MAP ? hash : 'overview';
}

function readProfileId():string|null {
  const match=window.location.hash.match(/^#profile\/([a-zA-Z0-9_-]{1,64})$/);
  return match?.[1]??null;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
}
