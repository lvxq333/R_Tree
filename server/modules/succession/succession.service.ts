import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import { currentEmployee } from '../auth/employee-context';
import type {
  Criticality,
  KeyPositionCatalog,
  KeyPositionCatalogTrack,
  KeyPositionRecord,
  KeyPositionSaveInput,
  SuccessionCandidateView,
  SuccessionGapView,
  SuccessionIncumbentView,
  SuccessionOverview,
  SuccessionPositionView,
} from '@shared/api.interface';

type TrackRow = { slug: string; name: string; family: 'T' | 'P' | 'F' | 'M' };
type LevelRow = { id: string; track_slug: string; level_code: string; name: string; level_order: number };
type KeyRow = { track_slug: string; level_code: string; criticality: Criticality; reason: string | null; impact: string | null };
type RequirementRow = { title_level_id: string; skill_slug: string; skill_name: string; required_level: number };
type PersonRow = {
  slug: string; name: string; avatar_text: string | null; avatar_tone: string | null; role: string | null;
  department: string | null; job_grade: string; preferred_track: string | null; hire_date: string | null;
};
type SkillRow = { employee_slug: string; skill_slug: string; level: number };
type Requirement = { skillSlug: string; skillName: string; requiredLevel: number };
type Filters = { department: string; track: string; level: string };

const FAMILY_TEXT: Record<string, string> = { T: '技术', P: '产品', F: '行政', M: '管理' };
const CRITICALITY_TEXT: Record<Criticality, string> = { core: '核心', key: '关键', normal: '一般' };
const CRITICALITY_KEYS: Criticality[] = ['core', 'key', 'normal'];
const WATCH_LIMIT = 3;
const gradeOrder = (grade: string) => Number(grade.slice(1));
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

function tenureText(hireDate: string | null): string {
  const matched = hireDate?.match(/^(\d{4})[.\-/](\d{1,2})/);
  if (!matched) return '任职时长未登记';
  const months = (new Date().getFullYear() - Number(matched[1])) * 12 + (new Date().getMonth() + 1 - Number(matched[2]));
  if (months < 0) return '任职时长未登记';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `任职 ${years} 年${rest ? ` ${rest} 个月` : ''}` : `任职 ${Math.max(1, rest)} 个月`;
}

@Injectable()
export class SuccessionService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /** 梯队盘点是管理者工作台能力，仅 HR 可见；其余角色直接拒绝。 */
  private access() {
    const user = currentEmployee();
    if (user.personnelRole !== 'hr') throw new ForbiddenException('梯队与继任需要 HR 权限');
    return user;
  }

  private async publishedVersion(): Promise<string> {
    const [row] = await this.db.execute<{ slug: string }>(sql`
      SELECT slug FROM mvp_standard_version WHERE status='published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 1`);
    if (!row) throw new BadRequestException('请先在岗位管理中发布标准版本');
    return row.slug;
  }

  private async tracks(): Promise<TrackRow[]> {
    return this.db.execute<TrackRow>(sql`
      SELECT slug,name,job_family AS family FROM mvp_title_track WHERE status<>'archived'
      ORDER BY job_family,name,slug`);
  }

  private async levels(version: string): Promise<LevelRow[]> {
    return this.db.execute<LevelRow>(sql`
      SELECT id,track_slug,level_code AS level_code,name,level_order FROM mvp_title_level
      WHERE standard_version_slug=${version} AND COALESCE(path_label,'')='' ORDER BY level_order`);
  }

  private async requirements(version: string): Promise<Map<string, Requirement[]>> {
    const rows = await this.db.execute<RequirementRow>(sql`
      SELECT r.title_level_id,r.skill_slug,COALESCE(s.name,r.skill_slug) AS skill_name,r.required_level
      FROM mvp_title_requirement r
      JOIN mvp_title_level l ON l.id=r.title_level_id
      LEFT JOIN skill s ON s.slug=r.skill_slug
      WHERE l.standard_version_slug=${version} AND r.is_required=true
      ORDER BY r.sort_order,r.skill_slug`);
    const grouped = new Map<string, Requirement[]>();
    for (const row of rows) {
      const list = grouped.get(row.title_level_id) ?? [];
      list.push({ skillSlug: row.skill_slug, skillName: row.skill_name, requiredLevel: row.required_level });
      grouped.set(row.title_level_id, list);
    }
    return grouped;
  }

  /** 在职员工（用于现任者与候选池）。部门筛选会同时收窄两者。 */
  private async people(department: string): Promise<PersonRow[]> {
    const condition = department ? sql`AND COALESCE(NULLIF(e.department,''),'未登记部门')=${department}` : sql``;
    return this.db.execute<PersonRow>(sql`
      SELECT e.slug,e.name,e.avatar_text,e.avatar_tone,e.role,
        COALESCE(NULLIF(e.department,''),'未登记部门') AS department,
        e.job_grade,e.preferred_track,e.hire_date
      FROM employee e
      WHERE e.status='active' AND e.job_grade~'^[TPMF][1-4]$' ${condition}
      ORDER BY e.name,e.slug`);
  }

  /** 有效认证：仅 status=active 且未过复核期的记录参与计算。 */
  private async skills(): Promise<SkillRow[]> {
    return this.db.execute<SkillRow>(sql`
      SELECT s.employee_slug,s.skill_slug,max(s.level)::int AS level FROM mvp_employee_skill s
      WHERE s.status='active' AND (s.review_due_at IS NULL OR s.review_due_at>=now())
      GROUP BY 1,2`);
  }

  private async keyRows(): Promise<KeyRow[]> {
    return this.db.execute<KeyRow>(sql`
      SELECT track_slug,level_code,criticality,reason,impact FROM mvp_key_position ORDER BY track_slug,level_code`);
  }

  async overview(input?: Partial<Filters>): Promise<SuccessionOverview> {
    this.access();
    const filters: Filters = {
      department: (input?.department ?? '').trim().slice(0, 255),
      track: (input?.track ?? '').trim().slice(0, 64),
      level: (input?.level ?? '').trim().slice(0, 8),
    };
    const version = await this.publishedVersion();
    const [tracks, levels, requirementMap, keyRows, people, skillRows, departmentRows] = await Promise.all([
      this.tracks(), this.levels(version), this.requirements(version), this.keyRows(),
      this.people(filters.department),
      this.skills(),
      this.db.execute<{ department: string }>(sql`
        SELECT DISTINCT COALESCE(NULLIF(e.department,''),'未登记部门') AS department FROM employee e
        WHERE e.status='active' AND e.job_grade~'^[TPMF][1-4]$' ORDER BY department`),
    ]);
    const trackMap = new Map(tracks.map(track => [track.slug, track]));
    const levelMap = new Map(levels.map(level => [`${level.track_slug}:${level.level_code}`, level]));
    const personMap = new Map(people.map(person => [person.slug, person]));
    const employeeSkills = new Map<string, Map<string, number>>();
    for (const row of skillRows) {
      const bucket = employeeSkills.get(row.employee_slug) ?? new Map<string, number>();
      bucket.set(row.skill_slug, Math.max(bucket.get(row.skill_slug) ?? 0, row.level));
      employeeSkills.set(row.employee_slug, bucket);
    }
    const selected = keyRows.filter(row =>
      (!filters.track || row.track_slug === filters.track) && (!filters.level || row.level_code === filters.level));

    const positions: SuccessionPositionView[] = [];
    for (const key of selected) {
      const track = trackMap.get(key.track_slug);
      const level = levelMap.get(`${key.track_slug}:${key.level_code}`);
      // 岗位被删除或标准换版后职级消失时跳过，避免展示无法计算的行。
      if (!track || !level) continue;
      const requirements = requirementMap.get(level.id) ?? [];
      const incumbents = people.filter(person =>
        person.preferred_track === key.track_slug && person.job_grade === key.level_code);
      const incumbentSlugs = new Set(incumbents.map(person => person.slug));
      const targetOrder = level.level_order;
      // 部门视角只盘点本部门有人任职的关键岗位，避免把「该部门没有这个岗位」误判成岗位空缺。
      if (filters.department && !incumbents.length) continue;
      // 候选池：职级低于目标岗位，或同职级跨序列（平级调动）；不含同级同事与高职级人员。
      const pool = people.filter(person => !incumbentSlugs.has(person.slug) && (
        gradeOrder(person.job_grade) < targetOrder ||
        (gradeOrder(person.job_grade) === targetOrder && person.preferred_track !== key.track_slug)));

      const metByRequirement = new Map<string, number>();
      const candidates: SuccessionCandidateView[] = [];
      for (const person of pool) {
        const owned = employeeSkills.get(person.slug) ?? new Map<string, number>();
        const gaps: SuccessionGapView[] = [];
        let met = 0;
        let credit = 0;
        let denom = 0;
        for (const requirement of requirements) {
          const current = owned.get(requirement.skillSlug) ?? 0;
          denom += requirement.requiredLevel;
          credit += Math.min(current, requirement.requiredLevel);
          if (current >= requirement.requiredLevel) {
            met += 1;
            metByRequirement.set(requirement.skillSlug, (metByRequirement.get(requirement.skillSlug) ?? 0) + 1);
          } else {
            gaps.push({ skillName: requirement.skillName, current, required: requirement.requiredLevel });
          }
        }
        if (!requirements.length) continue;
        const weighted = denom ? Math.round(credit / denom * 100) : 0;
        // 完全没有相关认证的人不进入名单，避免用人名单被无关员工淹没。
        if (weighted <= 0) continue;
        const readiness = Math.round(met / requirements.length * 100);
        const state: SuccessionCandidateView['state'] =
          met === requirements.length ? 'ready' : met * 2 >= requirements.length ? 'developing' : 'watch';
        candidates.push({
          employeeId: person.slug,
          name: person.name,
          avatar: person.avatar_text || person.name.slice(-2),
          tone: person.avatar_tone || 'blue',
          grade: person.job_grade,
          trackName: person.preferred_track ? trackMap.get(person.preferred_track)?.name ?? person.preferred_track : '未登记序列',
          department: person.department ?? '未登记部门',
          role: person.role ?? '未登记岗位',
          met,
          total: requirements.length,
          readiness,
          weighted,
          state,
          stateText: state === 'ready' ? '可立即接任' : state === 'developing' ? '6–12 个月' : '待观察',
          gaps,
          gapText: gaps.length
            ? gaps.map(gap => `${gap.skillName}：${gap.current ? `L${gap.current}` : '无有效认证'} → L${gap.required}`).join('；')
            : `全部 ${requirements.length} 项必备技能已达标`,
        });
      }
      const byRank = (left: SuccessionCandidateView, right: SuccessionCandidateView) =>
        right.met - left.met || right.weighted - left.weighted || left.name.localeCompare(right.name, 'zh-Hans-CN');
      const ready = candidates.filter(item => item.state === 'ready').sort(byRank);
      const developing = candidates.filter(item => item.state === 'developing').sort(byRank);
      const watch = candidates.filter(item => item.state === 'watch').sort(byRank).slice(0, WATCH_LIMIT);

      const incumbentViews: SuccessionIncumbentView[] = incumbents.map(person => ({
        employeeId: person.slug,
        name: person.name,
        avatar: person.avatar_text || person.name.slice(-2),
        tone: person.avatar_tone || 'blue',
        department: person.department ?? '未登记部门',
        grade: person.job_grade,
        tenure: tenureText(person.hire_date),
      }));
      const vacancy = incumbentViews.length === 0;
      const health: SuccessionPositionView['health'] = !requirements.length ? 'unrated'
        : vacancy || (!ready.length && !developing.length) ? 'risk'
        : ready.length ? 'healthy' : 'attention';
      const healthText = { healthy: '健康', attention: '需关注', risk: '高风险', unrated: '待配置标准' }[health];

      const gapSummary = [...new Set(candidates.flatMap(item => item.gaps.map(gap => gap.skillName)))].slice(0, 3);
      const closest = [...candidates].sort(byRank)[0];
      const notes: string[] = [];
      if (health === 'unrated') {
        notes.push('该岗位未配置必备技能标准，无法计算继任准备度；请先到岗位管理补齐该职级要求。');
      } else if (vacancy) {
        notes.push(`岗位空缺：当前范围内无人任职${ready.length ? `，已有 ${ready.length} 名候选人达标，建议尽快确认代理与任命` : '，暂无达标候选人，需外部招聘或跨序列培养'}。`);
      } else if (health === 'healthy') {
        notes.push(`已有 ${ready.length} 名候选人满足全部 ${requirements.length} 项必备技能，可随时接任。`);
      } else if (health === 'attention') {
        notes.push(`暂无达标候选人；${developing.length} 人已达标半数以上，缺口集中在${gapSummary.join('、') || '少数技能'}，可在 6–12 个月内补齐。`);
      } else {
        notes.push(closest
          ? `无人在有效期内达标全部必备技能；最接近为 ${closest.name}（接近度 ${closest.weighted}%，缺 ${closest.gaps.length} 项：${closest.gaps.map(gap => gap.skillName).join('、')}）。`
          : '候选池内没有任何相关认证记录，需扩大搜索范围或先建立能力基线。');
      }
      if (!vacancy && incumbentViews.length === 1) notes.push('仅 1 名现任者承担该岗位职责，无备份。');
      if (!vacancy && incumbentViews.length > 1) notes.push(`${incumbentViews.length} 人共同在任，交接风险相对分散。`);

      positions.push({
        slug: `${key.track_slug}:${key.level_code}`,
        trackSlug: key.track_slug,
        trackName: track.name,
        family: track.family,
        levelCode: key.level_code,
        levelName: level.name,
        title: level.name,
        criticality: key.criticality,
        criticalityText: CRITICALITY_TEXT[key.criticality] ?? '关键',
        reason: key.reason ?? '',
        impact: key.impact ?? '',
        vacancy,
        incumbents: incumbentViews,
        incumbentLabel: vacancy
          ? '空缺'
          : incumbentViews.length <= 3
            ? incumbentViews.map(item => item.name).join('、')
            : `${incumbentViews[0].name} 等 ${incumbentViews.length} 人`,
        incumbentMeta: vacancy
          ? '当前无人在任'
          : incumbentViews.length === 1
            ? `${incumbentViews[0].grade} · ${incumbentViews[0].tenure}`
            : `${incumbentViews.length} 人在任 · 分布 ${new Set(incumbentViews.map(item => item.department)).size} 个部门`,
        requirements: requirements.map(requirement => ({
          skillName: requirement.skillName,
          requiredLevel: requirement.requiredLevel,
          metCount: metByRequirement.get(requirement.skillSlug) ?? 0,
        })),
        ready,
        developing,
        watch,
        health,
        healthText,
        riskNote: notes.join(' '),
        poolSize: pool.length,
      });
    }
    positions.sort((left, right) =>
      ['risk', 'attention', 'unrated', 'healthy'].indexOf(left.health) - ['risk', 'attention', 'unrated', 'healthy'].indexOf(right.health)
      || left.trackName.localeCompare(right.trackName, 'zh-Hans-CN')
      || right.levelCode.localeCompare(left.levelCode));

    return {
      positions,
      summary: {
        keyPositions: positions.length,
        healthy: positions.filter(item => item.health === 'healthy').length,
        attention: positions.filter(item => item.health === 'attention').length,
        risk: positions.filter(item => item.health === 'risk').length,
        unrated: positions.filter(item => item.health === 'unrated').length,
        readyCount: positions.reduce((sum, item) => sum + item.ready.length, 0),
        developingCount: positions.reduce((sum, item) => sum + item.developing.length, 0),
        covered: positions.filter(item => item.ready.length > 0).length,
      },
      filters: {
        departments: departmentRows.map(row => row.department),
        tracks: tracks.map(track => ({ slug: track.slug, name: track.name })),
        levels: ['T', 'P', 'M', 'F'].flatMap(family => [1, 2, 3, 4].map(order => `${family}${order}`)),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  async catalog(): Promise<KeyPositionCatalog> {
    this.access();
    const version = await this.publishedVersion();
    const [tracks, levels, keyRows, holderRows] = await Promise.all([
      this.tracks(), this.levels(version), this.keyRows(),
      this.db.execute<{ track_slug: string; level_code: string; holders: number }>(sql`
        SELECT preferred_track AS track_slug,job_grade AS level_code,count(*)::int AS holders FROM employee
        WHERE status='active' AND job_grade~'^[TPMF][1-4]$' AND preferred_track IS NOT NULL
        GROUP BY 1,2`),
    ]);
    const holderMap = new Map(holderRows.map(row => [`${row.track_slug}:${row.level_code}`, row.holders]));
    const keyMap = new Map(keyRows.map(row => [`${row.track_slug}:${row.level_code}`, row]));
    const catalogTracks: KeyPositionCatalogTrack[] = tracks.map(track => ({
      slug: track.slug,
      name: track.name,
      family: track.family,
      levels: levels.filter(level => level.track_slug === track.slug).map(level => {
        const key = keyMap.get(`${track.slug}:${level.level_code}`);
        return {
          code: level.level_code,
          name: level.name,
          order: level.level_order,
          holders: holderMap.get(`${track.slug}:${level.level_code}`) ?? 0,
          selected: Boolean(key),
          criticality: key?.criticality ?? 'key',
          reason: key?.reason ?? '',
          impact: key?.impact ?? '',
        };
      }),
    })).filter(track => track.levels.length > 0);
    return { tracks: catalogTracks, updatedAt: new Date().toISOString() };
  }

  async save(input: unknown): Promise<KeyPositionCatalog> {
    this.access();
    const body = input as KeyPositionSaveInput;
    if (!body || typeof body !== 'object' || !Array.isArray(body.positions)) throw new BadRequestException('缺少关键岗位名录');
    if (body.positions.length > 48) throw new BadRequestException('关键岗位最多 48 个');
    const version = await this.publishedVersion();
    const [tracks, levels] = await Promise.all([this.tracks(), this.levels(version)]);
    const knownTracks = new Set(tracks.map(track => track.slug));
    const knownLevels = new Set(levels.map(level => `${level.track_slug}:${level.level_code}`));
    const seen = new Set<string>();
    const rows: (KeyPositionRecord & { slug: string })[] = [];
    for (const item of body.positions) {
      if (!item || typeof item !== 'object') throw new BadRequestException('名录数据格式无效');
      const trackSlug = String(item.trackSlug ?? '').trim();
      const levelCode = String(item.levelCode ?? '').trim();
      if (!knownTracks.has(trackSlug) || !knownLevels.has(`${trackSlug}:${levelCode}`)) throw new BadRequestException('岗位不存在或尚未配置该职级标准');
      const unique = `${trackSlug}:${levelCode}`;
      if (seen.has(unique)) throw new BadRequestException('同一岗位重复提交');
      seen.add(unique);
      const criticality = (CRITICALITY_KEYS as string[]).includes(item.criticality) ? item.criticality : 'key';
      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
      const impact = typeof item.impact === 'string' ? item.impact.trim() : '';
      if (reason.length > 255 || impact.length > 255) throw new BadRequestException('关键理由与影响范围各不超过 255 字');
      rows.push({ trackSlug, levelCode, criticality, reason, impact, slug: `key-${trackSlug}-${levelCode}`.slice(0, 96) });
    }
    await this.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(20772024)`);
      const existing = await tx.execute<{ track_slug: string; level_code: string }>(sql`SELECT track_slug,level_code FROM mvp_key_position`);
      const keep = new Set(rows.map(row => `${row.trackSlug}:${row.levelCode}`));
      const removed = existing.filter(row => !keep.has(`${row.track_slug}:${row.level_code}`));
      for (const row of removed) {
        await tx.execute(sql`DELETE FROM mvp_key_position WHERE track_slug=${row.track_slug} AND level_code=${row.level_code}`);
      }
      for (const [index, row] of rows.entries()) {
        await tx.execute(sql`
          INSERT INTO mvp_key_position(slug,track_slug,level_code,criticality,reason,impact,sort)
          VALUES(${row.slug},${row.trackSlug},${row.levelCode},${row.criticality},${row.reason},${row.impact},${index})
          ON CONFLICT (track_slug,level_code) DO UPDATE SET criticality=${row.criticality},reason=${row.reason},
            impact=${row.impact},sort=${index},updated_at=now()`);
      }
    });
    return this.catalog();
  }

  async exportWorkbook(input?: Partial<Filters>): Promise<Buffer> {
    const data = await this.overview(input);
    const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
    const header = ['关键岗位', '序列', '序列族', '职级', '关键性', '现任者', '在任情况', '在任人数', '可立即接任',
      '6–12 个月', '候选池', '健康度', '风险与建议', '可立即接任名单', '6–12 个月名单（接近度）', '岗位必备技能',
      '关键理由', '影响范围', '数据截至'];
    const sheet: (string | number)[][] = [header];
    for (const position of data.positions) {
      sheet.push([
        position.title, position.trackName, FAMILY_TEXT[position.family] ?? position.family, position.levelCode,
        position.criticalityText, position.incumbentLabel, position.incumbentMeta, position.incumbents.length,
        position.ready.length, position.developing.length, position.poolSize, position.healthText,
        oneLine(position.riskNote),
        position.ready.map(item => `${item.name}（${item.grade}，${item.readiness}%）`).join('；'),
        position.developing.map(item => `${item.name}（${item.grade}，接近度 ${item.weighted}%）`).join('；'),
        position.requirements.map(item => `${item.skillName} L${item.requiredLevel}（达标 ${item.metCount} 人）`).join('；'),
        position.reason, position.impact, stamp,
      ]);
    }
    const summary = [
      ['梯队盘点汇总', '数值'],
      ['关键岗位', data.summary.keyPositions],
      ['健康', data.summary.healthy],
      ['需关注', data.summary.attention],
      ['高风险', data.summary.risk],
      ['待配置标准', data.summary.unrated],
      ['可立即接任候选（人次）', data.summary.readyCount],
      ['6–12 个月可培养（人次）', data.summary.developingCount],
      ['已有达标候选的岗位', data.summary.covered],
      ['口径', '候选池=职级低于目标岗位或同职级跨序列；必备技能以有效期内认证计；达标=全部必备项达标'],
      ['数据截至', stamp],
    ];
    const workbook = XLSX.utils.book_new();
    const sheetA = XLSX.utils.aoa_to_sheet(sheet);
    sheetA['!cols'] = header.map((_, index) => ({ wch: [22, 16, 8, 8, 8, 18, 22, 10, 10, 10, 8, 10, 60, 30, 34, 50, 24, 24, 12][index] ?? 14 }));
    XLSX.utils.book_append_sheet(workbook, sheetA, '岗位梯队盘点');
    const sheetB = XLSX.utils.aoa_to_sheet(summary);
    sheetB['!cols'] = [{ wch: 26 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, sheetB, '汇总与口径');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return buffer;
  }

  exportFilename(): string {
    const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
    return `梯队盘点_${stamp}.xlsx`;
  }
}
