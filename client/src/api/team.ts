import type {
  CreateTeamProjectInput,
  MockTeamResponseInput,
  TeamCandidateSearchResponse,
  TeamArchiveResponse,
  CreateTeamRoleInput,
  TeamInviteItem,
  TeamResponse,
  TeamRole,
  TeamStatusInput,
  UpdateTeamRoleInput,
} from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
import { logger } from '@/lib/runtime';

export async function getTeam(project?: string): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team',
      method: 'GET',
      params: project ? { project } : undefined,
    });
    return res.data;
  } catch (error) {
    logger.error('获取项目组队数据失败', error);
    throw error;
  }
}

export async function createTeamProject(
  input: CreateTeamProjectInput,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team/projects',
      method: 'POST',
      data: input,
    });
    return res.data;
  } catch (error) {
    logger.error('创建组队方案失败', error);
    throw error;
  }
}

export async function getTeamDepartments(): Promise<string[]> {
  try {
    const res = await axiosForBackend.request<{ departments: string[] }>({
      url: '/api/team/departments',
      method: 'GET',
    });
    return res.data.departments;
  } catch (error) {
    logger.error('获取部门列表失败', error);
    throw error;
  }
}

export async function getTeamInvites(): Promise<TeamInviteItem[]> {
  try {
    const res = await axiosForBackend.request<{ invites: TeamInviteItem[] }>({
      url: '/api/team/invites',
      method: 'GET',
    });
    return res.data.invites;
  } catch (error) {
    logger.error('获取组队邀请失败', error);
    throw error;
  }
}

export async function respondTeamInvite(
  input: { roleSlug: string; project?: string; action: 'accept' | 'reject'; note?: string },
): Promise<TeamInviteItem[]> {
  try {
    const res = await axiosForBackend.request<{ invites: TeamInviteItem[] }>({
      url: '/api/team/invites/respond',
      method: 'POST',
      data: input,
    });
    return res.data.invites;
  } catch (error) {
    logger.error('响应组队邀请失败', error);
    throw error;
  }
}

export async function createTeamRole(
  input: CreateTeamRoleInput & { project?: string },
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

export async function updateTeamRole(
  roleSlug: string,
  input: UpdateTeamRoleInput,
): Promise<TeamRole> {
  try {
    const res = await axiosForBackend.request<TeamRole>({
      url: `/api/team/roles/${roleSlug}`,
      method: 'PUT',
      data: input,
    });
    return res.data;
  } catch (error) {
    logger.error('更新角色需求失败', error);
    throw error;
  }
}

export async function setTeamStatus(
  input: TeamStatusInput,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team/status',
      method: 'POST',
      data: input,
    });
    return res.data;
  } catch (error) {
    logger.error('更新组队方案状态失败', error);
    throw error;
  }
}

export async function assignTeamMember(
  roleSlug: string,
  candidateSlug: string,
  recentParticipationAcknowledged = false,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: `/api/team/assignments/${roleSlug}`,
      method: 'PUT',
      data: { candidateSlug, recentParticipationAcknowledged },
    });
    return res.data;
  } catch (error) {
    logger.error('分配团队成员失败', error);
    throw error;
  }
}

export async function removeTeamAssignment(
  roleSlug: string,
  candidateSlug?: string,
): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: `/api/team/assignments/${roleSlug}`,
      method: 'DELETE',
      params: candidateSlug ? { candidate: candidateSlug } : undefined,
    });
    return res.data;
  } catch (error) {
    logger.error('移除团队分配失败', error);
    throw error;
  }
}

export async function clearTeamAssignments(project?: string): Promise<TeamResponse> {
  try {
    const res = await axiosForBackend.request<TeamResponse>({
      url: '/api/team/assignments',
      method: 'DELETE',
      params: project ? { project } : undefined,
    });
    return res.data;
  } catch (error) {
    logger.error('清空团队分配失败', error);
    throw error;
  }
}

export async function mockTeamResponse(input: MockTeamResponseInput): Promise<TeamResponse> {
  const res = await axiosForBackend.request<TeamResponse>({ url: '/api/team/mock-responses', method: 'POST', data: input });
  return res.data;
}

export async function searchTeamCandidates(roleSlug: string, query: string): Promise<TeamCandidateSearchResponse> {
  const res = await axiosForBackend.request<TeamCandidateSearchResponse>({
    url: `/api/team/roles/${encodeURIComponent(roleSlug)}/candidates`, method: 'GET', params: { q: query },
  });
  return res.data;
}

export async function getTeamArchive(): Promise<TeamArchiveResponse> {
  const res = await axiosForBackend.request<TeamArchiveResponse>({ url: '/api/team/archive', method: 'GET' });
  return res.data;
}
