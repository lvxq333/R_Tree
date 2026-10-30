import { useMemo } from 'react';
import { TITLE_PIPELINES } from '@shared/api.interface';
import type { JudgingLevelView, JudgingTrackView } from '@shared/api.interface';

/** 目标职称的三段选择结果：管道决定序列范围，序列决定可选职级 */
export type TitleTargetValue = { pipeline: string; track: string; level: string };

export const EMPTY_TARGET: TitleTargetValue = { pipeline: '', track: '', level: '' };

const TECH_SLUGS = ['software', 'platform', 'ai'];
/** 老接口不返回 pipeline 时按技术序列兜底，避免整块选择器失效 */
export const pipelineOf = (track: Pick<JudgingTrackView, 'slug' | 'pipeline'>) =>
  track.pipeline === 'management' || track.pipeline === 'tech'
    ? track.pipeline
    : TECH_SLUGS.includes(track.slug) ? 'tech' : 'management';

const levelHint = (level: JudgingLevelView) => {
  if (level.state === 'certified') return ' · 已持有，可保持与巩固';
  const gap = level.total - level.met;
  if (!level.total) return '';
  return gap <= 0 ? ' · 已达标' : ` · 差 ${gap} 项`;
};

/**
 * 职称目标三级级联选择器：发展管道 → 序列 → 职级。
 * 单一序列的管道（如当前的管理管道）自动跳过「序列」这一级，避免只剩一个选项的下拉框。
 * 上游变化时清空下游，保证不会留下跨管道的旧目标。
 */
export default function TitleTargetPicker({ tracks, value, onChange, disabled = false, idPrefix = 'idp-target' }: {
  tracks: JudgingTrackView[];
  value: TitleTargetValue;
  onChange: (next: TitleTargetValue) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const pipelines = useMemo(() => TITLE_PIPELINES
    .map(pipe => ({ ...pipe, tracks: tracks.filter(track => pipelineOf(track) === pipe.slug) }))
    .filter(pipe => pipe.tracks.length > 0), [tracks]);

  const active = pipelines.find(pipe => pipe.slug === value.pipeline);
  const single = active && active.tracks.length === 1 ? active.tracks[0] : null;
  const track = active?.tracks.find(item => item.slug === value.track) ?? single;
  const levels = track?.levels ?? [];

  const choosePipeline = (slug: string) => {
    const group = pipelines.find(pipe => pipe.slug === slug);
    const only = group && group.tracks.length === 1 ? group.tracks[0].slug : '';
    onChange({ pipeline: slug, track: only, level: '' });
  };
  const chooseTrack = (slug: string) => onChange({ pipeline: value.pipeline, track: slug, level: '' });
  const chooseLevel = (code: string) => onChange({ ...value, level: code });

  const chosenLevel = levels.find(level => level.levelCode === value.level);
  const summary = chosenLevel && track
    ? [active?.name, track.name, `${chosenLevel.levelCode} ${chosenLevel.levelName}`].filter(Boolean).join(' › ')
    : '';

  return <div className="idp-target-cascade" role="group" aria-label="目标职称">
    <label className="idp-cascade-cell" htmlFor={`${idPrefix}-pipeline`}>
      <span>① 发展管道</span>
      <select id={`${idPrefix}-pipeline`} value={value.pipeline} disabled={disabled}
        onChange={event => choosePipeline(event.target.value)}>
        <option value="">请选择发展管道</option>
        {pipelines.map(pipe => <option key={pipe.slug} value={pipe.slug}>
          {pipe.name}{pipe.tracks.length > 1 ? `（${pipe.tracks.length} 条序列）` : ''}
        </option>)}
      </select>
    </label>

    <div className="idp-cascade-cell">
      <span>② 序列{single ? '（仅一条，自动选定）' : ''}</span>
      {single
        ? <p className="idp-cascade-static">{single.name}</p>
        : <select id={`${idPrefix}-track`} aria-label="序列" value={value.track} disabled={disabled || !active}
            onChange={event => chooseTrack(event.target.value)}>
            <option value="">{active ? '请选择序列' : '请先选择发展管道'}</option>
            {active?.tracks.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>}
    </div>

    <label className="idp-cascade-cell" htmlFor={`${idPrefix}-level`}>
      <span>③ 目标职级</span>
      <select id={`${idPrefix}-level`} value={value.level} disabled={disabled || !track}
        onChange={event => chooseLevel(event.target.value)}>
        <option value="">{track ? '请选择目标职级' : '请先选择序列'}</option>
        {levels.map(level => <option key={level.levelCode} value={level.levelCode}>
          {level.levelCode} {level.levelName}{levelHint(level)}
        </option>)}
      </select>
    </label>

    {summary
      ? <p className="idp-target-path">已选目标：{summary}</p>
      : <p className="idp-target-path idp-target-path-hint">逐级收敛，只列出所选路径下的职级。</p>}
  </div>;
}
