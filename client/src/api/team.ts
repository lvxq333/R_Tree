import type {
  CreateTeamRoleInput,
  TeamResponse,
  TeamRole,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getTeam(): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team',
      method: 'GET',
    });
    return res.data;
  } catch (error) {
    logger.error('获取项目组队数据失败', error);
    throw error;
  }
}

export async function createTeamRole(
  input: CreateTeamRoleInput,
): Promise<TeamRole> {
  try {
    const res = await axiosForBackend.request<TeamRole>({
      url: '/api/team/roles',
      method: 'POST',
      data: input,
    });
    return res.data;
  } catch (error) {
    logger.error('创建团队角色失败', error);
    throw error;
  }
}

export async function assignTeamMember(
  roleSlug: string,
  candidateSlug: string,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: `/api/team/assignments/${roleSlug}`,
      method: 'PUT',
      data: { candidateSlug },
    });
    return res.data;
  } catch (error) {
    logger.error('分配团队成员失败', error);
    throw error;
  }
}

export async function removeTeamAssignment(
  roleSlug: string,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: `/api/team/assignments/${roleSlug}`,
      method: 'DELETE',
    });
    return res.data;
  } catch (error) {
    logger.error('移除团队分配失败', error);
    throw error;
  }
}

export async function clearTeamAssignments(): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team/assignments',
      method: 'DELETE',
    });
    return res.data;
  } catch (error) {
    logger.error('清空团队分配失败', error);
    throw error;
  }
}
