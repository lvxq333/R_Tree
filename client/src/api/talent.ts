import type {
  ShortlistResponse,
  TalentCandidatesResponse,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getTalentCandidates(): Promise<TalentCandidatesResponse> {
  try {
    const res = await axiosForBackend.request<TalentCandidatesResponse>({
      url: '/api/talent/candidates',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取人才候选人失败', error);
    throw error;
  }
}

export async function getShortlist(): Promise<ShortlistResponse> {
  try {
    const res = await axiosForBackend.request<ShortlistResponse>({
      url: '/api/talent/shortlist',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取候选清单失败', error);
    throw error;
  }
}

export async function addToShortlist(
  candidateSlug: string,
): Promise<ShortlistResponse> {
  try {
    const res = await axiosForBackend.request<ShortlistResponse>({
      url: `/api/talent/shortlist/${candidateSlug}`,
      method: 'POST',
    });
    return res.data;
  } catch (error) {
    logger.error('加入候选清单失败', error);
    throw error;
  }
}

export async function removeFromShortlist(
  candidateSlug: string,
): Promise<ShortlistResponse> {
  try {
    const res = await axiosForBackend.request<ShortlistResponse>({
      url: `/api/talent/shortlist/${candidateSlug}`,
      method: 'DELETE',
    });
    return res.data;
  } catch (error) {
    logger.error('从候选清单移除失败', error);
    throw error;
  }
}

export async function clearShortlist(): Promise<ShortlistResponse> {
  try {
    const res = await axiosForBackend.request<ShortlistResponse>({
      url: '/api/talent/shortlist',
      method: 'DELETE',
    });
    return res.data;
  } catch (error) {
    logger.error('清空候选清单失败', error);
    throw error;
  }
}
