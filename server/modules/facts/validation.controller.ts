import { Controller, Get, Param, Post } from '@nestjs/common';
import { CandidateDiscoveryService } from './candidate-discovery.service';

@Controller('api/validation')
export class ValidationController {
  constructor(private readonly discovery:CandidateDiscoveryService) {}
  @Get('workspace') workspace() { return this.discovery.workspace(); }
  @Post('scan') scan() { return this.discovery.scan(); }
  @Post('notices/:id/read') read(@Param('id') id:string) { return this.discovery.markRead(id); }
}
