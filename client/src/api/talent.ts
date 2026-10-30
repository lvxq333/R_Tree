import type { ShortlistResponse, TalentCandidatesResponse, TalentCatalog, TalentWorkspace, TalentParseResponse, TalentSearchInput, TalentSearchResponse, TalentCriteria } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';
export async function getTalentCandidates():Promise<TalentCandidatesResponse> {return (await axiosForBackend.get('/api/talent/candidates')).data;}
export async function getTalentCatalog():Promise<TalentCatalog> {return (await axiosForBackend.get('/api/talent/catalog')).data;}
export async function getTalentWorkspace():Promise<TalentWorkspace> {return (await axiosForBackend.get('/api/talent/workspace')).data;}
export async function saveTalentWorkspace(input:TalentWorkspace):Promise<TalentWorkspace> {return (await axiosForBackend.put('/api/talent/workspace',input)).data;}
export async function parseTalentPrompt(prompt:string):Promise<TalentParseResponse> {return (await axiosForBackend.post('/api/talent/parse',{prompt},{timeout:100_000})).data;}
export async function searchTalent(input:TalentSearchInput):Promise<TalentSearchResponse> {return (await axiosForBackend.post('/api/talent/search',input)).data;}
export async function getShortlist(criteria?:TalentCriteria):Promise<ShortlistResponse> {
  return criteria ? (await axiosForBackend.post('/api/talent/shortlist/preview',{criteria})).data : (await axiosForBackend.get('/api/talent/shortlist')).data;
}
export async function addToShortlist(id:string):Promise<ShortlistResponse> {return (await axiosForBackend.post(`/api/talent/shortlist/${encodeURIComponent(id)}`)).data;}
export async function removeFromShortlist(id:string):Promise<ShortlistResponse> {return (await axiosForBackend.delete(`/api/talent/shortlist/${encodeURIComponent(id)}`)).data;}
export async function clearShortlist():Promise<ShortlistResponse> {return (await axiosForBackend.delete('/api/talent/shortlist')).data;}
export async function exportShortlist(criteria:TalentCriteria):Promise<Blob> {
  return (await axiosForBackend.post('/api/talent/shortlist/export',{criteria},{responseType:'blob'})).data;
}
