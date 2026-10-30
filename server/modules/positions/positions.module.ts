import { SkillStandardsModule } from '../skill-standards/skill-standards';
import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import type { PositionInput, PositionImportRow } from '@shared/api.interface';
import { PositionsService } from './positions.service';
import { parsePositionFile } from './position-import';
@Controller('api/positions')
class PositionsController {
  constructor(private readonly positions:PositionsService) {}
  @Get() catalog(){return this.positions.catalog();}
  @Get('export') async export(){
    const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[-: ]/g,'');
    return new StreamableFile(await this.positions.exportAll(),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',disposition:`attachment; filename*=UTF-8''${encodeURIComponent(`公司岗位技能标准_${stamp}.xlsx`)}`});
  }
  @Post() create(@Body() body:PositionInput){return this.positions.save(undefined,body);}
  @Post('import/preview') preview(@Body() body:{filename:string;content:string}){return this.positions.preview(parsePositionFile(body?.filename,body?.content));}
  @Post('import/confirm') confirm(@Body() body:{rows:PositionImportRow[];revision:string}){return this.positions.importRows(body?.rows,body?.revision);}
  @Patch(':slug') update(@Param('slug') slug:string,@Body() body:PositionInput){return this.positions.save(slug,body);}
  @Delete(':slug') archive(@Param('slug') slug:string,@Query('revision') revision:string){return this.positions.archive(slug,revision);}
}
@Module({imports:[SkillStandardsModule],controllers:[PositionsController],providers:[PositionsService]})
export class PositionsModule {}
