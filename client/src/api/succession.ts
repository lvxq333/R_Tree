import type { SuccessionResponse } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getSuccession(): Promise<SuccessionResponse> {
  try {
    const res = await axiosForBackend.request<SuccessionResponse>({
      url: '/api/succession',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取梯队与继任数据失败', error);
    throw error;
  }
}
