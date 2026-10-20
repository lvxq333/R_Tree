import type {
  CareerResponse,
  GapActionsResponse,
  GapListResponse,
  GrowthEventsResponse,
  GrowthRange,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getCareer(): Promise<CareerResponse> {
  try {
    const res = await axiosForBackend.request<CareerResponse>({
      url: '/api/career',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取职业路线失败', error);
    throw error;
  }
}

export async function getGrowthEvents(
  range: GrowthRange,
): Promise<GrowthEventsResponse> {
  try {
    const res = await axiosForBackend.request<GrowthEventsResponse>({
      url: '/api/growth/events',
      method: 'GET',
      params: { range },
    });
    return res.data;
  } catch (error) {
    logger.error('获取成长事件失败', error);
    throw error;
  }
}

export async function listGaps(): Promise<GapListResponse> {
  try {
    const res = await axiosForBackend.request<GapListResponse>({
      url: '/api/gaps',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取差距池失败', error);
    throw error;
  }
}

export async function getGapActions(): Promise<GapActionsResponse> {
  try {
    const res = await axiosForBackend.request<GapActionsResponse>({
      url: '/api/gaps/actions',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取行动建议失败', error);
    throw error;
  }
}
