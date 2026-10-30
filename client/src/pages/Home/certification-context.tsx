import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { logger } from '@/lib/runtime';
import { certificationApi } from '@/api';
import { useUI } from './ui-context';
import type {
  ApprovalAction,
  ApprovalItem,
  ApprovalStats,
  CertificationDecision,
  CertificationFilter,
  CertificationItem,
  ManagerReviewInput,
  SelfApplicationInput,
} from '@shared/api.interface';

/* 类型统一使用 shared 契约；re-export 维持原有导入路径与名称 */
export type {
  ApprovalAction,
  ApprovalItem,
  ApprovalStats,
  CertificationDecision,
  CertificationFilter,
  CertificationItem,
  ManagerReviewInput,
  SelfApplicationInput,
} from '@shared/api.interface';

interface CertificationContextValue {
  certifications: CertificationItem[];
  approvals: ApprovalItem[];
  approvalStats: ApprovalStats | null;
  loading: boolean;
  error: string | null;
  readyCount: number;
  pendingApprovalCount: number;
  selfApplicationOpen: boolean;
  setSelfApplication: (open: boolean) => void;
  selectedCertificationId: string | null;
  selectCertification: (id: string) => void;
  openCertification: (id: string) => void;
  submitSelfApplication: (input: SelfApplicationInput) => Promise<void>;
  decideApproval: (approvalId: string, action: ApprovalAction, comment: string) => Promise<void>;
  submitManagerReview: (input: ManagerReviewInput) => Promise<void>;
  certificationFilter: CertificationFilter;
  setCertificationFilter: (filter: CertificationFilter) => void;
  decideCertification: (certificationId: string, action: CertificationDecision, comment?: string) => Promise<void>;
}

const CertificationContext = createContext<CertificationContextValue | null>(null);

const LOAD_ERROR_MESSAGE = '认证与审批数据加载失败，请刷新页面重试。';
const ACTION_ERROR_MESSAGE = '操作失败，请稍后重试。';

export function CertificationProvider({ children }: { children: ReactNode }): JSX.Element {
  const { navigate, showToast } = useUI();
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalStats, setApprovalStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selfApplicationOpen, setSelfApplicationState] = useState<boolean>(false);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string | null>(null);
  const [certificationFilter, setCertificationFilter] = useState<CertificationFilter>('all');

  const refetchCertifications = useCallback(async (): Promise<void> => {
    const items: CertificationItem[] = await certificationApi.listCertifications();
    setCertifications(items);
  }, []);

  const refetchApprovals = useCallback(async (): Promise<void> => {
    const [items, stats] = await Promise.all([
      certificationApi.listApprovals(),
      certificationApi.getApprovalStats(),
    ]);
    setApprovals(items);
    setApprovalStats(stats);
  }, []);

  useEffect(() => {
    const update = () => { void Promise.all([refetchCertifications(),refetchApprovals()]).catch(()=>setError(LOAD_ERROR_MESSAGE)); };
    window.addEventListener('validation:updated',update);
    return ()=>window.removeEventListener('validation:updated',update);
  },[refetchCertifications,refetchApprovals]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const [certificationItems, approvalItems, stats] = await Promise.all([
          certificationApi.listCertifications(),
          certificationApi.listApprovals(),
          certificationApi.getApprovalStats(),
        ]);
        if (cancelled) return;
        setCertifications(certificationItems);
        setApprovals(approvalItems);
        setApprovalStats(stats);
        setError(null);
      } catch (loadError) {
        logger.error('加载认证与审批数据失败', loadError);
        if (!cancelled) setError(LOAD_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelfApplication = useCallback((open: boolean) => {
    setSelfApplicationState(open);
  }, []);

  const selectCertification = useCallback((id: string) => {
    setSelectedCertificationId(id);
  }, []);

  const openCertification = useCallback((id: string) => {
    setSelectedCertificationId(id);
    setCertificationFilter('all');
    navigate('evidence');
  }, [navigate]);

  const submitSelfApplication = useCallback(async (input: SelfApplicationInput): Promise<void> => {
    try {
      const { certification } = await certificationApi.submitSelfApplication(input);
      await Promise.all([refetchCertifications(), refetchApprovals()]);
      setSelectedCertificationId(certification.id);
      setCertificationFilter('all');
      setSelfApplicationState(false);
      showToast('主动申请已提交，当前状态为“审批中”。');
    } catch (submitError) {
      logger.error('提交主动点亮申请失败', submitError);
      const serverMessage = axios.isAxiosError(submitError)
        ? submitError.response?.data?.message ?? submitError.response?.data?.error?.message : null;
      showToast(typeof serverMessage === 'string' ? serverMessage : ACTION_ERROR_MESSAGE);
      throw submitError;
    }
  }, [refetchApprovals, refetchCertifications, showToast]);

  const decideCertification = useCallback(async (
    certificationId: string,
    action: CertificationDecision,
    comment?: string,
  ): Promise<void> => {
    try {
      await certificationApi.decideCertification(certificationId, action, comment);
      await Promise.all([refetchCertifications(), refetchApprovals()]);
      if (action === 'add-evidence' || action === 'explain') {
        showToast(action === 'add-evidence'
          ? '近期成果已提交，复核期间当前等级保持有效。'
          : '情况说明已提交，管理者会在复核时一并查看。');
        return;
      }
      if (action === 'dismiss') {
        showToast('已暂不申请，你之后仍可从历史建议中恢复。');
        return;
      }
      showToast('点亮申请已提交，审批通过后技能等级才会正式生效。');
    } catch (decideError) {
      logger.error('提交认证决策失败', decideError);
      showToast(ACTION_ERROR_MESSAGE);
      throw decideError;
    }
  }, [refetchApprovals, refetchCertifications, showToast]);

  const decideApproval = useCallback(async (
    approvalId: string,
    action: ApprovalAction,
    comment: string,
  ): Promise<void> => {
    const item = approvals.find((entry: ApprovalItem) => entry.id === approvalId);
    if (!item) return;
    if (item.kind === 'downgrade' && !comment) {
      showToast('请先填写复核意见，说明本次判断依据。');
      return;
    }
    if ((action === 'return' || action === 'reject') && !comment) {
      showToast('退回或驳回申请时，请先填写审批意见。');
      return;
    }
    try {
      await certificationApi.decideApproval(approvalId, action, comment);
      await Promise.all([refetchCertifications(), refetchApprovals()]);
      if (item.kind === 'downgrade') {
        showToast(action === 'downgrade'
          ? `${item.applicant} 的${item.title}已确认降至 L${item.targetLevel}，员工将收到结果与申诉入口。`
          : action === 'maintain'
            ? `已确认维持 ${item.applicant} 的${item.title} L${item.currentLevel}。`
            : '观察期已延长 3 个月，当前正式等级保持有效。');
        return;
      }
      showToast(action === 'approve'
        ? `已通过 ${item.applicant} 的申请，${item.title} L${item.targetLevel} 已正式点亮。`
        : action === 'return'
          ? '申请已退回补充，员工会收到审批意见。'
          : '申请已驳回，审批原因已记录。');
    } catch (decideError) {
      logger.error('提交审批决定失败', decideError);
      showToast(ACTION_ERROR_MESSAGE);
      throw decideError;
    }
  }, [approvals, refetchApprovals, refetchCertifications, showToast]);

  const submitManagerReview = useCallback(async (input: ManagerReviewInput): Promise<void> => {
    try {
      await certificationApi.submitManagerReview(input);
      await refetchApprovals();
      showToast(`已发起 ${input.personName} 的${input.skill} L${input.currentLevel} → L${input.targetLevel} 复核，员工将收到通知。`);
    } catch (reviewError) {
      logger.error('提交管理者复核失败', reviewError);
      showToast(ACTION_ERROR_MESSAGE);
      throw reviewError;
    }
  }, [refetchApprovals, showToast]);

  const readyCount = useMemo(() =>
    certifications.filter((item: CertificationItem) => item.status === 'ready').length,
  [certifications]);

  const pendingApprovalCount = useMemo(() =>
    approvals.filter((item: ApprovalItem) => item.status === 'pending').length,
  [approvals]);

  const value = useMemo<CertificationContextValue>(() => ({
    certifications,
    approvals,
    approvalStats,
    loading,
    error,
    readyCount,
    pendingApprovalCount,
    selfApplicationOpen,
    setSelfApplication,
    selectedCertificationId,
    selectCertification,
    openCertification,
    submitSelfApplication,
    decideApproval,
    submitManagerReview,
    certificationFilter,
    setCertificationFilter,
    decideCertification,
  }), [
    certifications,
    approvals,
    approvalStats,
    loading,
    error,
    readyCount,
    pendingApprovalCount,
    selfApplicationOpen,
    setSelfApplication,
    selectedCertificationId,
    selectCertification,
    openCertification,
    submitSelfApplication,
    decideApproval,
    submitManagerReview,
    certificationFilter,
    decideCertification,
  ]);

  return <CertificationContext.Provider value={value}>{children}</CertificationContext.Provider>;
}

export function useCertifications(): CertificationContextValue {
  const context = useContext(CertificationContext);
  if (!context) throw new Error('useCertifications must be used within CertificationProvider');
  return context;
}
