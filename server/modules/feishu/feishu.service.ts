import { BadRequestException, HttpException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { TeamService } from '../team/team.service';
import { validationEnabled } from '../facts/validation-environment';
import type { AuthUser, FeishuIntegrationStatus } from '@shared/api.interface';

type Notice = { slug: string; recipient_employee_slug: string; kind: string; title: string; body: string;
  payload: Record<string, string> | null; dismissed_at: Date | null; state: string; request: Record<string, unknown> | null };
type BridgeEvent = { id: number; type: string; notification_id: string; business_ref: string; action: string;
  actor: { app_id: string; tenant_key: string; open_id: string } };

@Injectable()
export class FeishuService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(FeishuService.name);
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  enabled() { return !validationEnabled() && process.env.FEISHU_MODE === 'real' &&
    Boolean(process.env.FEISHU_BRIDGE_URL && process.env.FEISHU_BRIDGE_TOKEN && process.env.FEISHU_APP_ID && process.env.FEISHU_TENANT_KEY); }
  onModuleInit() {
    if (!this.enabled()) return;
    this.timer = setInterval(() => { void this.tick().catch(() => this.logger.warn('飞书同步暂不可用，将自动重试')); }, 3000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async bridge(path: string, data?: unknown) {
    const response = await fetch(new URL(path, process.env.FEISHU_BRIDGE_URL!), {
      method: data === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${process.env.FEISHU_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`飞书接入服务 HTTP ${response.status}`);
    return response.json();
  }

  async status(user: AuthUser): Promise<FeishuIntegrationStatus> {
    const rows = await this.db.execute<{ slug: string; title: string; state: string; error: string | null; sent_via_feishu: boolean;
      result: string | null; decision: string | null; updated_at: Date }>(sql`
      SELECT n.slug,n.title,n.sent_via_feishu,d.state,d.error,d.updated_at,i.result,i.decision
      FROM app_feishu_delivery d JOIN mvp_notification n ON n.slug=d.notification_slug
      LEFT JOIN LATERAL (SELECT result,decision FROM app_feishu_inbox WHERE notification_slug=n.slug ORDER BY created_at DESC LIMIT 1) i ON true
      WHERE n.recipient_employee_slug=${user.employeeSlug} ORDER BY d.created_at DESC LIMIT 20`);
    return { enabled: this.enabled(), linked: user.feishuLinked, deliveries: rows.map(r => ({
      id: r.slug, title: r.title, state: r.state, error: r.error, sent: r.sent_via_feishu,
      result: r.result, decision: r.decision, updatedAt: new Date(r.updated_at).toISOString(),
    })) };
  }

  async sendTest(user: AuthUser) {
    if (!this.enabled()) throw new BadRequestException('真实飞书通道尚未启用');
    if (!user.feishuLinked) throw new BadRequestException('请先绑定自己的飞书身份');
    const [last] = await this.db.execute<{ recent: boolean }>(sql`SELECT EXISTS(SELECT 1 FROM mvp_notification
      WHERE recipient_employee_slug=${user.employeeSlug} AND kind='integration-test' AND created_at>now()-interval '30 seconds') AS recent`);
    if (last.recent) throw new BadRequestException('请等待 30 秒后再发送测试卡片');
    await this.db.execute(sql`INSERT INTO mvp_notification(slug,recipient_employee_slug,kind,title,body,payload)
      VALUES(${'ft-'+randomUUID()},${user.employeeSlug},'integration-test','技能树 · 飞书交互测试',
        '这是从服务器技能树发送的真实测试卡片。点击「确认收到」后，返回技能树查看回传结果。不会改变技能、审批或组队状态。',
        ${JSON.stringify({ source: 'application', test: 'true' })}::jsonb)`);
    return { ok: true };
  }

  async tick() {
    if (this.running || !this.enabled()) return;
    this.running = true;
    try {
      // Consume before sending: business changes and resulting notices commit before acknowledgement.
      const batch = await this.bridge('/v1/events?limit=30') as { events: BridgeEvent[] };
      for (const event of batch.events) {
        await this.consume(event);
        await this.bridge(`/v1/events/${event.id}/ack`, {});
      }
      const rows = await this.db.execute<Notice>(sql`WITH candidate AS (
        SELECT notification_slug FROM app_feishu_delivery WHERE state IN ('pending','waiting_binding','retry','sending')
          AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5
      ), claimed AS (UPDATE app_feishu_delivery d SET state='sending',lease_until=now()+interval '2 minutes',updated_at=now()
        FROM candidate c WHERE d.notification_slug=c.notification_slug RETURNING d.*)
      SELECT n.*,d.state,d.request FROM claimed d JOIN mvp_notification n ON n.slug=d.notification_slug`);
      for (const row of rows) await this.deliver(row);
    } finally { this.running = false; }
  }

  private async setState(slug: string, state: string, error: string | null) {
    await this.db.execute(sql`UPDATE app_feishu_delivery SET state=${state},error=${error},lease_until=NULL,
      next_attempt_at=now()+interval '1 minute',updated_at=now() WHERE notification_slug=${slug}`);
  }

  private async deliver(row: Notice) {
    if (row.payload?.withdrawnAt || row.dismissed_at) { await this.setState(row.slug, 'cancelled', '通知已撤回'); return; }
    let request = row.request;
    if (!request) {
      const [identity] = await this.db.execute<{ subject: string }>(sql`SELECT x.subject FROM app_external_identity x
        JOIN app_account a ON a.id=x.account_id JOIN employee e ON e.id=a.employee_id
        WHERE x.provider='feishu' AND a.enabled AND e.status='active' AND e.slug=${row.recipient_employee_slug}
        AND x.subject LIKE ${process.env.FEISHU_APP_ID+':'+process.env.FEISHU_TENANT_KEY+':ou_%'} LIMIT 1`);
      if (!identity) { await this.setState(row.slug, 'waiting_binding', '接收人尚未绑定本应用的飞书身份'); return; }
      const actions = row.kind === 'team-invite' && !row.payload?.event
        ? [{ key: 'accept', label: '接受邀请' }, { key: 'reject', label: '拒绝邀请' }]
        : [{ key: 'ack', label: row.kind === 'integration-test' ? '确认收到' : '已阅' }];
      request = { idempotency_key: row.slug, recipient_open_id: identity.subject.split(':')[2], business_ref: row.slug,
        title: row.title.slice(0, 100), text: row.body.slice(0, 4000), actions, expires_in: 604800 };
      await this.db.execute(sql`UPDATE app_feishu_delivery SET request=${JSON.stringify(request)}::jsonb WHERE notification_slug=${row.slug}`);
    }
    try {
      const result = await this.bridge('/v1/notifications', request) as { id: string; status: string };
      const state = result.status === 'sent' ? 'sent' : result.status === 'uncertain' ? 'uncertain' : 'retry';
      await this.db.execute(sql`UPDATE app_feishu_delivery SET bridge_id=${result.id},state=${state},
        error=${state === 'sent' ? null : '飞书送达状态待核实'},attempts=attempts+1,lease_until=NULL,
        next_attempt_at=now()+interval '1 minute',updated_at=now() WHERE notification_slug=${row.slug}`);
      if (state === 'sent') await this.db.execute(sql`UPDATE mvp_notification SET sent_via_feishu=true,
        payload=coalesce(payload,'{}'::jsonb)||'{"channel":"feishu"}'::jsonb WHERE slug=${row.slug}`);
    } catch {
      // Same persisted request and key are reused; the gateway never duplicates a completed send.
      await this.setState(row.slug, 'retry', '发送暂未成功，正在按相同幂等键重试');
    }
  }

  async consume(event: BridgeEvent) {
    const apply = async (tx: PostgresJsDatabase) => {
      const prior = await tx.execute(sql`SELECT event_id FROM app_feishu_inbox WHERE event_id=${event.id}`);
      if (prior.length) return;
      const [notice] = await tx.execute<Notice>(sql`SELECT n.*,d.state,d.request FROM mvp_notification n
        JOIN app_feishu_delivery d ON d.notification_slug=n.slug
        WHERE n.slug=${event.business_ref} AND (d.bridge_id=${event.notification_id}
          OR (d.bridge_id IS NULL AND d.request->>'business_ref'=${event.business_ref})) FOR UPDATE OF n`);
      if (!notice || event.type !== 'notification.action' || notice.payload?.withdrawnAt || notice.dismissed_at)
        throw new BadRequestException('通知已失效或不属于本应用');
      const [actor] = await tx.execute<{ employee_slug: string; name: string; department: string; personnel_role: 'hr'|'expert'|'employee' }>(sql`
        SELECT e.slug AS employee_slug,e.name,coalesce(e.department,e.org,'') AS department,
          CASE WHEN e.personnel_role='hr' THEN 'hr' WHEN e.job_grade='T4' THEN 'expert' ELSE 'employee' END AS personnel_role
        FROM app_external_identity x JOIN app_account a ON a.id=x.account_id JOIN employee e ON e.id=a.employee_id
        WHERE x.provider='feishu' AND x.subject=${event.actor.app_id+':'+event.actor.tenant_key+':'+event.actor.open_id}
          AND a.enabled AND e.status='active' AND e.slug=${notice.recipient_employee_slug}`);
      if (!actor || event.actor.app_id !== process.env.FEISHU_APP_ID || event.actor.tenant_key !== process.env.FEISHU_TENANT_KEY)
        throw new BadRequestException('飞书身份与通知接收人不匹配');
      if (notice.request?.recipient_open_id !== event.actor.open_id) throw new BadRequestException('卡片原始接收人不匹配');
      let result = '已确认收到真实飞书卡片';
      if (notice.kind === 'team-invite' && !notice.payload?.event) {
        if (!['accept','reject'].includes(event.action)) throw new BadRequestException('不支持的邀请操作');
        const team = new TeamService(tx);
        await team.respond({ employeeSlug: actor.employee_slug, name: actor.name, department: actor.department,
          personnelRole: actor.personnel_role }, { roleSlug: notice.payload?.roleSlug, action: event.action,
          note: event.action === 'reject' ? '通过飞书卡片拒绝邀请' : undefined }, 'feishu');
        result = event.action === 'accept' ? '已在技能树接受组队邀请' : '已在技能树拒绝组队邀请';
      } else if (event.action !== 'ack') throw new BadRequestException('不支持的通知操作');
      // A verified click also recovers a send whose HTTP response was lost during a process crash.
      await tx.execute(sql`UPDATE app_feishu_delivery SET bridge_id=coalesce(bridge_id,${event.notification_id}),state='sent',
        error=NULL,lease_until=NULL,updated_at=now() WHERE notification_slug=${notice.slug}`);
      await tx.execute(sql`UPDATE mvp_notification SET read_at=coalesce(read_at,now()),sent_via_feishu=true WHERE slug=${notice.slug}`);
      await tx.execute(sql`INSERT INTO app_feishu_inbox(event_id,notification_slug,decision,result)
        VALUES(${event.id},${notice.slug},${event.action},${result}) ON CONFLICT DO NOTHING`);
    };
    try { await this.db.transaction(async tx => apply(tx as unknown as PostgresJsDatabase)); }
    catch (error) {
      if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
      await this.db.execute(sql`INSERT INTO app_feishu_inbox(event_id,notification_slug,decision,result)
        VALUES(${event.id},${event.business_ref},${event.action},${'操作未执行：'+error.message.slice(0,200)}) ON CONFLICT DO NOTHING`);
    }
  }
}
