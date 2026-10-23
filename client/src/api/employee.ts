import type {
  EmployeeListItem,
  EmployeeProfile,
  EmployeeWorkspaceResponse,
  SkillTreeResponse,
  SkillRelationsResponse,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getCurrentWorkspace(): Promise<EmployeeWorkspaceResponse> {
  const res = await axiosForBackend.get<EmployeeWorkspaceResponse>('/api/employees/current/workspace');
  return res.data;
}

export async function listEmployees(): Promise<EmployeeListItem[]> {
  try {
    const res = await axiosForBackend.request<EmployeeListItem[]>({
      url: '/api/employees',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取员工列表失败', error);
    throw error;
  }
}

export async function listColleagues(): Promise<EmployeeListItem[]> {
  const res=await axiosForBackend.get<EmployeeListItem[]>('/api/employees/colleagues');
  return res.data;
}

export async function getEmployeeProfile(slug: string): Promise<EmployeeProfile> {
  try {
    const res = await axiosForBackend.request<EmployeeProfile>({
      url: `/api/employees/${slug}`,
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取员工画像失败', error);
    throw error;
  }
}

export async function getSkillTree(): Promise<SkillTreeResponse> {
  try {
    const res = await axiosForBackend.request<SkillTreeResponse>({
      url: '/api/skill-tree',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取技能树失败', error);
    throw error;
  }
}

export async function getSkillRelations(skillSlugs: string[], expand = false): Promise<SkillRelationsResponse> {
  const res = await axiosForBackend.get<SkillRelationsResponse>('/api/skill-relations', {
    params: { skillSlugs: skillSlugs.join(','), ...(expand ? { expand: '1' } : {}) },
  });
  return res.data;
}
