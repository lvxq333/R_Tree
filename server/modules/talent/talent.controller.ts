import { Body, Controller, Delete, Get, Param, Post, Put, StreamableFile } from '@nestjs/common';
import { TalentService } from './talent.service';
import type { TalentCriteria, TalentSearchInput, TalentWorkspace } from '@shared/api.interface';
@Controller('api/talent')
export class TalentController {
  constructor(private readonly talent:TalentService) {}
  @Get('catalog') catalog(){return this.talent.catalog();}
  @Get('workspace') workspace(){return this.talent.workspace();}
  @Put('workspace') save(@Body() body:TalentWorkspace){return this.talent.saveWorkspace(body);}
  @Post('parse') parse(@Body() body:{prompt:string}){return this.talent.parse(body?.prompt);}
  @Get('candidates') candidates(){return this.talent.legacyCandidates();}
  @Post('search') search(@Body() body:TalentSearchInput){return this.talent.search(body);}
  @Get('shortlist') shortlist(){return this.talent.getShortlist();}
  @Post('shortlist/preview') preview(@Body() body:{criteria:TalentCriteria}){return this.talent.getShortlist(body?.criteria);}
  @Post('shortlist/export') async export(@Body() body:{criteria:TalentCriteria}){
    const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
    return new StreamableFile(await this.talent.exportShortlist(body?.criteria),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition:`attachment; filename*=UTF-8''${encodeURIComponent(`候选名单_${stamp}.xlsx`)}`});
  }
  @Post('shortlist/:candidateSlug') add(@Param('candidateSlug') slug:string){return this.talent.addToShortlist(slug);}
  @Delete('shortlist/:candidateSlug') remove(@Param('candidateSlug') slug:string){return this.talent.removeFromShortlist(slug);}
  @Delete('shortlist') clear(){return this.talent.clearShortlist();}
}
