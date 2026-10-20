import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { axiosForBackend } from '@/lib/runtime';
import type { ValidationWorkspace } from '@shared/api.interface';
import { useCertifications } from './certification-context';
import './validation.css';

export default function ValidationInbox() {
  const { openCertification } = useCertifications();
  const [data,setData] = useState<ValidationWorkspace|null>(null);
  const [open,setOpen] = useState(false);
  const [error,setError] = useState('');
  const version = useRef('');
  const trigger = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(async () => {
    try {
      const result = (await axiosForBackend.get<ValidationWorkspace>('/api/validation/workspace')).data;
      setData(result); setError('');
      const next = `${result.job?.id}:${result.job?.status}:${result.notices.map(n=>n.status).join(',')}`;
      if (version.current && next !== version.current) window.dispatchEvent(new Event('validation:updated'));
      version.current = next;
    } catch { setError('验证通知读取失败，请刷新重试'); }
  },[]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(()=>{void refresh();},3000);
    return ()=>window.clearInterval(timer);
  },[refresh]);
  useEffect(() => {
    const close = (event:KeyboardEvent) => { if (event.key==='Escape') { setOpen(false); trigger.current?.focus(); } };
    if (open) document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[open]);
  const unread = data?.notices.filter(n=>!n.readAt && n.status!=='withdrawn').length ?? 0;
  const scan = async () => {
    try { await axiosForBackend.post('/api/validation/scan'); await refresh(); }
    catch (cause) { setError(axios.isAxiosError(cause) ? cause.response?.data?.error?.message ?? '识别暂不可用' : '识别暂不可用'); }
  };
  return <>
    <button className="ghost" ref={trigger} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>候选通知 <b aria-live="polite">{unread}</b></button>
    {open && <div className="validation-backdrop" onClick={()=>setOpen(false)}><aside className="validation-drawer" role="dialog" aria-modal="true" aria-label="隔离验证通知与材料" onClick={e=>e.stopPropagation()}>
      <header><div><h2>候选技能通知</h2><p>隔离验证样本 · 非员工真实经历 · 未自动申请或认证</p></div><button className="ghost" aria-label="关闭候选通知" onClick={()=>setOpen(false)}>关闭</button></header>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <section><h3>AI 识别进度</h3><p>{!data?.job ? '等待材料同步和自动识别' : {queued:'已排队',running:'正在引用材料识别候选技能',completed:'识别完成',failed:'识别失败'}[data.job.status]}{data?.job ? ` · ${data.job.model}` : ''}</p>
        {data?.job?.error && <p role="alert">{data.job.error}</p>}
        <button className="ghost" disabled={['queued','running'].includes(data?.job?.status ?? '')} onClick={()=>{void scan();}}>检查新材料 / 重试识别</button>
      </section>
      <section><h3>候选建议与撤回记录（{data?.notices.filter(n=>n.status==='ready').length ?? 0} 项待核对）</h3>
        {!data?.notices.length && <p>暂无候选通知。仅有可核对的材料时，AI 才会提出建议。</p>}
        {data?.notices.map(notice=><article className="validation-notice" key={notice.id}><h4>{notice.title}{!notice.readAt ? ' · 未读' : ''}</h4><p>{notice.message}</p>
          <p>状态：{{ready:'待本人确认',pending:'本人已提交，等待审批',dismissed:'暂不申请',withdrawn:'证据不足，建议已撤回',approved:'已审批'}[notice.status] ?? notice.status}</p>
          {notice.citations.map((cite,index)=><blockquote key={`${cite.factId}-${index}`}>{cite.quote}<small>事实 {cite.factId} · 版本 {cite.version}</small></blockquote>)}
          {!['dismissed','withdrawn'].includes(notice.status) && <button className="primary" onClick={()=>{void (async()=>{
            try { await axiosForBackend.post(`/api/validation/notices/${notice.id}/read`); openCertification(notice.certificationSlug); setOpen(false); await refresh(); }
            catch { setError('打开候选失败，请重试'); }
          })();}}>{notice.status==='ready' ? '核对材料并选择是否申请' : '查看申请进度'}</button>}
        </article>)}
      </section>
      {!!data?.job?.result?.notSuggested.length && <section><h3>未推荐的技能</h3>{data.job.result.notSuggested.map(item=><p key={item.skillSlug}><b>{item.skillSlug}</b>：{item.reason}</p>)}</section>}
      <section><h3>事实中心材料（{data?.materials.length ?? 0}）</h3><p>所有材料都保留验证标记、源文件和内容哈希；不计入正式员工库。</p>
        {data?.materials.map(material=><details key={material.id}><summary>{material.title} · {material.content.format==='structured' ? '结构化' : '非结构化'}</summary>
          <pre>{String(material.content.body)}</pre><small>来源：{JSON.stringify(material.content.source)} · v{material.version}</small>
        </details>)}
      </section>
    </aside></div>}
  </>;
}
