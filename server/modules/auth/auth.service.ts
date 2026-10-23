import { validationEnabled } from '../facts/validation-environment';
import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { AuthUser, RegisterInput } from '@shared/api.interface';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';

const scrypt = promisify(scryptCallback);
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
export const SESSION_COOKIE = validationEnabled() ? 'skilltree_validation_session' : 'skilltree_session';
export const OAUTH_COOKIE = 'skilltree_oauth_state';

export type { AuthUser } from '@shared/api.interface';
type AccountRow = { id: string; employee_id: string; username: string; password_hash: string; name: string; enabled: boolean };
type IdentityRow = { account_id: string; subject: string };

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async canViewEmployee(user: AuthUser, employeeSlug: string): Promise<boolean> {
    if (user.personnelRole === 'hr' || user.employeeSlug === employeeSlug) return true;
    if (user.personnelRole !== 'expert') return false;
    const [row] = await this.db.execute<{allowed:boolean}>(sql`SELECT EXISTS(
      SELECT 1 FROM employee e WHERE e.slug=${employeeSlug}
        AND (e.department=${user.department} OR EXISTS(
          SELECT 1 FROM mvp_org_relation r WHERE r.employee_slug=e.slug AND r.target_slug=${user.employeeSlug}
            AND r.relation_type IN ('expert','panel') AND r.effective_to IS NULL))) AS allowed`);
    return Boolean(row?.allowed);
  }

  async userFromToken(token: string | undefined): Promise<AuthUser | null> {
    if (!token || token.length > 256) return null;
    const [row] = await this.db.execute<{ id: string; employee_id: string; username: string; name: string; slug: string; org: string | null; role: string | null; department:string|null; job_grade:AuthUser['jobGrade']; personnel_role:'employee'|'hr'; feishu_linked: boolean }>(sql`
      SELECT a.id, a.employee_id, a.username, e.name, e.slug, e.org, e.role,e.department,e.job_grade,e.personnel_role,
        EXISTS(SELECT 1 FROM app_external_identity x WHERE x.account_id=a.id AND x.provider='feishu') AS feishu_linked
      FROM app_session s JOIN app_account a ON a.id=s.account_id JOIN employee e ON e.id=a.employee_id
      WHERE s.token_hash=${hashToken(token)} AND s.expires_at>now() AND a.enabled=true`);
    if (!row) return null;
    const personnelRole = row.personnel_role === 'hr' ? 'hr' : row.job_grade === 'T4' ? 'expert' : 'employee';
    return { accountId: row.id, employeeId: row.employee_id, username: row.username, name: row.name,
      feishuLinked: row.feishu_linked, employeeSlug: row.slug, accessRole: personnelRole === 'employee' ? 'employee' : 'manager',
      org: row.org ?? '', position: row.role ?? '', department: row.department ?? row.org ?? '',
      jobGrade: row.job_grade, personnelRole };
  }

  async register(input: RegisterInput): Promise<string> {
    if (!input || typeof input.username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,49}$/.test(input.username.trim()))
      throw new BadRequestException('账号需为 3~50 位字母、数字、下划线、点或短横线');
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 1024)
      throw new BadRequestException('密码需为 12~1024 位');
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 64)
      throw new BadRequestException('请填写不超过 64 字的姓名');
    for (const value of [input.org, input.position]) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 128)) throw new BadRequestException('部门和岗位不能超过 128 字');
    }
    if (input.hireDate && (typeof input.hireDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.hireDate)
      || !Number.isFinite(Date.parse(input.hireDate)) || new Date(input.hireDate).toISOString().slice(0,10) !== input.hireDate))
      throw new BadRequestException('入职日期无效');
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(input.password, salt, 64) as Buffer;
    const passwordHash = `scrypt:${salt}:${derived.toString('hex')}`;
    const slug = `employee-${randomUUID()}`;
    const token = randomToken();
    try {
      await this.db.transaction(async tx => {
        const [person] = await tx.execute<{ id: string }>(sql`INSERT INTO employee(slug,name,avatar_text,org,role,hire_date,status,is_current_user)
          VALUES(${slug},${input.name.trim()},${Array.from(input.name.trim())[0]},${input.org?.trim() || null},
            ${input.position?.trim() || null},${input.hireDate || null},'active',false) RETURNING id`);
        const [account] = await tx.execute<{ id: string }>(sql`INSERT INTO app_account(employee_id,username,password_hash)
          VALUES(${person.id},${input.username.trim()},${passwordHash}) RETURNING id`);
        await tx.execute(sql`INSERT INTO mvp_fact_employee(employee_id,basic_info) VALUES(${person.id},
          ${JSON.stringify({name:input.name.trim(),slug,org:input.org?.trim() || null,role:input.position?.trim() || null,hireDate:input.hireDate || null})}::jsonb)`);
        await tx.execute(sql`INSERT INTO app_session(token_hash,account_id,expires_at) VALUES(${hashToken(token)},${account.id},now()+interval '7 days')`);
      });
    } catch (error) {
      const databaseError = error as { code?: string; cause?: { code?: string } };
      if ((databaseError.code ?? databaseError.cause?.code) === '23505') throw new ConflictException('账号已存在，请登录或更换账号');
      throw error;
    }
    return token;
  }

  async login(username: string, password: string, ip: string): Promise<string> {
    const key = `${ip}:${username.toLowerCase()}`;
    const attempt = this.attempts.get(key);
    if (attempt && attempt.until > Date.now() && attempt.count >= 5) throw new UnauthorizedException('尝试次数过多，请 15 分钟后重试');
    const [row] = await this.db.execute<AccountRow & Record<string, unknown>>(sql`
      SELECT a.id,a.employee_id,a.username,a.password_hash,a.enabled,e.name
      FROM app_account a JOIN employee e ON e.id=a.employee_id WHERE lower(a.username)=lower(${username}) LIMIT 1`);
    const encoded = row?.password_hash ?? 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
    const [algorithm, salt, expected] = encoded.split(':');
    const actual = algorithm === 'scrypt' && /^[a-f0-9]{32}$/.test(salt) ? await scrypt(password, salt, 64) : Buffer.alloc(64);
    const valid = /^[a-f0-9]{128}$/.test(expected) && timingSafeEqual(actual as Buffer, Buffer.from(expected, 'hex'));
    if (!row?.enabled || !valid) {
      this.attempts.set(key, { count: (attempt?.until && attempt.until > Date.now() ? attempt.count : 0) + 1, until: Date.now() + 15 * 60_000 });
      throw new UnauthorizedException('账号或密码错误');
    }
    this.attempts.delete(key);
    return this.createSession(row.id);
  }

  async createSession(accountId: string): Promise<string> {
    const [account] = await this.db.execute<{ id: string }>(sql`SELECT a.id FROM app_account a JOIN employee e ON e.id=a.employee_id
      WHERE a.id=${accountId}::uuid AND a.enabled=true`);
    if (!account) throw new UnauthorizedException('账号已停用');
    await this.db.execute(sql`DELETE FROM app_session WHERE expires_at<=now()`);
    const token = randomToken();
    await this.db.execute(sql`INSERT INTO app_session(token_hash,account_id,expires_at)
      VALUES(${hashToken(token)},${accountId}::uuid,now()+interval '7 days')`);
    return token;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.db.execute(sql`DELETE FROM app_session WHERE token_hash=${hashToken(token)}`);
  }

  feishuConfigured(): boolean {
    return !validationEnabled() && Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.FEISHU_REDIRECT_URI);
  }

  async startFeishu(linkAccountId: string | null): Promise<{ url: string; state: string }> {
    if (!this.feishuConfigured()) throw new ServiceUnavailableException('飞书应用尚未配置');
    await this.db.execute(sql`DELETE FROM app_oauth_flow WHERE expires_at<=now()`);
    const state = randomToken();
    await this.db.execute(sql`INSERT INTO app_oauth_flow(state_hash,provider,link_account_id,expires_at)
      VALUES(${hashToken(state)},'feishu',${linkAccountId}::uuid,now()+interval '5 minutes')`);
    const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    url.searchParams.set('client_id', process.env.FEISHU_APP_ID!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', process.env.FEISHU_REDIRECT_URI!);
    url.searchParams.set('state', state);
    return { url: url.toString(), state };
  }

  async finishFeishu(code: string, state: string, browserState: string | undefined): Promise<{ token: string; linked: boolean }> {
    if (!code || !state || !browserState || state !== browserState) throw new BadRequestException('飞书登录状态无效');
    const [flow] = await this.db.execute<{ link_account_id: string | null }>(sql`
      DELETE FROM app_oauth_flow WHERE state_hash=${hashToken(state)} AND provider='feishu' AND expires_at>now()
      RETURNING link_account_id`);
    if (!flow) throw new BadRequestException('飞书登录已过期，请重新操作');
    if (!this.feishuConfigured()) throw new ServiceUnavailableException('飞书应用尚未配置');
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: process.env.FEISHU_APP_ID,
        client_secret: process.env.FEISHU_APP_SECRET, code, redirect_uri: process.env.FEISHU_REDIRECT_URI }),
    });
    const tokenData = await tokenResponse.json() as { code?: number; access_token?: string };
    if (!tokenResponse.ok || tokenData.code !== 0 || !tokenData.access_token) throw new UnauthorizedException('飞书授权失败');
    const profileResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json() as { code?: number; data?: { open_id?: string; user_id?: string; tenant_key?: string } };
    if (!profileResponse.ok || profile.code !== 0 || !profile.data?.open_id) throw new UnauthorizedException('无法获取飞书用户身份');
    // open_id 按应用隔离；如有 tenant_key 一并保存，供后续消息和审批集成使用。
    const subject = `${process.env.FEISHU_APP_ID}:${profile.data.tenant_key ?? 'unknown'}:${profile.data.open_id}`;
    const [identity] = await this.db.execute<IdentityRow & Record<string, unknown>>(sql`
      SELECT account_id,subject FROM app_external_identity WHERE provider='feishu' AND subject=${subject}`);
    if (flow.link_account_id) {
      if (identity && identity.account_id !== flow.link_account_id) throw new ConflictException('该飞书身份已绑定其他账号');
      const [other] = await this.db.execute<{ subject: string }>(sql`SELECT subject FROM app_external_identity
        WHERE provider='feishu' AND account_id=${flow.link_account_id}::uuid AND subject<>${subject}`);
      if (other) throw new ConflictException('当前账号已绑定其他飞书身份');
      await this.db.execute(sql`INSERT INTO app_external_identity(provider,subject,account_id,provider_user_id)
        VALUES('feishu',${subject},${flow.link_account_id}::uuid,${profile.data.user_id ?? null})
        ON CONFLICT(provider,subject) DO UPDATE SET provider_user_id=EXCLUDED.provider_user_id`);
      return { token: await this.createSession(flow.link_account_id), linked: true };
    }
    if (!identity) throw new UnauthorizedException('飞书身份尚未绑定本地账号，请先用账号密码登录后绑定');
    return { token: await this.createSession(identity.account_id), linked: false };
  }
}
