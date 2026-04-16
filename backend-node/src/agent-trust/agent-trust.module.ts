import { Module } from '@nestjs/common';
import { AgentTrustController } from './agent-trust.controller';
import { AgentTrustService } from './agent-trust.service';
import { HedgeLanguageDetector } from './hedge-language.detector';
import { NumberCitationValidator } from './number-citation.validator';
import { OutputSchemaValidator } from './output-schema.validator';
import { PiiRedactorService } from './pii-redactor.service';
import { PromptInjectionShield } from './prompt-injection.shield';

@Module({
  controllers: [AgentTrustController],
  providers: [
    NumberCitationValidator,
    PiiRedactorService,
    PromptInjectionShield,
    HedgeLanguageDetector,
    OutputSchemaValidator,
    AgentTrustService,
  ],
  exports: [
    AgentTrustService,
    NumberCitationValidator,
    PiiRedactorService,
    PromptInjectionShield,
    HedgeLanguageDetector,
    OutputSchemaValidator,
  ],
})
export class AgentTrustModule {}
