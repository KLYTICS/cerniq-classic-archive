import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// ── Query DTOs ──────────────────────────────────────────────────────

export class TimelineQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  months?: number = 12;
}

export class ChurnQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class StaleDealQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  days?: number = 14;
}

export class DemoConversionQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  days?: number = 30;
}

// ── Response DTOs ───────────────────────────────────────────────────

export class MrrSnapshotDto {
  /** Monthly Recurring Revenue as string-encoded Decimal */
  mrr!: string;
  /** Annual Recurring Revenue (MRR x 12) as string-encoded Decimal */
  arr!: string;
  /** Count of active recurring subscriptions */
  activeSubscriptionCount!: number;
  /** ISO timestamp of when this snapshot was calculated */
  calculatedAt!: string;
}

export class ChurnMetricsDto {
  /** Count of subscriptions cancelled in the period */
  cancelledCount!: number;
  /** Count of subscriptions past_due in the period */
  pastDueCount!: number;
  /** Total subscriptions at start of period */
  totalAtStart!: number;
  /** Churn rate as a percentage string (e.g. "5.26") */
  churnRate!: string;
  from!: string;
  to!: string;
}

export class TimelinePointDto {
  /** Month label (YYYY-MM) */
  month!: string;
  /** MRR for the month as string-encoded Decimal */
  mrr!: string;
  /** Count of active subscriptions in the month */
  activeCount!: number;
}

export class CohortRetentionDto {
  /** Signup month (YYYY-MM) */
  cohort!: string;
  /** Total users who signed up in this cohort */
  total!: number;
  /** Users still active */
  retained!: number;
  /** Retention rate as percentage string */
  retentionRate!: string;
}

export class PipelineStageDto {
  status!: string;
  count!: number;
  /** Total revenue amount as string-encoded Decimal */
  totalValue!: string;
}

export class PipelineSnapshotDto {
  stages!: PipelineStageDto[];
  totalLeads!: number;
  totalPipelineValue!: string;
}

export class FunnelStageDto {
  from!: string;
  to!: string;
  fromCount!: number;
  toCount!: number;
  /** Conversion rate as percentage string */
  conversionRate!: string;
}

export class ConversionFunnelDto {
  stages!: FunnelStageDto[];
}

export class StaleDealDto {
  id!: string;
  name!: string;
  email!: string;
  institutionName!: string;
  @IsString()
  status!: string;
  /** Days since last activity */
  daysSinceActivity!: number;
  updatedAt!: string;
}

export class DemoConversionDto {
  /** Demos scheduled in the period */
  demosScheduled!: number;
  /** Demos completed */
  demosCompleted!: number;
  /** Leads that converted to CLOSED_WON from demo */
  conversions!: number;
  /** Conversion rate as percentage string */
  conversionRate!: string;
}
