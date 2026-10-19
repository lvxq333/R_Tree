import type { IdpResponse } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getIdp(): Promise<IdpResponse> {
  try {
    const res = await axiosForBackend.request<IdpResponse>({
      url: '/api/idp',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取个人发展计划失败', error);
    throw error;
  }
}
