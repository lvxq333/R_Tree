import { useEffect, useState } from 'react';
import type { FeishuIntegrationStatus } from '@shared/api.interface';
import { axiosForBackend } from '@client/src/lib/runtime';

const LABEL: Record<string, string> = { pending: '等待发送', sending: '发送中', waiting_binding: '接收人未绑定飞书',
  retry: '发送待重试', sent: '已送达飞书', uncertain: '送达待核实', cancelled: '已撤回' };

/** A real self-service test: no mocked identity, card send or callback. */
export default function FeishuPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<FeishuIntegrationStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    try { setStatus((await axiosForBackend.get<FeishuIntegrationStatus>('/api/integrations/feishu')).data); }
    catch { setError('暂时无法获取飞书通道状态'); }
  };
  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [open]);
  const send = async () => {
    setBusy(true); setError('');
    try { await axiosForBackend.post('/api/integrations/feishu/test'); await refresh(); }
    catch (e) { const data = (e as { response?: { data?: { message?: string; error?: { message?: string } } } }).response?.data;
      setError(data?.error?.message || data?.message || '发送请求失败'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => setOpen(true)}>飞书交互测试与送达记录</button>
    {open && <div className="development-modal" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="development-card" role="dialog" aria-modal="true" aria-label="飞书交互测试" style={{ maxHeight: '80vh', overflowY: 'auto', width: 'min(720px,90vw)' }}>
        <h3>飞书交互测试</h3>
        <p>{status?.enabled ? '真实飞书通道已启用。' : '真实飞书通道尚未配置。'}{status?.linked ? '你的飞书身份已绑定。' : '请先关闭此窗口，在账户菜单中绑定自己的飞书身份。'}</p>
        <p>点击发送后，去飞书打开「技能树」机器人的卡片，点击「确认收到」，再回到这里查看回传结果。测试只通知你本人，不改变技能、审批或组队数据。</p>
        {error && <p role="alert">{error}</p>}
        <div className="development-actions"><button type="button" onClick={() => setOpen(false)}>关闭</button>
          <button type="button" disabled={busy || !status?.enabled || !status.linked} onClick={() => { void send(); }}>{busy ? '提交中…' : '给自己发送真实测试卡片'}</button></div>
        <h4>我的最近通知</h4>
        {!status?.deliveries.length && <p>暂无发送记录。</p>}
        {status?.deliveries.map(item => <article key={item.id} style={{ borderTop: '1px solid #ddd', padding: '12px 0' }}>
          <strong>{item.title}</strong><p>{LABEL[item.state] || item.state}{item.result ? ` · ${item.result}` : ''}</p>
          {item.error && <small>{item.error}</small>}
        </article>)}
      </section>
    </div>}
  </>;
}
