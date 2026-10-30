import type { TalentCandidate, TalentCriteria, TalentSkillMatch } from '@shared/api.interface';

export const EMPTY_CRITERIA: TalentCriteria = { title: '人才需求', required: [], bonus: [], keywords: [], minimumAvailability: null, startMonth: '' };
export type TalentPerson = {
  slug: string; name: string; avatar_text: string | null; avatar_tone: string | null;
  department: string | null; org: string | null; role: string | null; availability: string | null;
  updated_at: Date | string; is_demo: boolean;
};
export type CertifiedSkill = { employee_slug: string; skill_slug: string; name: string; level: number; certified_at: Date | string };
export type TalentProject = { employee_slug: string; title: string; verification: string | null; skills: unknown };

export function availabilityPercent(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(?:^|[^\d.])(100|\d{1,2})\s*[%％]/);
  return match ? Number(match[1]) : null;
}

export function matchTalent(person: TalentPerson, skills: CertifiedSkill[], projects: TalentProject[], criteria: TalentCriteria,
  names: Map<string,string>): { tier: 'direct' | 'adjacent' | 'potential'; candidate: TalentCandidate; score: number; relevant: boolean } {
  const levels = new Map<string,number>();
  for (const skill of skills) levels.set(skill.skill_slug,Math.max(levels.get(skill.skill_slug) ?? 0,skill.level));
  const match = (conditions: TalentCriteria['required']): TalentSkillMatch[] => conditions.map(condition => ({
    skillSlug: condition.skillSlug, name: names.get(condition.skillSlug) ?? condition.skillSlug,
    requiredLevel: condition.level, currentLevel: levels.get(condition.skillSlug) ?? 0,
    met: (levels.get(condition.skillSlug) ?? 0) >= condition.level,
  }));
  const required = match(criteria.required), bonus = match(criteria.bonus);
  const met = required.filter(item=>item.met).length, bonusMet = bonus.filter(item=>item.met).length;
  // 关键词仅作经历与方向线索，不把项目标签视为已认证技能。
  const haystack = [person.name,person.role,person.department,person.org,...skills.map(s=>s.name),
    ...projects.map(p=>`${p.title} ${Array.isArray(p.skills)?p.skills.join(' '):''}`)].join(' ').toLocaleLowerCase();
  const matchedKeywords = criteria.keywords.filter(keyword=>haystack.includes(keyword.toLocaleLowerCase()));
  const hasCriteria = required.length + bonus.length + criteria.keywords.length > 0;
  const relevant = !hasCriteria || [...required,...bonus].some(item=>item.currentLevel>0) || matchedKeywords.length>0;
  const tier = required.length ? met===required.length?'direct':required.some(item=>item.currentLevel>0)?'adjacent':'potential'
    : bonus.length ? bonusMet===bonus.length?'direct':bonus.some(item=>item.currentLevel>0)?'adjacent':'potential'
    : matchedKeywords.length===criteria.keywords.length?'direct':'potential';
  const percent = availabilityPercent(person.availability);
  const gaps = required.filter(item=>!item.met).map(item=>`${item.name}：${item.currentLevel?`L${item.currentLevel}`:'无有效认证'} → L${item.requiredLevel}`);
  const score = (required.length ? met/required.length*100 : 0) + (bonus.length?bonusMet/bonus.length*20:0) + matchedKeywords.length;
  const freshness = new Date(Math.max(new Date(person.updated_at).getTime(),...skills.map(s=>new Date(s.certified_at).getTime())));
  return { tier, score, relevant, candidate: {
    id:person.slug,name:person.name,avatar:person.avatar_text || person.name.slice(-2),avatarTone:person.avatar_tone || 'blue',
    org:person.department || person.org || '未登记部门',role:person.role || '未登记岗位',
    available:percent!==null && percent>0 && percent>=(criteria.minimumAvailability ?? 1),
    availability:percent===null?'投入比例待确认':`可投入 ${percent}%`, availabilityPercent:percent,
    reason:required.length?`必需技能达标 ${met}/${required.length}`:bonus.length?`加分技能达标 ${bonusMet}/${bonus.length}`:hasCriteria?'经历关键词匹配':'员工技能目录',
    note:required.length?'按有效期内的已认证技能逐项比对。项目经历仅提供辅助线索。':hasCriteria?'按已认证技能与登记的岗位、项目关键词匹配。':'尚未设置技能条件，可先浏览员工或添加条件。',
    evidence:[...skills].sort((a,b)=>Number(criteria.required.some(c=>c.skillSlug===b.skill_slug))-Number(criteria.required.some(c=>c.skillSlug===a.skill_slug)) || Number(criteria.bonus.some(c=>c.skillSlug===b.skill_slug))-Number(criteria.bonus.some(c=>c.skillSlug===a.skill_slug)) || a.name.localeCompare(b.name,'zh-CN')).map(s=>`${s.name} L${s.level}`).filter((v,i,a)=>a.indexOf(v)===i),
    gap:gaps.length?gaps.join('；'):required.length?'必需技能均已达标':'尚未设置必需技能',
    freshness:Number.isFinite(freshness.getTime())?freshness.toISOString().slice(0,10):'待确认',
    dimensions:[...(required.length?[['必需技能覆盖',Math.round(met/required.length*100)] as [string,number]]:[]),
      ...(bonus.length?[['加分技能覆盖',Math.round(bonusMet/bonus.length*100)] as [string,number]]:[])],
    requiredMatches:required,bonusMatches:bonus,projects:projects.map(p=>({title:p.title,verification:p.verification || '登记记录，待核验'})),
    matchedKeywords,isDemo:person.is_demo,
  }};
}
