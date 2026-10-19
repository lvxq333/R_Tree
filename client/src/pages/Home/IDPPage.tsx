import { useEffect, useState } from 'react';
import { idpApi } from '@/api';
import { logger } from '@/lib/runtime';
import type { IdpResponse } from '@shared/api.interface';
import { useUI } from './ui-context';

const MILESTONE_STATE_LABEL: Record<string, string> = {
  done: '已完成',
  current: '进行中',
  next: '待启动',
};

const IDPPage = () => {
  const { navigate, showToast } = useUI();
  const [idp, setIdp] = useState<IdpResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    idpApi.getIdp()
      .then((res: IdpResponse) => {
        if (!cancelled) setIdp(res);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('获取个人发展计划失败', error);
          setLoadError('IDP 数据加载失败，请稍后重试');
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (loadError) {
    return (
      <section className="page active" id="idp">
        <section className="panel idp-hero"><p>{loadError}</p></section>
      </section>
    );
  }
  if (!idp) {
    return (
      <section className="page active" id="idp">
        <section className="panel idp-hero"><p>IDP 数据加载中…</p></section>
      </section>
    );
  }

  return (
    <section className="page active" id="idp">
      <section className="panel idp-hero">
        <div>
          <span className="overline idp-overline">Individual Development Plan</span>
          <h2>个人发展计划 · IDP</h2>
          <p>{idp.positioning.readinessNote}</p>
          <div className="idp-hero-route">
            <span className="idp-node current"><b>当前</b>{idp.positioning.currentRole}</span>
            <i className="idp-arrow">→</i>
            <span className="idp-node target"><b>目标</b>{idp.positioning.targetRole}</span>
            <span className="idp-horizon">{idp.positioning.horizon}</span>
          </div>
        </div>
        <div className="idp-readiness">
          <strong>{idp.positioning.readiness}%</strong>
          <span>T3 就绪度</span>
          <em>综合 18 项已点亮技能与 6 项在途 Gap 评估</em>
        </div>
      </section>

      <div className="idp-grid">
        <section className="panel idp-status">
          <div className="section-head"><div><h3>现状盘点</h3><p>个人情况摘要 · 生成于 2026 Q3</p></div></div>
          <div className="idp-status-cols">
            <div>
              <h4>优势 · 继续保持</h4>
              <ul>{idp.positioning.strengths.map((item: string) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              <h4>短板 · 重点投入</h4>
              <ul>{idp.positioning.weaknesses.map((item: string) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="panel idp-gaps">
          <div className="section-head">
            <div><h3>Gap 输入</h3><p>本 IDP 的全部行动均来自以下 6 项 Gap</p></div>
            <button className="ghost" onClick={() => navigate('overview')}>查看 Gap 池 →</button>
          </div>
          <ul className="idp-gap-list">
            {idp.gaps.map((gap) => (
              <li key={gap.title}>
                <b className={gap.priority === 'P0' ? 'danger' : undefined}>{gap.priority}</b>
                <span>{gap.title}</span>
                <small>{gap.note}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel idp-phases-panel">
        <div className="section-head">
          <div><h3>阶段规划</h3><p>24 个月四阶段：先补质量基线，再攻系统设计，然后扩大影响，最后冲刺 T3</p></div>
          <button className="ghost" onClick={() => showToast('IDP 已复制到剪贴板，可粘贴到文档与管理者对齐')}>复制 IDP</button>
        </div>
        <div className="idp-phases">
          {idp.phases.map((phase) => (
            <article key={phase.range} className="idp-phase">
              <header>
                <span className="idp-phase-range">{phase.range}</span>
                <h4>{phase.title}</h4>
                <p>{phase.theme}</p>
              </header>
              <div className="idp-phase-gaps">
                {phase.focusGaps.map((gap) => <span key={gap}>{gap}</span>)}
              </div>
              <dl className="idp-phase-facts">
                <div><dt>阶段目标</dt><dd>{phase.objective}</dd></div>
                <div><dt>里程碑</dt><dd>{phase.milestone}</dd></div>
                <div><dt>阶段成果</dt><dd>{phase.outcome}</dd></div>
              </dl>
              <ul className="idp-phase-actions">
                {phase.actions.map((action) => (
                  <li key={action.title}>
                    <span className={`resource-label ${action.kind}`}>{action.kindLabel}</span>
                    <div>
                      <b>{action.title}</b>
                      <small>{action.window} · 对应 {action.gap} · 证明：{action.proof}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="idp-grid">
        <section className="panel idp-timeline-panel">
          <div className="section-head"><div><h3>里程碑与检查点</h3><p>{idp.reviewCadence}</p></div></div>
          <ol className="idp-timeline">
            {idp.milestones.map((point) => (
              <li key={point.time} className={point.state}>
                <i />
                <div>
                  <b>{point.time} · {point.title}</b>
                  <small>{point.detail}</small>
                  <em>{MILESTONE_STATE_LABEL[point.state]}</em>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel idp-adjust-panel">
          <div className="section-head"><div><h3>调整机制</h3><p>计划服务于变化：出现以下触发条件时按对应动作调整，不必推倒重来</p></div></div>
          <ul className="idp-adjust-list">
            {idp.adjustRules.map((rule) => (
              <li key={rule.trigger}>
                <b>{rule.trigger}</b>
                <p>{rule.action}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel idp-footer">
        <p>IDP 由技能数据驱动生成，行动项完成后请回到技能池提交点亮申请，证据将自动关联到下一阶段。</p>
        <div>
          <button className="primary" onClick={() => showToast('已发起与管理者对齐 IDP 的邀约')}>与管理者对齐</button>
          <button className="ghost" onClick={() => showToast('IDP 已导出为文档')}>导出 IDP</button>
          <button className="ghost" onClick={() => navigate('overview')}>返回成长概览</button>
        </div>
      </section>
    </section>
  );
};

export default IDPPage;
