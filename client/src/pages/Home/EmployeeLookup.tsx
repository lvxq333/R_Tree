import { useEffect, useRef, useState } from 'react';
import { employeeApi } from '@/api';
import { logger } from '@/lib/runtime';
import type { EmployeeListItem } from '@shared/api.interface';
import { useUI } from './ui-context';

interface LookupEntry {
  id: string;
  name: string;
  avatar: string;
  tone: string;
  role: string;
  meta: string;
  searchText: string;
}

function toLookupEntry(item: EmployeeListItem): LookupEntry {
  return {
    id: item.id,
    name: item.name,
    avatar: item.avatar,
    tone: item.tone,
    role: item.role,
    meta: item.org,
    // 降级：接口目录仅含基础字段，搜索文本退化为 name + role + org（不含技能与特质关键词）
    searchText: `${item.name} ${item.role} ${item.org}`,
  };
}

interface EmployeeLookupProps {
  open: boolean;
  onClose: () => void;
}

const EmployeeLookup = ({ open, onClose }: EmployeeLookupProps) => {
  const { openProfile } = useUI();
  const [query, setQuery] = useState<string>('');
  const [catalogue, setCatalogue] = useState<LookupEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    employeeApi.listEmployees()
      .then((items: EmployeeListItem[]) => {
        if (!cancelled) setCatalogue(items.map((item: EmployeeListItem) => toLookupEntry(item)));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取员工目录失败', error);
          setLoadError('员工目录加载失败，请稍后重试');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const items = catalogue
    .filter((item: LookupEntry) => `${item.name} ${item.role} ${item.meta} ${item.searchText}`.toLowerCase().includes(normalized))
    .slice(0, 7);

  const handleSelect = (id: string) => {
    openProfile(id);
    onClose();
  };

  return (
    <div className={`employee-lookup ${open ? '' : 'hidden'}`} onClick={(event) => event.stopPropagation()}>
      <label htmlFor="employee-lookup-input"><span>⌕</span><input
        id="employee-lookup-input"
        ref={inputRef}
        autoComplete="off"
        placeholder="搜索姓名、岗位或技能"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      /></label>
      <div className="employee-lookup-list" role="listbox" aria-label="员工搜索结果">
        {loadError ? <div className="employee-lookup-empty">{loadError}</div>
          : items.length > 0 ? items.map((item: LookupEntry) => (
            <button
              className="employee-lookup-item"
              role="option"
              key={item.id}
              onClick={() => handleSelect(item.id)}
            >
              <i className={item.tone || ''}>{item.avatar}</i>
              <span><b>{item.name}</b><small>{item.role} · {item.meta.split(' · ')[0]}</small></span>
              <span>→</span>
            </button>
          )) : <div className="employee-lookup-empty">没有找到匹配的员工</div>}
      </div>
      <small>仅搜索你有权限查看的员工画像</small>
    </div>
  );
};

export default EmployeeLookup;
