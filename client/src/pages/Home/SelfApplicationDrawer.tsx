import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useCertifications } from './certification-context';
import { getSkillTree } from '@/api/employee';
import { getSkillStandard } from '@/api/assessment';
import type { SkillNode, SkillAssessmentStandard } from '@shared/api.interface';

const SELF_EVIDENCE_TYPES: string[] = ['培训考试', '项目成果', '文档或作品', '答辩结果'];

export interface SelfApplicationDrawerProps {
  open: boolean;
  skillPreset: string;
}

const SelfApplicationDrawer = ({ open, skillPreset }: SelfApplicationDrawerProps) => {
  const { certifications, setSelfApplication, submitSelfApplication } = useCertifications();
  const panelRef = useRef<HTMLElement>(null);
  const [skills, setSkills] = useState<SkillNode[]>([]);
  const [skillSlug, setSkillSlug] = useState('');
  const [skillError, setSkillError] = useState('');
  const [standard,setStandard]=useState<SkillAssessmentStandard|null>(null);
  const [standardError,setStandardError]=useState('');
  const [standardLoading,setStandardLoading]=useState(false);
  const [level, setLevel] = useState<string>('2');
  const [evidenceType, setEvidenceType] = useState<string>(SELF_EVIDENCE_TYPES[0]);
  const [evidenceTitle, setEvidenceTitle] = useState<string>('');
  const [evidenceLink, setEvidenceLink] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const certifiedLevel = certifications.filter(entry => entry.skillSlug === skillSlug && entry.status === 'approved')
    .reduce((level, entry) => Math.max(level, entry.currentLevel), 0);

  useEffect(() => {
    if (Number(level) <= certifiedLevel) setLevel(String(Math.min(5, certifiedLevel + 1)));
  }, [certifiedLevel, level]);

  useEffect(() => {
    if(!open)return;
    let active = true;
    getSkillTree().then(tree => {
      if (!active) return;
      const entries = tree.categories.flatMap(category => category.children.flatMap(child => child.skills));
      setSkills(entries);
      setSkillSlug(current => entries.some(entry => entry.slug === current) ? current : entries[0]?.slug ?? '');
      setSkillError('');
    }).catch(() => { if (active) setSkillError('技能目录加载失败，请刷新重试。'); });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!skillPreset || !skills.length) return;
    const matched = skills.find(entry => entry.slug === skillPreset || entry.name === skillPreset);
    if (matched) setSkillSlug(matched.slug);
  }, [skillPreset, skills]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  useEffect(()=>{if(!open||!skillSlug)return;let active=true;setStandard(null);setStandardError('');setStandardLoading(true);
    getSkillStandard(skillSlug).then(value=>{if(active)setStandard(value);}).catch(()=>{if(active)setStandardError('技能标准加载失败，请关闭后重试。');}).finally(()=>{if(active)setStandardLoading(false);});
    return()=>{active=false;};
  },[open,skillSlug]);
  const standardReady=Boolean(standard)&&(!standard?.managed||Boolean(standard.configuredLevels?.includes(Number(level))));
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedSkill = skills.find(entry => entry.slug === skillSlug);
    if (!selectedSkill||!standardReady) return;
    void submitSelfApplication({
      standardHash:standard?.hash,
      skill: selectedSkill.name,
      skillSlug,
      level: Number(level),
      evidenceType,
      evidenceTitle: evidenceTitle.trim(),
      evidenceLink: evidenceLink.trim(),
      note: note.trim(),
    }).catch(() => undefined);
  };

  return (
    <section
      className={`panel self-application ${open ? '' : 'hidden'}`}
      id="self-application"
      aria-labelledby="self-application-title"
      ref={panelRef}
    >
      <div className="section-head">
        <div><h3 id="self-application-title">主动申请点亮</h3><p>至少提供一项可核验的证明，培训参与记录本身不等于掌握技能，建议补充考试、作业或实践成果。</p></div>
        <button className="ghost" id="close-self-application" aria-label="关闭主动申请" onClick={() => setSelfApplication(false)}>关闭</button>
      </div>
      <form id="self-application-form" className="self-application-form" onSubmit={handleSubmit}>
        <label>
          <span>技能</span>
          <select id="self-skill" value={skillSlug} disabled={!skills.length} onChange={(event) => setSkillSlug(event.target.value)}>
            {skills.map((option: SkillNode) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
          </select>
        </label>
        <label>
          <span>申请等级</span>
          <select id="self-level" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="1" disabled={certifiedLevel >= 1}>L1 · 入门</option>
            <option value="2" disabled={certifiedLevel >= 2}>L2 · 基础</option>
            <option value="3" disabled={certifiedLevel >= 3}>L3 · 熟练</option>
            <option value="4" disabled={certifiedLevel >= 4}>L4 · 精通</option>
            <option value="5" disabled={certifiedLevel >= 5}>L5 · 专家</option>
          </select>
        </label>
        <section className="form-wide anchor-section" aria-label="本次申请技能标准">
          <h4>L{level} 申请标准</h4>
          {standardLoading&&<p>正在读取技能标准…</p>}{standardError&&<p role="alert">{standardError}</p>}
          {standard&&<><p><b>技能说明：</b>{standard.description||standard.name}</p>{standard.abilities.map(a=><div key={a.id}><b>{a.name}</b><p style={{whiteSpace:'pre-wrap'}}>{a.anchors[Number(level)-1]}</p>{a.evidenceRequirements?.[Number(level)-1]&&<p style={{whiteSpace:'pre-wrap'}}><b>证明材料要求：</b>{a.evidenceRequirements[Number(level)-1]}</p>}</div>)}<small>标准版本：{standard.version}；提交后保留此版本供审核核对。</small>{!standardReady&&<p role="alert">该等级标准尚未完整配置，请联系管理者补齐技能说明、达标标准和证明材料要求后再申请。</p>}</>}
        </section>
        <label>
          <span>证明类型</span>
          <select id="self-evidence-type" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>
            {SELF_EVIDENCE_TYPES.map((option: string) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="form-wide">
          <span>证明名称</span>
          <input id="self-evidence-title" value={evidenceTitle} required onChange={(event) => setEvidenceTitle(event.target.value)} />
        </label>
        <label className="form-wide">
          <span>证明链接或附件说明</span>
          <input id="self-evidence-link" value={evidenceLink} required onChange={(event) => setEvidenceLink(event.target.value)} />
        </label>
        <label className="form-wide">
          <span>申请说明</span>
          <textarea id="self-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="form-actions form-wide">
          <span id="self-form-hint">{skillError || '提交后将由直属管理者或 HR 审批。'}</span>
          <button type="submit" className="primary" disabled={!skillSlug || certifiedLevel >= 5 || standardLoading || !standardReady}>提交点亮申请</button>
        </div>
      </form>
    </section>
  );
};

export default SelfApplicationDrawer;
