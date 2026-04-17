import { Module } from '@nestjs/common';
import { AgentTrustModule } from '../agent-trust/agent-trust.module';
import { AgentEvalController } from './agent-eval.controller';
import { GoldenRunnerService } from './golden-runner.service';
import { RegressionScorerService } from './regression-scorer.service';
import { ReplayRunnerService } from './replay.runner';

@Module({
  imports: [AgentTrustModule],
  controllers: [AgentEvalController],
  providers: [
    RegressionScorerService,
    GoldenRunnerService,
    ReplayRunnerService,
  ],
  exports: [RegressionScorerService, GoldenRunnerService, ReplayRunnerService],
})
export class AgentEvalModule {}
