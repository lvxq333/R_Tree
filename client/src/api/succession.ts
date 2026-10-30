import type { KeyPositionCatalog, KeyPositionSaveInput, SuccessionOverview } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export interface SuccessionQuery {
  department: string;
  track: string;
  level: string;
}

const params = (query: SuccessionQuery) => ({
  department: query.department || undefined,
  track: query.track || undefined,
  level: query.level || undefined,
});

export async function getSuccession(query: SuccessionQuery = { department: '', track: '', level: '' }): Promise<SuccessionOverview> {
  try {
    return (await axiosForBackend.get<SuccessionOverview>('/api/succession', { params: params(query) })).data;
  } catch (error) {
    logger.error('获取梯队与继任数据失败', error);
    throw error;
  }
}

export async function getKeyPositionCatalog(): Promise<KeyPositionCatalog> {
  try {
    return (await axiosForBackend.get<KeyPositionCatalog>('/api/succession/catalog')).data;
  } catch (error) {
    logger.error('获取关键岗位名录失败', error);
    throw error;
  }
}

export async function saveKeyPositions(input: KeyPositionSaveInput): Promise<KeyPositionCatalog> {
  try {
    return (await axiosForBackend.put<KeyPositionCatalog>('/api/succession/key-positions', input)).data;
  } catch (error) {
    logger.error('保存关键岗位名录失败', error);
    throw error;
  }
}

export async function exportSuccession(query: SuccessionQuery = { department: '', track: '', level: '' }): Promise<Blob> {
  try {
    return (await axiosForBackend.get('/api/succession/export', { params: params(query), responseType: 'blob' })).data;
  } catch (error) {
    logger.error('导出梯队盘点失败', error);
    throw error;
  }
}
