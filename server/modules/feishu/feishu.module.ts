import { Controller, Get, Module, Post } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/platform/local-platform';
import { currentEmployee } from '../auth/employee-context';
import { FeishuService } from './feishu.service';

@Controller('api/integrations/feishu')
class FeishuController {
  constructor(private readonly feishu: FeishuService) {}
  @Get() status() { return this.feishu.status(currentEmployee()); }
  @Post('test') sendTest() { return this.feishu.sendTest(currentEmployee()); }
}

@Module({ controllers: [FeishuController], providers: [FeishuService] })
export class FeishuModule {}
