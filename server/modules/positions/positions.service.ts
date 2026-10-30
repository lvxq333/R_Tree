import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type { JobFamily, PositionCatalog, PositionGrade, PositionInput, PositionImportRow, PositionSkillStandard } from '@shared/api.interface';
import { SkillStandardsService, blankLevels } from '../skill-standards/skill-standards';
import { validateImportRows } from './position-import';
import { validatePosition } from '@shared/position-validation';
import { exportPositionWorkbook } from './position-export';

type DB = Pick<PostgresJsDatabase,'execute'>;
type Track = {slug:string;name:string;family:JobFamily;revision:string};
const LOCK=20772020;
const familyNames={T:'技术',P:'产品',F:'行政',M:'管理'};
@Injectable()
export class PositionsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase, private readonly standards:SkillStandardsService) {}
  private async version(db: DB) {
    const [v]=await db.execute<{slug:string}>(sql`SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1`);
    if(!v) throw new BadRequestException('请先配置已发布的标准版本');
    return v.slug;
  }
  private async tracks(db: DB) {
    return db.execute<Track>(sql`SELECT slug,name,job_family AS family,updated_at::text AS revision FROM mvp_title_track WHERE status<>'archived' ORDER BY job_family,name,slug`);
  }
  private token(tracks: Track[], version: string, standards: unknown = {}) {return createHash('sha256').update(JSON.stringify([version,tracks,standards])).digest('hex');}
  async catalog(connection?: DB): Promise<PositionCatalog> {
    const read = async (db: DB): Promise<PositionCatalog> => {
      const version=await this.version(db),tracks=await this.tracks(db);
      const levels=await db.execute<{id:string;track_slug:string;code:string;name:string;level_order:number}>(sql`SELECT id,track_slug,level_code AS code,name,level_order FROM mvp_title_level WHERE standard_version_slug=${version} AND COALESCE(path_label,'')='' ORDER BY level_order`);
      const requirements=await db.execute<{id:string;skill_name:string;required_level:number;is_required:boolean}>(sql`SELECT r.title_level_id AS id,COALESCE(s.name,r.skill_slug) AS skill_name,r.required_level,r.is_required FROM mvp_title_requirement r JOIN mvp_title_level l ON l.id=r.title_level_id LEFT JOIN skill s ON s.slug=r.skill_slug WHERE l.standard_version_slug=${version} ORDER BY r.sort_order,skill_name,r.id`);
      const skills=await db.execute<{slug:string;name:string}>(sql`SELECT DISTINCT ON (name) slug,name FROM skill ORDER BY name,slug`);
      const definitions=await Promise.all(skills.map(async s=>[s.name,(await this.standards.read(s.slug,db,version)).definition] as const));
      const skillStandards=Object.fromEntries(definitions);
      return {skillStandards,standardVersion:version,revision:this.token(tracks,version,skillStandards),canEdit:true,skills:skills.map(s=>s.name),directions:tracks.map(t=>({...t,grades:[1,2,3,4].map(n=>{
        const level=levels.find(l=>l.track_slug===t.slug&&l.level_order===n);
        return {code:`${t.family}${n}`,name:level?.name??`${t.name} ${t.family}${n}`,requirements:requirements.filter(r=>r.id===level?.id).map(r=>({skillName:r.skill_name,requiredLevel:r.required_level,isRequired:r.is_required,standard:skillStandards[r.skill_name]}))};
      })}))};
    };
    return connection ? read(connection) : this.db.transaction(read,{isolationLevel:'repeatable read'});
  }
  private validate(input: PositionInput) {
    const issues=validatePosition(input);
    if(issues.length) throw new BadRequestException({message:'岗位配置不完整，请补齐全部字段',issues});
  }
  async exportAll() { return exportPositionWorkbook(await this.catalog()); }
  async archive(slug:string,revision:string) {
    return this.db.transaction(async db=>{
      await db.execute(sql`SELECT pg_advisory_xact_lock(${LOCK})`);
      const [track]=await db.execute<Track>(sql`SELECT slug,updated_at::text AS revision FROM mvp_title_track WHERE slug=${slug} AND status<>'archived'`);
      if(!track)throw new NotFoundException('方向不存在或已删除');
      if(!revision||track.revision!==revision)throw new ConflictException('方向已发生变化，请刷新后重试');
      await db.execute(sql`UPDATE mvp_title_track SET status='archived',updated_at=clock_timestamp() WHERE slug=${slug}`);
      return {slug};
    });
  }
  private async skill(db: DB,name:string) {
    const [existing]=await db.execute<{slug:string}>(sql`SELECT slug FROM skill WHERE name=${name} ORDER BY slug LIMIT 1`);
    if(existing)return existing.slug;
    const slug='position-skill-'+randomUUID();
    await db.execute(sql`INSERT INTO skill(slug,name,category_slug) VALUES(${slug},${name},'position-custom-skills')`);return slug;
  }
  private async writeGrades(db: DB,slug:string,version:string,grades:PositionGrade[]) {
    for(const grade of grades) {
      // 只维护主路径；保留历史版本和已有双路径数据。
      const existing=await db.execute<{id:string}>(sql`SELECT id FROM mvp_title_level WHERE track_slug=${slug} AND level_order=${Number(grade.code.slice(1))} AND standard_version_slug=${version} AND COALESCE(path_label,'')=''`);
      let id=existing[0]?.id;
      if(!id){const [l]=await db.execute<{id:string}>(sql`INSERT INTO mvp_title_level(track_slug,level_order,level_code,name,path_label,standard_version_slug) VALUES(${slug},${Number(grade.code[1])},${grade.code},${grade.name.trim()},'',${version}) RETURNING id`);id=l.id;}
      else await db.execute(sql`UPDATE mvp_title_level SET name=${grade.name.trim()},level_code=${grade.code},updated_at=now() WHERE id=${id}`);
      await db.execute(sql`DELETE FROM mvp_title_requirement WHERE title_level_id=${id}`);
      for(const [order,r] of grade.requirements.entries()) {
        const skill=await this.skill(db,r.skillName.trim());
        await db.execute(sql`INSERT INTO mvp_title_requirement(title_level_id,skill_slug,required_level,is_auto,is_required,sort_order) VALUES(${id},${skill},${r.requiredLevel},false,${r.isRequired!},${order})`);
      }
    }
  }
  private async write(db: DB,slug:string|undefined,input:PositionInput,version:string) {
    const duplicates=await db.execute(sql`SELECT slug FROM mvp_title_track WHERE job_family=${input.family} AND name=${input.name.trim()} AND status<>'archived' AND slug<>${slug??''}`);
    if(duplicates.length)throw new ConflictException('该序列已存在同名方向');
    if(slug) {
      const [track]=await db.execute<Track>(sql`SELECT slug,updated_at::text AS revision FROM mvp_title_track WHERE slug=${slug} AND status<>'archived'`);
      if(!track)throw new NotFoundException('方向不存在');
      if(track.revision!==input.revision)throw new ConflictException('该方向已被修改，请刷新后重新编辑');
      await db.execute(sql`UPDATE employee SET job_grade=${input.family}||substring(job_grade from 2) WHERE preferred_track=${slug} AND job_grade~'^[TPMF][1-4]$'`);
      await db.execute(sql`UPDATE mvp_employee_wide w SET job_grade=e.job_grade FROM employee e WHERE e.preferred_track=${slug} AND w.employee_slug=e.slug`);
      await db.execute(sql`UPDATE mvp_title_track SET pipeline=${['F','M'].includes(input.family)?'management':'tech'},name=${input.name.trim()},job_family=${input.family},category=${familyNames[input.family]},updated_at=clock_timestamp() WHERE slug=${slug}`);
    } else {
      slug='position-'+randomUUID();
      await db.execute(sql`INSERT INTO mvp_title_track(slug,name,category,job_family,pipeline,status) VALUES(${slug},${input.name.trim()},${familyNames[input.family]},${input.family},${['F','M'].includes(input.family)?'management':'tech'},'published')`);
    }
    const definitions=new Map<string,PositionSkillStandard>();
    for(const g of input.grades)for(const r of g.requirements)if(r.standard)definitions.set(r.skillName.trim(),r.standard);
    for(const [name,definition] of definitions){const skill=await this.skill(db,name);await this.standards.save(db,skill,version,definition);}
    await this.writeGrades(db,slug,version,input.grades);return slug;
  }
  async save(slug:string|undefined,input:PositionInput) {
    this.validate(input);
    return this.db.transaction(async db=>{await db.execute(sql`SELECT pg_advisory_xact_lock(${LOCK})`);return {slug:await this.write(db,slug,input,await this.version(db))};});
  }
  private importInputs(rows:PositionImportRow[],catalog:PositionCatalog) {
    const groups=new Map<string,PositionImportRow[]>();
    const definitions=structuredClone(catalog.skillStandards);
    for(const row of rows){
      const key=JSON.stringify([row.family,row.direction]);groups.set(key,[...(groups.get(key)??[]),row]);
      const definition=row.standard?structuredClone(row.standard):definitions[row.skillName]??{description:'',levels:blankLevels(),revision:''};
      definition.revision=catalog.skillStandards[row.skillName]?.revision??'';
      if(row.skillDescription!==undefined)definition.description=row.skillDescription;
      const level=definition.levels?.find(l=>l.level===row.requiredLevel);
      if(level){if(row.levelDescription!==undefined)level.anchor=row.levelDescription;if(row.evidenceRequirements!==undefined)level.evidence=row.evidenceRequirements;}
      definitions[row.skillName]=definition;
    }
    return [...groups.values()].map(group=>{
      const {family,direction:name}=group[0];
      const existing=catalog.directions.find(d=>d.family===family&&d.name===name);
      const grades:PositionGrade[]=existing?structuredClone(existing.grades):[1,2,3,4].map(n=>({code:`${family}${n}`,name:`${name} ${family}${n}`,requirements:[]}));
      for(const row of group){
        const grade=grades.find(g=>g.code===row.grade)!;
        const r=grade.requirements.find(r=>r.skillName===row.skillName);
        if(r){r.requiredLevel=row.requiredLevel;r.isRequired=row.isRequired??r.isRequired;}
        else grade.requirements.push({skillName:row.skillName,requiredLevel:row.requiredLevel,isRequired:row.isRequired});
      }
      for(const grade of grades)for(const r of grade.requirements)r.standard=structuredClone(definitions[r.skillName]);
      return {slug:existing?.slug,input:{family,name,grades,revision:existing?.revision}};
    });
  }
  async preview(parsed: import('@shared/api.interface').PositionImportPreview) {
    if(parsed.errors.length)return parsed;
    const catalog=await this.catalog();
    const errors=this.importInputs(parsed.rows,catalog).flatMap(({input})=>validatePosition(input).map(i=>`${input.name} → ${i.message}`));
    return {...parsed,errors};
  }
  async importRows(rows:PositionImportRow[],revision:string) {
    const parsed=validateImportRows(rows);if(parsed.errors.length)throw new BadRequestException(parsed.errors.join('；'));
    return this.db.transaction(async db=>{
      await db.execute(sql`SELECT pg_advisory_xact_lock(${LOCK})`);
      const version=await this.version(db),catalog=await this.catalog(db);
      if(catalog.revision!==revision)throw new ConflictException('岗位标准已变化，请刷新并重新预览导入');
      const inputs=this.importInputs(parsed.rows,catalog);
      for(const {input} of inputs)this.validate(input);
      for(const {slug,input} of inputs){
        for(const g of input.grades)for(const r of g.requirements){
          const [skill]=await db.execute<{slug:string}>(sql`SELECT slug FROM skill WHERE name=${r.skillName} ORDER BY slug LIMIT 1`);
          if(skill)r.standard!.revision=(await this.standards.read(skill.slug,db,version)).definition.revision;
        }
        await this.write(db,slug,input,version);
      }
      return {directions:inputs.length,requirements:parsed.rows.length};
    });
  }
}
