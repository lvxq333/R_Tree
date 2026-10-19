import { useState } from 'react';
import { useUI } from './ui-context';

interface ConditionGroupState {
  key: string;
  label: string;
  variant: '' | 'required' | 'bonus';
  chips: string[];
}

const INITIAL_GROUPS: ConditionGroupState[] = [
  { key: 'domain', label: '业务领域', variant: '', chips: ['具身智能', '机器人'] },
  {
    key: 'required',
    label: '必需能力',
    variant: 'required',
    chips: ['机器人感知 L3', '强化学习 L3', '运动控制 L2'],
  },
  {
    key: 'bonus',
    label: '经历与加分项',
    variant: 'bonus',
    chips: ['真实硬件落地', '仿真平台', '多模态'],
  },
];

interface TalentConditionsProps {
  onEditConditions: () => void;
}

const TalentConditions = ({ onEditConditions }: TalentConditionsProps) => {
  const { showToast } = useUI();
  const [groups, setGroups] = useState<ConditionGroupState[]>(INITIAL_GROUPS);

  const removeChip = (groupKey: string, chip: string) => {
    setGroups((current: ConditionGroupState[]) =>
      current.map((group: ConditionGroupState) =>
        group.key === groupKey
          ? { ...group, chips: group.chips.filter((item: string) => item !== chip) }
          : group,
      ),
    );
    showToast('已从本次匹配条件中移除。');
  };

  return (
    <div className="talent-conditions" id="talent-conditions">
      <div className="condition-lead">
        <span className="condition-status">已解析</span>
        <b>具身智能业务探索</b>
        <small>系统从描述中识别出 4 类条件，请确认后用于匹配</small>
      </div>
      {groups.map((group: ConditionGroupState) => (
        <div key={group.key} className={`condition-group ${group.variant}`.trim()}>
          <span>{group.label}</span>
          <div>
            {group.chips.map((chip: string) => (
              <button key={chip} onClick={() => removeChip(group.key, chip)}>
                {chip} ×
              </button>
            ))}
            <button
              className="add-condition"
              onClick={() => showToast('可在完整产品中从技能标准库添加能力条件。')}
            >
              ＋
            </button>
          </div>
        </div>
      ))}
      <div className="condition-meta">
        <span><i>◷</i> 2026.10 起</span>
        <span><i>◔</i> 至少投入 50%</span>
        <button id="edit-conditions" onClick={onEditConditions}>调整条件</button>
      </div>
    </div>
  );
};

export default TalentConditions;
