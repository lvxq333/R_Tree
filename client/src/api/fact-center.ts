import type { EmployeeWideRow, FactRecord, ManagerDashboardResponse, TeamSkillMapRow } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';

export const listWideEmployees = async (): Promise<EmployeeWideRow[]> =>
  (await axiosForBackend.get<EmployeeWideRow[]>('/api/fact-center/employees')).data;

export const listTeamSkillMap = async (): Promise<TeamSkillMapRow[]> =>
  (await axiosForBackend.get<TeamSkillMapRow[]>('/api/fact-center/skill-map')).data;

export const getManagerDashboard = async (filters: {role:string;grade:string}): Promise<ManagerDashboardResponse> =>
  (await axiosForBackend.get<ManagerDashboardResponse>('/api/fact-center/manager-overview',{params:filters})).data;

export const listEmployeeFacts = async (slug: string): Promise<FactRecord[]> =>
  (await axiosForBackend.get<FactRecord[]>(`/api/fact-center/employees/${encodeURIComponent(slug)}/facts`)).data;

export const updateEmployee = async (slug: string, body: { name:string;role:string;org:string;status:string;hireDate:string;summary:string }) =>
  (await axiosForBackend.patch(`/api/fact-center/employees/${encodeURIComponent(slug)}`,body)).data;

export const addFact = async (slug: string, body: { kind:string;title:string;occurredAt:string;detail:string }) =>
  (await axiosForBackend.post(`/api/fact-center/employees/${encodeURIComponent(slug)}/facts`,body)).data;

export const updateFact = async (id: string, body: { kind:string;title:string;occurredAt:string;detail:string }) =>
  (await axiosForBackend.patch(`/api/fact-center/facts/${encodeURIComponent(id)}`,body)).data;

export const revokeFact = async (id: string) =>
  (await axiosForBackend.post(`/api/fact-center/facts/${encodeURIComponent(id)}/revoke`)).data;
