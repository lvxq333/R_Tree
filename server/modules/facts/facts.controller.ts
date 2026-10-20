import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import { FactsService } from './facts.service';
import { FACT_KINDS } from '@shared/api.interface';

function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('无效事实 ID');
  return value;
}
function limit(value = '30'): number {
  if (!/^\d+$/.test(value) || Number(value)<1 || Number(value)>100) throw new BadRequestException('limit 必须为 1~100');
  return Number(value);
}
function cursor(value = '0'): string {
  if (!/^\d{1,19}$/.test(value) || BigInt(value)>9223372036854775807n) throw new BadRequestException('无效增量游标');
  return value;
}
@Controller('api/facts')
@NeedLogin()
export class FactsController {
  constructor(private readonly facts: FactsService) {}
  @Get('status') status() { return this.facts.status(); }
  @Post('refresh') async refresh() { await this.facts.refresh(); return this.facts.status(); }
  @Get('current') async list(@Query('after') after = '', @Query('limit') count?: string, @Query('kind') kind?: string) {
    if (after) uuid(after);
    if (kind && !(FACT_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('无效事实类别');
    const size = limit(count);
    await this.facts.refresh(); // 用户与事实中心交互时及时读取本地源，不等待定时任务。
    return this.facts.list(after,size,kind);
  }
  @Get('changes') changes(@Query('after') after?: string, @Query('limit') count?: string) {
    return this.facts.changes(cursor(after),limit(count));
  }
  @Get(':id/history') async history(@Param('id') id: string, @Query('after') after?: string, @Query('limit') count?: string) {
    uuid(id);
    const at = cursor(after), size = limit(count);
    await this.facts.detail(id);
    return this.facts.changes(at,size,id);
  }
  @Get(':id') async detail(@Param('id') id: string) {
    uuid(id);
    await this.facts.refresh();
    return this.facts.detail(id);
  }
}
