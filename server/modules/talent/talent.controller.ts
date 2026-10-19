import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { NeedLogin } from '@server/platform/local-platform';
import { TalentService } from './talent.service';
import type {
  ShortlistResponse,
  TalentCandidatesResponse,
} from '@shared/api.interface';

@Controller('api/talent')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get('candidates')
  async getCandidates(): Promise<TalentCandidatesResponse> {
    return this.talentService.getCandidates();
  }

  @Get('shortlist')
  async getShortlist(): Promise<ShortlistResponse> {
    return this.talentService.getShortlist();
  }

  @NeedLogin()
  @Post('shortlist/:candidateSlug')
  async addToShortlist(
    @Param('candidateSlug') candidateSlug: string,
  ): Promise<ShortlistResponse> {
    return this.talentService.addToShortlist(candidateSlug);
  }

  @NeedLogin()
  @Delete('shortlist')
  async clearShortlist(): Promise<ShortlistResponse> {
    return this.talentService.clearShortlist();
  }

  @NeedLogin()
  @Delete('shortlist/:candidateSlug')
  async removeFromShortlist(
    @Param('candidateSlug') candidateSlug: string,
  ): Promise<ShortlistResponse> {
    return this.talentService.removeFromShortlist(candidateSlug);
  }
}
