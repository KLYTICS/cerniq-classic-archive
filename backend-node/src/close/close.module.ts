import { Module } from '@nestjs/common';
import { CloseController } from './close.controller';
import { CloseService } from './close.service';
import { TieOutService } from './tie-out.service';
import { FluxNarratorService } from './flux-narrator.service';
import { BinderService } from './binder.service';
import { ActivityService } from './activity.service';
import { GlDataSourceService } from './gl-data-source.service';
import { GlUploadService } from './gl-upload.service';

/**
 * Close Cockpit module — month-end financial close workflow.
 *
 * Self-contained: depends only on PrismaModule (global) and AuthGuard (from
 * AuthModule, also global via AppModule wiring). No tangling with the
 * Expenses or ALM modules — those can later subscribe to events emitted by
 * this module if we want to auto-link findings into reconciliations.
 */
@Module({
  controllers: [CloseController],
  providers: [
    CloseService,
    TieOutService,
    FluxNarratorService,
    BinderService,
    ActivityService,
    GlDataSourceService,
    GlUploadService,
  ],
  exports: [
    CloseService,
    TieOutService,
    FluxNarratorService,
    BinderService,
    ActivityService,
    GlDataSourceService,
    GlUploadService,
  ],
})
export class CloseModule {}
