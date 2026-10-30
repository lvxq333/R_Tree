import { BadRequestException, ConflictException, Controller, Get, Inject, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/platform/local-platform';
import type { PositionSkillStandard, SkillAssessmentStandard, SkillLevelStandard } from '@shared/api.interface';

type DB = Pick<PostgresJsDatabase,'execute'>;
export const blankLevels = (): SkillLevelStandard[] => [1,2,3,4,5].map(level=>({level,anchor:'',evidence:''}));
@Injectable()
export class SkillStandardsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db:PostgresJsDatabase) {}
  async version(db:DB=this.db) {
    const [v]=await db.execute<{slug:string}>(sql`SELECT slug FROM mvp_standard_version WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 1`);
    if(!v)throw new BadRequestException('请先配置已发布的标准版本');return v.slug;
  }
  async read(slug:string,db:DB=this.db,version?:string):Promise<{definition:PositionSkillStandard;assessment:SkillAssessmentStandard}> {
    const [skill]=await db.execute<{name:string}>(sql`SELECT name FROM skill WHERE slug=${slug}`);
    if(!skill)throw new NotFoundException('技能不存在');
    version??=await this.version(db);
    const [saved]=await db.execute<{description:string;levels:SkillLevelStandard[]}>(sql`SELECT description,levels FROM mvp_position_skill_standard WHERE skill_slug=${slug} AND standard_version_slug=${version}`);
    const mapped=await db.execute<{slug:string;name:string;level:number;anchor:string}>(sql`
      SELECT DISTINCT c.slug,c.name,cl.level,cl.anchor FROM mvp_skill_competency sc
      JOIN mvp_competency c ON c.slug=sc.competency_slug JOIN mvp_competency_level cl ON cl.competency_slug=c.slug
      WHERE sc.skill_slug=${slug} AND sc.standard_version_slug=${version} ORDER BY c.slug,cl.level`);
    const legacy=await db.execute<{level:number;anchor:string|null}>(sql`SELECT level,anchor FROM skill_level_anchor WHERE skill_slug=${slug}`);
    const levels=saved?.levels??blankLevels().map(l=>({...l,anchor:mapped.filter(r=>r.level===l.level).map(r=>`${r.name}：${r.anchor}`).join('\n')||legacy.find(r=>r.level===l.level)?.anchor||''}));
    const description=saved?.description??'';
    const revision=createHash('sha256').update(JSON.stringify({slug,version,description,levels})).digest('hex');
    const ids=[...new Set(mapped.map(r=>r.slug))];
    const abilities=saved||!ids.length ? [{id:slug,name:skill.name,anchors:levels.map(l=>l.anchor||'该等级暂未配置行为锚点'),...(saved?{evidenceRequirements:levels.map(l=>l.evidence)}:{})}]
      : ids.map(id=>({id,name:mapped.find(r=>r.slug===id)!.name,anchors:[1,2,3,4,5].map(n=>mapped.find(r=>r.slug===id&&r.level===n)?.anchor??'该等级暂未配置行为锚点')}));
    const content={skillSlug:slug,name:skill.name,version:saved?`${version}@${revision.slice(0,12)}`:version,abilities,
      ...(saved||slug.startsWith('position-skill-')?{description,managed:true,configuredLevels:description.trim()?levels.filter(l=>l.anchor.trim()&&l.evidence.trim()).map(l=>l.level):[]}: {})};
    return {definition:{description,levels,revision},assessment:{...content,hash:createHash('sha256').update(JSON.stringify(content)).digest('hex')}};
  }
  validate(definition:PositionSkillStandard) {
    if(!definition||typeof definition.description!=='string'||definition.description.length>4000||typeof definition.revision!=='string'||!Array.isArray(definition.levels)||definition.levels.length!==5)
      throw new BadRequestException('技能说明最多4000字，必须包含 L1–L5 等级标准');
    const seen=new Set<number>();for(const l of definition.levels){if(!l||!Number.isInteger(l.level)||l.level<1||l.level>5||seen.has(l.level)||typeof l.anchor!=='string'||typeof l.evidence!=='string'||l.anchor.length>4000||l.evidence.length>4000)throw new BadRequestException('技能等级不可重复，每级达标标准和证明要求分别最多4000字');seen.add(l.level);}
  }
  async save(db:DB,slug:string,version:string,definition:PositionSkillStandard) {
    this.validate(definition);
    const current=await this.read(slug,db,version);
    const levels=[...definition.levels].sort((a,b)=>a.level-b.level).map(l=>({...l,anchor:l.anchor.trim(),evidence:l.evidence.trim()}));
    const description=definition.description.trim();
    // 未编辑的既有标准不转为自定义标准，保留原来的子能力评估口径。
    if(description===current.definition.description&&JSON.stringify(levels)===JSON.stringify(current.definition.levels))return;
    if((!definition.revision&&(current.definition.description||current.definition.levels.some(l=>l.anchor||l.evidence)))||(definition.revision&&definition.revision!==current.definition.revision))throw new ConflictException('技能标准已被其他岗位修改，请刷新后重新配置');
    await db.execute(sql`INSERT INTO mvp_position_skill_standard(skill_slug,standard_version_slug,description,levels)
      VALUES(${slug},${version},${description},${JSON.stringify(levels)}::jsonb)
      ON CONFLICT(skill_slug,standard_version_slug) DO UPDATE SET description=excluded.description,levels=excluded.levels,updated_at=clock_timestamp()`);
  }
  async publicStandard(slug:string) {return (await this.read(slug)).assessment;}
}
@Controller('api/skills')
class SkillStandardsController {
  constructor(private readonly standards:SkillStandardsService) {}
  @Get(':slug/standard') get(@Param('slug') slug:string){return this.standards.publicStandard(slug);}
}
@Module({controllers:[SkillStandardsController],providers:[SkillStandardsService],exports:[SkillStandardsService]})
export class SkillStandardsModule {}
