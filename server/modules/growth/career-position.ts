import type { JobFamily } from '@shared/api.interface';

interface Direction { slug:string; name:string; family:JobFamily; titles:string[] }
interface EmployeePosition { role:string|null; preferred_track:string|null; job_grade:string|null }
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s·／/（）()_-]+/g,'').replace(/(?:序列|方向|通道)$/,'');
const withoutGrade=(value:string)=>normalize(value).replace(/^(?:(?:初级|中级|高级|资深|首席|助理|实习|见习)|[tpmf][1-4])+/,'').replace(/[tpmf][1-4]$/,'');
const stem=(value:string)=>withoutGrade(value).replace(/(?:工程师|经理|专员|主管|总监|负责人|管理)$/,'');

/** 根据任职岗位匹配实际方向及其职级名称；不按员工姓名或固定方向名称分支。 */
export function resolveCareerDirection(employee:EmployeePosition,directions:Direction[]):string|null {
  const role=normalize(employee.role??''),base=withoutGrade(employee.role??''),roleStem=stem(employee.role??'');
  const score=(direction:Direction)=>{
    if(!role)return 0;
    const name=normalize(direction.name);
    if(name===role)return 1000;
    if(direction.titles.some(title=>normalize(title)===role))return 990;
    if(withoutGrade(direction.name)===base)return 900;
    if(direction.titles.some(title=>withoutGrade(title)===base))return 880;
    if(roleStem.length>=2&&stem(direction.name)===roleStem)return 800;
    if(roleStem.length>=2&&direction.titles.some(title=>stem(title)===roleStem))return 780;
    if(base.length>=3&&name.length>=3&&(base.includes(name)||name.includes(base)))return 600+Math.min(base.length,name.length);
    // 从实际岗位、方向中提取技术词（如Java、Go），无需维护固定的技术方向映射。
    const tokens:string[]=base.match(/[a-z][a-z0-9+#.]*/g)??[];
    const nameTokens:string[]=name.match(/[a-z][a-z0-9+#.]*/g)??[];
    return tokens.length&&tokens.every(token=>nameTokens.includes(token))?400+tokens.join('').length:0;
  };
  const ranked=directions.map(direction=>({direction,score:score(direction)}));
  const best=Math.max(0,...ranked.map(item=>item.score));
  if(best>0){
    const matches=ranked.filter(item=>item.score===best).map(item=>item.direction);
    if(matches.length===1)return matches[0].slug;
    const linked=matches.find(item=>item.slug===employee.preferred_track);
    if(linked)return linked.slug;
    const sameFamily=matches.filter(item=>item.family===employee.job_grade?.[0]);
    return sameFamily.length===1?sameFamily[0].slug:null;
  }
  return directions.find(item=>item.slug===employee.preferred_track)?.slug??null;
}
