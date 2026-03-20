import { Controller, Get, Param, Query, Sse, UseGuards, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AlmAdvisorV2Service } from './alm-advisor-v2.service';
import { AuthGuard } from '../auth/auth.guard';
import { createSSEStream } from '../common/streaming/sse.util';

@Controller('api/alm')
export class AlmAdvisorV2Controller {
  private readonly logger = new Logger(AlmAdvisorV2Controller.name);

  constructor(private readonly advisorV2: AlmAdvisorV2Service) {}

  @Sse(':institutionId/advisor/stream')
  @UseGuards(AuthGuard)
  streamAdvisor(
    @Param('institutionId') institutionId: string,
    @Query('lang') lang = 'en',
  ): Observable<MessageEvent> {
    this.logger.log(`Streaming advisor narrative for ${institutionId} (lang=${lang})`);
    return createSSEStream(this.advisorV2.streamNarrative(institutionId, lang));
  }

  @Get(':institutionId/advisor/health-score')
  @UseGuards(AuthGuard)
  async getHealthScore(@Param('institutionId') institutionId: string) {
    return this.advisorV2.computeHealthScore(institutionId);
  }

  @Get(':institutionId/advisor/narrative')
  @UseGuards(AuthGuard)
  async getStaticNarrative(
    @Param('institutionId') institutionId: string,
    @Query('lang') lang = 'en',
  ) {
    return this.advisorV2.getStaticNarrative(institutionId, lang);
  }
}
