import { axiosForBackend } from '@/lib/runtime';
import type { PositionCatalog, PositionInput, PositionImportPreview, PositionImportRow } from '@shared/api.interface';
export const deletePosition=async(slug:string,revision:string)=>(await axiosForBackend.delete(`/api/positions/${encodeURIComponent(slug)}`,{params:{revision}})).data;
export const getPositions=async()=>(await axiosForBackend.get<PositionCatalog>('/api/positions')).data;
export const savePosition=async(slug:string|undefined,input:PositionInput)=>slug
  ?(await axiosForBackend.patch(`/api/positions/${encodeURIComponent(slug)}`,input)).data
  :(await axiosForBackend.post('/api/positions',input)).data;
export const previewPositions=async(file:File):Promise<PositionImportPreview>=>{
  if(file.size>5*1024*1024)throw new Error('文件最大为 5MB');
  const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('文件读取失败'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
  return (await axiosForBackend.post<PositionImportPreview>('/api/positions/import/preview',{filename:file.name,content},{timeout:60000})).data;
};
export const importPositions=async(rows:PositionImportRow[],revision:string)=>(await axiosForBackend.post<{directions:number;requirements:number}>('/api/positions/import/confirm',{rows,revision},{timeout:60000})).data;
export const exportPositions=async()=>{
  const response=await axiosForBackend.get<Blob>('/api/positions/export',{responseType:'blob',timeout:60000});
  const filename=decodeURIComponent(String(response.headers['content-disposition']??'').match(/filename\*=UTF-8''([^;]+)/i)?.[1]??'公司岗位技能标准.xlsx');
  const url=URL.createObjectURL(response.data);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
