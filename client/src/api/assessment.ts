import type { AssessmentWorkspace, CreateAssessmentInput, SkillAssessment } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';

export async function getAssessmentWorkspace(slug:string):Promise<AssessmentWorkspace> {
  return (await axiosForBackend.get<AssessmentWorkspace>(`/api/skill-assessments/${encodeURIComponent(slug)}/workspace`)).data;
}
export async function getAssessment(slug:string,id:string):Promise<SkillAssessment> {
  return (await axiosForBackend.get<SkillAssessment>(`/api/skill-assessments/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`)).data;
}
export async function createAssessment(slug:string,input:CreateAssessmentInput):Promise<SkillAssessment> {
  return (await axiosForBackend.post<SkillAssessment>(`/api/skill-assessments/${encodeURIComponent(slug)}`,input)).data;
}
