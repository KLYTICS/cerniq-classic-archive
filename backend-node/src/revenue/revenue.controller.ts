import {
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RevenueService } from './revenue.service';
import { PipelineHealthService } from './pipeline-health.service';
import {
  ChurnQueryDto,
  StaleDealQueryDto,
  TimelineQueryDto,
  DemoConversionQueryDto,
} from './revenue.dto';

@ApiTags('Revenue Intelligence')
@ApiBearerAuth('BearerAuth')
@Controller('api/revenue')
@UseGuards(AuthGuard)
export class RevenueController {
  private readonly logger = new Logger(RevenueController.name);

  constructor(
    private readonly revenue: RevenueService,
    private readonly pipeline: PipelineHealthService,
  ) {}

  // ── MRR + ARR ─────────────────────────────────────────────────────

  @Get('mrr')
  @ApiOperation({ summary: 'Current MRR and ARR snapshot' })
  @ApiResponse({ status: 200, description: 'MRR/ARR with active subscription count' })
  async getMrr() {
    const { mrr, arr, activeSubscriptionCount } = await this.revenue.getArrSnapshot();
    return {
      mrr: mrr.toString(),
      arr: arr.toString(),
      activeSubscriptionCount,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Timeline ──────────────────────────────────────────────────────

  @Get('timeline')
  @ApiOperation({ summary: 'Monthly MRR history' })
  @ApiResponse({ status: 200, description: 'Array of monthly MRR data points' })
  async getTimeline(@Query() query: TimelineQueryDto) {
    const months = query.months ?? 12;
    const timeline = await this.revenue.getRevenueTimeline(months);
    return timeline.map((point) => ({
      month: point.month,
      mrr: point.mrr.toString(),
      activeCount: point.activeCount,
    }));
  }

  // ── Churn ─────────────────────────────────────────────────────────

  @Get('churn')
  @ApiOperation({ summary: 'Churn metrics for a date range' })
  @ApiResponse({ status: 200, description: 'Cancelled/past_due counts and churn rate' })
  async getChurn(@Query() query: ChurnQueryDto) {
    const metrics = await this.revenue.getChurnMetrics({
      from: new Date(query.from),
      to: new Date(query.to),
    });
    return {
      cancelledCount: metrics.cancelledCount,
      pastDueCount: metrics.pastDueCount,
      totalAtStart: metrics.totalAtStart,
      churnRate: metrics.churnRate.toString(),
      from: query.from,
      to: query.to,
    };
  }

  // ── Cohort Retention ──────────────────────────────────────────────

  @Get('cohorts')
  @ApiOperation({ summary: 'Cohort retention by signup month' })
  @ApiResponse({ status: 200, description: 'Retention rates per signup cohort' })
  async getCohorts() {
    const cohorts = await this.revenue.getCohortRetention();
    return cohorts.map((c) => ({
      cohort: c.cohort,
      total: c.total,
      retained: c.retained,
      retentionRate: c.retentionRate.toString(),
    }));
  }

  // ── Pipeline ──────────────────────────────────────────────────────

  @Get('pipeline')
  @ApiOperation({ summary: 'Pipeline health snapshot — leads by stage' })
  @ApiResponse({ status: 200, description: 'Leads grouped by status with value totals' })
  async getPipeline() {
    const snapshot = await this.pipeline.getPipelineSnapshot();
    return {
      stages: snapshot.stages.map((s) => ({
        status: s.status,
        count: s.count,
        totalValue: s.totalValue.toString(),
      })),
      totalLeads: snapshot.totalLeads,
      totalPipelineValue: snapshot.totalPipelineValue.toString(),
    };
  }

  // ── Funnel ────────────────────────────────────────────────────────

  @Get('funnel')
  @ApiOperation({ summary: 'Stage-to-stage conversion funnel' })
  @ApiResponse({ status: 200, description: 'Conversion rates between pipeline stages' })
  async getFunnel() {
    const funnel = await this.pipeline.getConversionFunnel();
    return {
      stages: funnel.map((f) => ({
        from: f.from,
        to: f.to,
        fromCount: f.fromCount,
        toCount: f.toCount,
        conversionRate: f.conversionRate.toString(),
      })),
    };
  }

  // ── Stale Deals ───────────────────────────────────────────────────

  @Get('stale-deals')
  @ApiOperation({ summary: 'Leads with no activity past threshold' })
  @ApiResponse({ status: 200, description: 'Stale deals with days-since-activity' })
  async getStaleDeals(@Query() query: StaleDealQueryDto) {
    const days = query.days ?? 14;
    const deals = await this.pipeline.getStaleDealFlags(days);
    return deals.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      institutionName: d.institutionName,
      status: d.status,
      daysSinceActivity: d.daysSinceActivity,
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  // ── Demo Conversion ───────────────────────────────────────────────

  @Get('demo-conversion')
  @ApiOperation({ summary: 'Demo-to-close conversion rate' })
  @ApiResponse({ status: 200, description: 'Demo conversion metrics' })
  async getDemoConversion(@Query() query: DemoConversionQueryDto) {
    const days = query.days ?? 30;
    const result = await this.pipeline.getDemoConversionRate(days);
    return {
      demosScheduled: result.demosScheduled,
      demosCompleted: result.demosCompleted,
      conversions: result.conversions,
      conversionRate: result.conversionRate.toString(),
    };
  }
}
