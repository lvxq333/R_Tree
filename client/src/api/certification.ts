import type {
  ApprovalAction,
  ApprovalItem,
  ApprovalRemindResult,
  ApprovalStats,
  CertificationDecision,
  CertificationItem,
  ManagerReviewInput,
  SelfApplicationInput,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function listCertifications(): Promise<CertificationItem[]> {
  try {
    const res = await axiosForBackend.request<CertificationItem[]>({
      url: '/api/certifications',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取认证列表失败', error);
    throw error;
  }
}

export async function getCertification(id: string): Promise<CertificationItem> {
  try {
    const res = await axiosForBackend.request<CertificationItem>({
      url: `/api/certifications/${id}`,
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取认证详情失败', error);
    throw error;
  }
}

export async function submitSelfApplication(
  input: SelfApplicationInput,
): Promise<{ certification: CertificationItem; approval: ApprovalItem }> {
  try {
    const res = await axiosForBackend.request<{
      certification: CertificationItem;
      approval: ApprovalItem;
    }>({
      url: '/api/certifications/self-application',
      method: 'POST',
      data: input,
    });
    return res.data;
  } catch (error) {
    logger.error('提交主动点亮申请失败', error);
    throw error;
  }
}

export async function decideCertification(
  id: string,
  decision: CertificationDecision,
  comment?: string,
): Promise<void> {
  try {
    await axiosForBackend.request<void>({
      url: `/api/certifications/${id}/decision`,
      method: 'POST',
      data: { decision, comment },
    });
  } catch (error) {
    logger.error('提交认证决策失败', error);
    throw error;
  }
}

export async function listApprovals(): Promise<ApprovalItem[]> {
  try {
    const res = await axiosForBackend.request<ApprovalItem[]>({
      url: '/api/approvals',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取审批列表失败', error);
    throw error;
  }
}

/** 员工工作台「我的申请」：本人提交的审批单及真实催办状态 */
export async function listMyApprovals(): Promise<ApprovalItem[]> {
  try {
    const res = await axiosForBackend.request<ApprovalItem[]>({
      url: '/api/approvals/mine',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取我的申请列表失败', error);
    throw error;
  }
}

/** 催办：由服务端写入催办记录并返回最新催办状态，限流与上限均在后端判定 */
export async function remindApproval(slug: string, note?: string): Promise<ApprovalRemindResult> {
  try {
    const res = await axiosForBackend.request<ApprovalRemindResult>({
      url: `/api/approvals/${slug}/remind`,
      method: 'POST',
      data: { note },
    });
    return res.data;
  } catch (error) {
    logger.error('发起催办失败', error);
    throw error;
  }
}

export async function getApprovalStats(): Promise<ApprovalStats> {
  try {
    const res = await axiosForBackend.request<ApprovalStats>({
      url: '/api/approvals/stats',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取审批统计失败', error);
    throw error;
  }
}

export async function submitManagerReview(
  input: ManagerReviewInput,
): Promise<void> {
  try {
    await axiosForBackend.request<void>({
      url: '/api/approvals/manager-review',
      method: 'POST',
      data: input,
    });
  } catch (error) {
    logger.error('提交管理者复核失败', error);
    throw error;
  }
}

export async function decideApproval(
  id: string,
  action: ApprovalAction,
  comment: string,
): Promise<void> {
  try {
    await axiosForBackend.request<void>({
      url: `/api/approvals/${id}/decide`,
      method: 'POST',
      data: { action, comment },
    });
  } catch (error) {
    logger.error('提交审批决定失败', error);
    throw error;
  }
}
