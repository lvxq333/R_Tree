import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useCertifications } from './certification-context';

const SELF_SKILL_OPTIONS: string[] = [
  '自动化测试与质量门禁',
  '容器与编排（K8s）',
  '系统设计与模块拆分',
  '服务稳定性与 SLO 设计',
  'AI 应用集成',
  '模型评估',
];

const SELF_EVIDENCE_TYPES: string[] = ['培训考试', '项目成果', '文档或作品', '答辩结果'];

export interface SelfApplicationDrawerProps {
  open: boolean;
  skillPreset: string;
}

const SelfApplicationDrawer = ({ open, skillPreset }: SelfApplicationDrawerProps) => {
  const { setSelfApplication, submitSelfApplication } = useCertifications();
  const panelRef = useRef<HTMLElement>(null);
  const [skill, setSkill] = useState<string>(SELF_SKILL_OPTIONS[0]);
  const [level, setLevel] = useState<string>('2');
  const [evidenceType, setEvidenceType] = useState<string>(SELF_EVIDENCE_TYPES[0]);
  const [evidenceTitle, setEvidenceTitle] = useState<string>('质量工程训练营结业考试（92 分）');
  const [evidenceLink, setEvidenceLink] = useState<string>('飞书培训记录 / 结业证书 / 考试成绩单');
  const [note, setNote] = useState<string>('已完成训练营全部课程，并在支付服务项目中配置单元测试覆盖率门禁。');

  useEffect(() => {
    if (!skillPreset) return;
    if (SELF_SKILL_OPTIONS.includes(skillPreset)) {
      setSkill(skillPreset);
      return;
    }
    const matched = SELF_SKILL_OPTIONS.find((option: string) => option.startsWith(skillPreset.slice(0, 2)));
    if (matched) setSkill(matched);
  }, [skillPreset]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSelfApplication({
      skill,
      level: Number(level),
      evidenceType,
      evidenceTitle: evidenceTitle.trim(),
      evidenceLink: evidenceLink.trim(),
      note: note.trim(),
    });
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
          <select id="self-skill" value={skill} onChange={(event) => setSkill(event.target.value)}>
            {SELF_SKILL_OPTIONS.map((option: string) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>申请等级</span>
          <select id="self-level" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="2">L2 · 基础</option>
            <option value="3">L3 · 熟练</option>
          </select>
        </label>
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
          <span id="self-form-hint">提交后将由直属管理者或 HR 审批。</span>
          <button type="submit" className="primary">提交点亮申请</button>
        </div>
      </form>
    </section>
  );
};

export default SelfApplicationDrawer;
