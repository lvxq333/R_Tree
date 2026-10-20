import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { EmployeeWorkspaceResponse } from '@shared/api.interface';
import { getCurrentWorkspace } from '@/api/employee';
import { logger } from '@/lib/runtime';

interface EmployeeWorkspaceContextValue {
  workspace: EmployeeWorkspaceResponse | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const EmployeeWorkspaceContext = createContext<EmployeeWorkspaceContextValue | null>(null);

export function EmployeeWorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<EmployeeWorkspaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setRefreshing(true);
    try {
      const result = await getCurrentWorkspace();
      if (request === generation.current) {
        setWorkspace(result);
        setError(null);
      }
    } catch (cause) {
      logger.error('读取员工工作台基础数据失败', cause);
      if (request === generation.current) setError('员工基础数据加载失败，请点击顶部数据按钮重试。');
    } finally {
      inFlight.current = false;
      if (request === generation.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => { window.clearInterval(timer); generation.current++; };
  }, [refresh]);

  return <EmployeeWorkspaceContext.Provider value={{ workspace, error, refreshing, refresh }}>{children}</EmployeeWorkspaceContext.Provider>;
}

export function useEmployeeWorkspace(): EmployeeWorkspaceContextValue {
  const value = useContext(EmployeeWorkspaceContext);
  if (!value) throw new Error('员工工作台上下文尚未初始化');
  return value;
}

export function workspaceUpdateLabel(lastChangedAt: string | null, prefix = '数据更新于'): string {
  if (!lastChangedAt) return `${prefix} —`;
  const date = new Date(lastChangedAt);
  if (!Number.isFinite(date.getTime())) return `${prefix} —`;
  const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  const options: Intl.DateTimeFormatOptions = calendar.format(date) === calendar.format(new Date())
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }
    : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  return `${prefix} ${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...options }).format(date)}`;
}
