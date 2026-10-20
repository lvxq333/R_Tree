import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import type { AuthConfig, AuthUser } from '@shared/api.interface';
import { getAuthConfig, getAuthUser, login, logout, register } from '@/api/auth';

interface AuthValue { user: AuthUser; config: AuthConfig; signOut: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('缺少登录上下文');
  return value;
}

function LoginScreen({ config, onLogin }: { config: AuthConfig; onLogin: (user: AuthUser) => void }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (registering && password !== confirmPassword) { setError('两次密码不一致'); return; }
    setBusy(true);
    setError('');
    try { onLogin(registering ? await register({ username, password, name, org, position, hireDate }) : await login(username, password)); }
    catch (cause) {
      const message = axios.isAxiosError(cause) ? cause.response?.data?.error?.message : null;
      setError(typeof message === 'string' ? message : '登录失败，请检查连接并重试');
    } finally { setBusy(false); }
  };
  return <div className="auth-layout">
    <aside className="auth-sidebar">
      <div className="brand"><span className="brand-mark">S</span><div><strong>技能树</strong><small>Talent Signal</small></div></div>
      <div className="auth-sidebar-caption">人才管理系统</div>
      <div className="sidebar-foot auth-sidebar-foot"><div className="avatar">·</div><div><strong>未登录</strong><small>请选择登录方式</small></div><button type="button" aria-label="登录入口" title="登录入口" onClick={() => document.getElementById('auth-username')?.focus()}>•••</button></div>
    </aside>
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-eyebrow">{config.validationMode ? '隔离验证环境 · 仅含测试样本' : '欢迎使用技能树'}</span>
        <h1 id="auth-title">{registering ? '注册新员工' : '登录工作台'}</h1>
        <p>{registering ? '填写基本信息后创建工作台，工作记录从空白开始。已有员工请使用已开通的账号登录。' : '使用员工账号，或通过已绑定的飞书身份登录。'}</p>
        <form onSubmit={submit}>
          {registering && <>
            <label htmlFor="register-name">姓名</label><input id="register-name" value={name} onChange={event => setName(event.target.value)} maxLength={64} required />
            <label htmlFor="register-org">部门（选填）</label><input id="register-org" value={org} onChange={event => setOrg(event.target.value)} maxLength={128} />
            <label htmlFor="register-position">岗位（选填）</label><input id="register-position" value={position} onChange={event => setPosition(event.target.value)} maxLength={128} />
            <label htmlFor="register-date">入职日期（选填）</label><input id="register-date" type="date" value={hireDate} onChange={event => setHireDate(event.target.value)} />
          </>}
          <label htmlFor="auth-username">账号</label><input id="auth-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
          <label htmlFor="auth-password">密码</label><input id="auth-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} value={password} onChange={event => setPassword(event.target.value)} required />
          {registering && <><small className="auth-hint">账号 3~50 位，使用字母、数字、下划线、点或短横线；密码至少 12 位。</small><label htmlFor="register-confirm">确认密码</label><input id="register-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? '处理中…' : registering ? '注册并进入工作台' : '账号密码登录'}</button>
        </form>
        <button className="auth-switch" type="button" disabled={busy} onClick={() => { setRegistering(value => !value); setPassword(''); setConfirmPassword(''); setError(''); }}>{registering ? '已有员工账号？返回登录' : '新员工？注册账号'}</button>
        {!registering && <><div className="auth-divider">其他登录方式</div>
        <a className={`auth-provider ${config.feishuEnabled ? '' : 'disabled'}`} href={config.feishuEnabled ? '/api/auth/feishu/start' : undefined} aria-disabled={!config.feishuEnabled}>飞书登录 <span>{config.feishuEnabled ? '已绑定账号可用' : '待配置应用'}</span></a>
        <button className="auth-provider" disabled={!config.ssoEnabled} type="button">公司 SSO 登录 <span>待确定接入协议</span></button></>}
      </section>
    </main>
  </div>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [config, setConfig] = useState<AuthConfig>({ feishuEnabled: false, ssoEnabled: false });
  const [loadError, setLoadError] = useState(false);
  const loadAuth = useCallback(() => {
    setLoadError(false);
    Promise.all([getAuthUser(), getAuthConfig()]).then(([current, settings]) => {
      setUser(current); setConfig(settings);
    }).catch(() => setLoadError(true));
  }, []);
  useEffect(() => { loadAuth(); }, [loadAuth]);
  if (loadError) return <div className="auth-loading"><div><p>暂时无法连接登录服务，请重试。</p><button className="primary" onClick={loadAuth}>重新连接</button></div></div>;
  if (user === undefined) return <div className="auth-loading">正在检查登录状态…</div>;
  if (!user) return <LoginScreen config={config} onLogin={setUser} />;
  const signOut = async () => { await logout(); setUser(null); };
  return <AuthContext.Provider key={user.accountId} value={{ user, config, signOut }}>{children}</AuthContext.Provider>;
}
