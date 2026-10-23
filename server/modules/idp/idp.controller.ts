import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IdpService } from './idp.service';
import type { IdpActionUpdate, IdpAlignmentRequest, IdpGenerateRequest, IdpSaveRequest } from '@shared/api.interface';

@Controller('api/idp')
export class IdpController {
  constructor(private readonly idpService: IdpService) {}
  @Get() getIdp() { return this.idpService.getIdp(); }
  @Get('options') options() { return this.idpService.getOptions(); }
  @Get('review') review() { return this.idpService.review(); }
  @Get('history') history() { return this.idpService.history(); }
  @Get('history/:revision') version(@Param('revision') value: string) { return this.idpService.version(value); }
  @Post('draft') generate(@Body() body: IdpGenerateRequest) { return this.idpService.generate(body); }
  @Post('confirm') confirm(@Body() body: IdpSaveRequest) { return this.idpService.saveDraft(body); }
  @Patch('actions/:id') updateAction(@Param('id') id: string,@Body() body: IdpActionUpdate) { return this.idpService.updateAction(id,body); }
  @Post('alignments') align(@Body() body: IdpAlignmentRequest) { return this.idpService.align(body); }
}
