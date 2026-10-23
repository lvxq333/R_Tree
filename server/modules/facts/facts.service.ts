import { validationEnabled } from './validation-environment';
import { currentEmployee } from '../auth/employee-context';
import { createHash } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { employee, employeeProject, employeeSkill, performanceRecord } from '@server/database/schema';
import type { FactCenterStatus, FactChange, FactRecord } from '@shared/api.interface';

type SourceFact = Pick<FactRecord, 'employeeId' | 'sourceTable' | 'sourceKey' | 'kind' | 'title' | 'occurrenceLabel' | 'content'> & { provenance?: FactRecord['provenance'] };
type Stored = { id: string; employee_id: string; source_table: string; source_key: string; kind: FactRecord['kind']; title: string;
  occurrence_label: string | null; content: Record<string, unknown>; content_hash: string; version: number;
  status: FactRecord['status']; provenance: FactRecord['provenance']; updated_at: Date | string };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function factHash(value: SourceFact): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function present(row: Stored): FactRecord {
  return { id: row.id, employeeId: row.employee_id, sourceTable: row.source_table, sourceKey: row.source_key,
    kind: row.kind, title: row.title, occurrenceLabel: row.occurrence_label, content: row.content, version: row.version,
    status: row.status, provenance: row.provenance, updatedAt: new Date(row.updated_at).toISOString() };
}

@Injectable()
export class FactsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FactsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private healthy = false;
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async onModuleInit() {
    // 缺少迁移应明确阻止启动，避免前端误以为事实中心已经接通。
    await this.refresh();
    this.timer = setInterval(() => { void this.refresh().catch(() => undefined); }, 10_000);
    this.timer.unref();
  }
  async onModuleDestroy() { clearInterval(this.timer); await this.running?.catch(() => undefined); }

  refresh(): Promise<void> {
    // 后台轮询和交互刷新合并，跨进程写入由事务锁串行化，保证增量游标提交顺序。
    if (this.running) return this.running;
    this.running = this.importSources().then(() => { this.healthy = true; }).catch(error => {
      this.healthy = false;
      this.logger.error('本地事实源同步失败，保留上次成功快照');
      throw error;
    }).finally(() => { this.running = undefined; });
    return this.running;
  }

  private async importSources(): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(17019002)`);
      const employees = await tx.select({ id: employee.id, slug: employee.slug }).from(employee);
      await tx.execute(sql`INSERT INTO mvp_fact_employee(employee_id,basic_info)
        SELECT id,jsonb_build_object('name',name,'slug',slug,'org',org,'role',role,'hireDate',hire_date) FROM employee
        ON CONFLICT(employee_id) DO UPDATE SET basic_info=excluded.basic_info,updated_at=now()
        WHERE mvp_fact_employee.basic_info IS DISTINCT FROM excluded.basic_info`);
      const ids = new Map(employees.map(row => [row.slug, row.id]));
      const sources: SourceFact[] = [];
      const employeeId = (slug: string, table: string) => {
        const id = ids.get(slug);
        // 员工被删除但旧表仍留有其行时，这里会命中。报错要带表名和 slug，
        // 否则只知道「无法映射」无法定位；可用 npm run db:migrate:mvp 清理孤儿数据。
        if (!id) throw new Error(`${table} 引用的员工 slug「${slug}」不存在（孤儿数据），请执行 npm run db:migrate:mvp 清理`);
        return id;
      };
      for (const row of await tx.select().from(employeeProject)) sources.push({
        employeeId: employeeId(row.employeeSlug, 'employee_project'), sourceTable: 'employee_project', sourceKey: row.id, kind: 'project',
        title: row.title ?? '未命名项目经历', occurrenceLabel: row.timeRange,
        content: { responsibility: row.responsibility, actions: row.actions, outcome: row.outcome, impact: row.impact,
          contribution: row.contribution, skills: row.skills, originalVerification: row.verification },
      });
      for (const row of await tx.select().from(performanceRecord)) sources.push({
        employeeId: employeeId(row.employeeSlug, 'performance_record'), sourceTable: 'performance_record', sourceKey: row.id, kind: 'performance',
        title: `${row.period} 绩效记录`, occurrenceLabel: row.period, content: { rating: row.rating, summary: row.summary },
      });
      for (const row of await tx.select().from(employeeSkill)) {
        if (row.source === 'ai_validation') continue; // AI 建议的引用不能反向作为工作事实，避免循环举证。
        const evidence = row.evidence;
        if (evidence === null) continue;
        if (!Array.isArray(evidence)) throw new Error('旧证据字段不是数组');
        evidence.forEach((item: unknown, index: number) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('旧证据格式无效');
          const raw = item as Record<string, unknown>;
          sources.push({ employeeId: employeeId(row.employeeSlug, 'employee_skill'), sourceTable: 'employee_skill', sourceKey: `${row.id}:${index}`,
            kind: 'legacy_evidence', title: typeof raw.title === 'string' ? raw.title : '历史证据', occurrenceLabel: null,
            // 保留原证据；不导入原认证等级、置信度或结论，避免循环举证。
            content: { evidence: raw, legacyRecordId: row.id, relatedSkillSlug: row.skillSlug, verification: 'unverified_legacy_import' },
          });
        });
      }
      const mockRows = await tx.execute<{ employee_id: string; source_key: string; kind: FactRecord['kind']; title: string;
        occurrence_label: string; content: Record<string, unknown> }>(sql`SELECT * FROM mvp_mock_fact_source`);
      for (const row of mockRows) sources.push({ employeeId: row.employee_id, sourceTable: 'mvp_mock_fact_source',
        sourceKey: row.source_key, kind: row.kind, title: row.title, occurrenceLabel: row.occurrence_label,
        content: row.content, provenance: 'simulated' });
      if (validationEnabled()) {
        const materials = await tx.execute<{id:string;employee_id:string;title:string;format:string;body:string;source_path:string;source_sha256:string}>(sql`SELECT * FROM validation_work_material WHERE test_only=true`);
        for (const material of materials) sources.push({ employeeId:material.employee_id,sourceTable:'validation_work_material',sourceKey:material.id,
          kind:'work_artifact',title:material.title,occurrenceLabel:'隔离验证样本，非员工真实经历',provenance:'validation_fixture',
          content:{testOnly:true,attribution:'仅用于功能验证，不证明该员工真实完成这些工作',format:material.format,body:material.body,
            source:{path:material.source_path,sha256:material.source_sha256}} });
      }
      const manualRows = await tx.execute<{id:string;employee_id:string;kind:FactRecord['kind'];title:string;occurred_at:Date;content:Record<string,unknown>}>(sql`
        SELECT id,employee_id,kind,title,occurred_at,content FROM mvp_manual_fact_source WHERE revoked_at IS NULL`);
      for (const row of manualRows) sources.push({ employeeId: row.employee_id, sourceTable: 'mvp_manual_fact_source',
        sourceKey: row.id, kind: row.kind, title: row.title, occurrenceLabel: new Date(row.occurred_at).toISOString(),
        content: row.content, provenance: 'manager_entered' });
      const previous = await tx.execute<Stored>(sql`SELECT * FROM mvp_fact`);
      const indexed = new Map(previous.map(row => [`${row.source_table}:${row.source_key}`, row]));
      const seen = new Set<string>();
      let changed = 0;
      const recordChange = async (row: Stored, operation: FactChange['operation']) => {
        await tx.execute(sql`INSERT INTO mvp_fact_change(fact_id, employee_id, version, operation, snapshot)
          VALUES (${row.id}, ${row.employee_id}, ${row.version}, ${operation}, ${JSON.stringify(present(row))}::jsonb)`);
        changed++;
      };
      for (const source of sources) {
        const key = `${source.sourceTable}:${source.sourceKey}`;
        seen.add(key);
        const old = indexed.get(key);
        const hash = factHash(source);
        if (old?.content_hash === hash && old.status === 'active') continue;
        const [row] = await tx.execute<Stored>(sql`INSERT INTO mvp_fact
          (employee_id, source_table, source_key, kind, title, occurrence_label, content, content_hash, version, status, provenance)
          VALUES (${source.employeeId}, ${source.sourceTable}, ${source.sourceKey}, ${source.kind}, ${source.title},
            ${source.occurrenceLabel}, ${JSON.stringify(source.content)}::jsonb, ${hash}, 1, 'active', ${source.provenance ?? 'local_legacy_import'})
          ON CONFLICT (source_table, source_key) DO UPDATE SET employee_id=excluded.employee_id, kind=excluded.kind,
            title=excluded.title, occurrence_label=excluded.occurrence_label, content=excluded.content,
            content_hash=excluded.content_hash, provenance=excluded.provenance, version=mvp_fact.version+1, status='active', updated_at=clock_timestamp()
          RETURNING *`);
        if (old && old.employee_id !== row.employee_id) throw new Error('事实来源员工变更，需人工核对，禁止静默转移历史证据');
        await recordChange(row, old ? 'updated' : 'created');
      }
      for (const old of previous) {
        if (old.status === 'deleted' || seen.has(`${old.source_table}:${old.source_key}`)) continue;
        const [row] = await tx.execute<Stored>(sql`UPDATE mvp_fact SET status='deleted', version=version+1,
          updated_at=clock_timestamp() WHERE id=${old.id} RETURNING *`);
        await recordChange(row, 'deleted');
      }
      await tx.execute(sql`INSERT INTO mvp_fact_sync(adapter,last_checked_at,last_changed_at,source_count,changed_count)
        VALUES ('local-database',clock_timestamp(),CASE WHEN ${changed}>0 THEN clock_timestamp() ELSE NULL END,${sources.length},${changed})
        ON CONFLICT(adapter) DO UPDATE SET last_checked_at=excluded.last_checked_at,
          last_changed_at=COALESCE(excluded.last_changed_at,mvp_fact_sync.last_changed_at),
          source_count=excluded.source_count,changed_count=excluded.changed_count`);
      await tx.execute(sql`
        INSERT INTO mvp_employee_wide
          (employee_id,employee_slug,name,role,org,status,hire_date,summary,department,job_grade,personnel_role,
           work_location,preferred_track,is_demo,fact_count,project_count,performance_count,evidence_count,
           other_fact_count,latest_fact_at,fact_titles,refreshed_at)
        SELECT e.id,e.slug,e.name,e.role,e.org,e.status,e.hire_date,e.summary,e.department,e.job_grade,
          e.personnel_role,e.work_location,e.preferred_track,e.is_demo,
          count(f.id)::int,
          count(f.id) FILTER (WHERE f.kind='project')::int,
          count(f.id) FILTER (WHERE f.kind='performance')::int,
          count(f.id) FILTER (WHERE f.kind='legacy_evidence')::int,
          count(f.id) FILTER (WHERE f.kind NOT IN ('project','performance','legacy_evidence'))::int,
          max(f.updated_at),
          COALESCE(jsonb_agg(f.title ORDER BY f.updated_at DESC, f.id) FILTER (WHERE f.id IS NOT NULL),'[]'::jsonb),
          clock_timestamp()
        FROM employee e LEFT JOIN mvp_fact f ON f.employee_id=e.id AND f.status='active'
        GROUP BY e.id
        ON CONFLICT (employee_id) DO UPDATE SET
          employee_slug=excluded.employee_slug,name=excluded.name,role=excluded.role,org=excluded.org,
          status=excluded.status,hire_date=excluded.hire_date,summary=excluded.summary,
          department=excluded.department,job_grade=excluded.job_grade,personnel_role=excluded.personnel_role,
          work_location=excluded.work_location,preferred_track=excluded.preferred_track,is_demo=excluded.is_demo,
          fact_count=excluded.fact_count,project_count=excluded.project_count,
          performance_count=excluded.performance_count,evidence_count=excluded.evidence_count,
          other_fact_count=excluded.other_fact_count,latest_fact_at=excluded.latest_fact_at,
          fact_titles=excluded.fact_titles,refreshed_at=excluded.refreshed_at`);
      await tx.execute(sql`DELETE FROM mvp_employee_wide w WHERE NOT EXISTS (SELECT 1 FROM employee e WHERE e.id=w.employee_id)`);
    });
  }

  private async currentId(): Promise<string> {
    return currentEmployee().employeeId;
  }
  async status(): Promise<FactCenterStatus> {
    const id = await this.currentId();
    const [state] = await this.db.execute<{ last_checked_at: Date; last_changed_at: Date | null }>(sql`SELECT * FROM mvp_fact_sync WHERE adapter='local-database'`);
    const counts = await this.db.execute<{ kind: string; status: string; count: number }>(sql`SELECT kind,status,count(*)::int AS count FROM mvp_fact WHERE employee_id=${id} GROUP BY kind,status`);
    const [changed] = await this.db.execute<{ at: Date | null }>(sql`SELECT max(recorded_at) AS at FROM mvp_fact_change WHERE employee_id=${id}`);
    const [registry] = await this.db.execute<{ basic_info: FactCenterStatus['employee'] }>(sql`SELECT basic_info FROM mvp_fact_employee WHERE employee_id=${id}`);
    return { employee: registry?.basic_info ?? null, adapter: 'local-database', externalConnected: false, pollIntervalSeconds: 10, healthy: this.healthy,
      employeeId: id, lastCheckedAt: state ? new Date(state.last_checked_at).toISOString() : null,
      lastChangedAt: changed?.at ? new Date(changed.at).toISOString() : null,
      activeCount: counts.filter(r => r.status === 'active').reduce((n,r) => n+r.count,0),
      deletedCount: counts.filter(r => r.status === 'deleted').reduce((n,r) => n+r.count,0),
      countsByKind: Object.fromEntries(counts.filter(r => r.status === 'active').map(r => [r.kind,r.count])),
      assessment: process.env.ASSESSMENT_MODE !== 'real' || (process.env.AI_MODE === 'real' && process.env.AI_API_KEY && process.env.AI_MODEL && process.env.AI_BASE_URL) ? 'available' : 'not-configured', simulatedSources: [...new Set(counts.filter(r => r.status === 'active')
        .map(r => ({git_commit:'Git代码提交',okr:'OKR',employee_transfer:'员工调动'} as Record<string,string>)[r.kind]).filter(Boolean))],
      unavailableSources: ['真实Git系统','真实OKR系统','真实员工调动系统','外部事实中心'] };
  }
  async list(after: string, limit: number, kind?: string) {
    const id = await this.currentId();
    const rows = await this.db.execute<Stored>(sql`SELECT * FROM mvp_fact WHERE employee_id=${id} AND status='active'
      ${kind ? sql`AND kind=${kind}` : sql``} ${after ? sql`AND id>${after}::uuid` : sql``} ORDER BY id LIMIT ${limit+1}`);
    return { items: rows.slice(0,limit).map(present), nextAfter: rows.length>limit ? rows[limit-1].id : null };
  }
  async changes(after: string, limit: number, factId?: string) {
    const id = await this.currentId();
    const rows = await this.db.execute<{ cursor: string; operation: FactChange['operation']; snapshot: FactRecord; recorded_at: Date }>(sql`
      SELECT cursor::text AS cursor,operation,snapshot,recorded_at FROM mvp_fact_change WHERE employee_id=${id} AND cursor>${after}::bigint
      ${factId ? sql`AND fact_id=${factId}::uuid` : sql``} ORDER BY cursor LIMIT ${limit+1}`);
    const page = rows.slice(0,limit);
    return { items: page.map(r => ({ cursor: r.cursor, operation: r.operation, fact: r.snapshot, recordedAt: new Date(r.recorded_at).toISOString() })),
      nextCursor: page.at(-1)?.cursor ?? after, hasMore: rows.length>limit };
  }
  async detail(id: string) {
    const employeeId = await this.currentId();
    const [row] = await this.db.execute<Stored>(sql`SELECT * FROM mvp_fact WHERE id=${id}::uuid AND employee_id=${employeeId}`);
    if (!row) throw new NotFoundException('事实不存在或不属于当前员工');
    return present(row);
  }
}
