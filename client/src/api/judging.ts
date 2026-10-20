import type {
  JudgingCandidatesResponse,
  JudgingGapDetail,
  JudgingOverview,
} from '@shared/api.interface';
import { axiosForBackend, logger } from '@/lib/runtime';

export async function getOverview(): Promise<JudgingOverview> {
  try {
    const res = await axiosForBackend.request<JudgingOverview>({ url: '/api/judging/overview', method: 'GET' });
    return res.data;
  } catch (error) {
    logger.error('获取资格判定失败', error);
    throw error;
  }
}

export async function getGap(track: string, level: string): Promise<JudgingGapDetail> {
  try {
    const res = await axiosForBackend.request<JudgingGapDetail>({
      url: '/api/judging/gap',
      method: 'GET',
      params: { track, level },
    });
    return res.data;
  } catch (error) {
    logger.error('获取 Gap 明细失败', error);
    throw error;
  }
}

export async function getCandidates(): Promise<JudgingCandidatesResponse> {
  try {
    const res = await axiosForBackend.request<JudgingCandidatesResponse>({
      url: '/api/judging/candidates',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取候选失败', error);
    throw error;
  }
}

export async function dismissCandidate(key: string): Promise<{ key: string; cooldownUntil: string }> {
  try {
    const res = await axiosForBackend.request<{ key: string; cooldownUntil: string }>({
      url: '/api/judging/candidates/dismiss',
      method: 'POST',
      data: { key },
    });
    return res.data;
  } catch (error) {
    logger.error('忽略候选失败', error);
    throw error;
  }
}
