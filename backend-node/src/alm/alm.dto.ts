import {
    IsString,
    IsNumber,
    IsBoolean,
    IsOptional,
    IsArray,
    ValidateNested,
    ArrayMinSize,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Instrument ────────────────────────────────────────────────

export class InstrumentDto {
    @IsString()
    name: string;

    /** Notional / principal amount in dollars */
    @IsNumber()
    @Min(0)
    amount: number;

    /** Annual coupon / interest rate as a decimal (e.g. 0.055 = 5.5%) */
    @IsNumber()
    rate: number;

    /** Years to maturity. 0 = overnight / demand */
    @IsNumber()
    @Min(0)
    maturityYears: number;

    /** True if the rate floats (reprices periodically) */
    @IsBoolean()
    isFloating: boolean;

    /** Months between repricings. 0 = overnight. Only relevant when isFloating = true */
    @IsOptional()
    @IsNumber()
    @Min(0)
    repricingFrequencyMonths?: number;
}

// ─── Balance Sheet ─────────────────────────────────────────────

export class BalanceSheetDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => InstrumentDto)
    assets: InstrumentDto[];

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => InstrumentDto)
    liabilities: InstrumentDto[];

    /** Total equity (assets − liabilities) */
    @IsNumber()
    equity: number;
}

// ─── Scenario Request ──────────────────────────────────────────

export class ScenarioRequestDto {
    @ValidateNested()
    @Type(() => BalanceSheetDto)
    balanceSheet: BalanceSheetDto;

    /** Parallel rate shocks in basis points (default: −300 to +300) */
    @IsOptional()
    @IsArray()
    rateShocks?: number[];
}

// ─── HQLA ─────────────────────────────────────────────────────

export class HQLADto {
    /** Level 1 assets: cash, central bank reserves, sovereign debt (0% haircut) */
    @IsNumber()
    @Min(0)
    level1: number;

    /** Level 2A assets: agency MBS, covered bonds (15% haircut) */
    @IsNumber()
    @Min(0)
    level2a: number;

    /** Level 2B assets: corporate bonds, equities (25% haircut, 40% cap on Level 2 total) */
    @IsNumber()
    @Min(0)
    level2b: number;
}

// ─── LCR Request ───────────────────────────────────────────────

export class LCRRequestDto {
    @ValidateNested()
    @Type(() => HQLADto)
    hqla: HQLADto;

    /** Total net cash outflows over 30 calendar days */
    @IsNumber()
    @Min(0)
    totalNetOutflows: number;
}

// ─── Full Analysis Request ─────────────────────────────────────

export class FullAnalysisRequestDto {
    @ValidateNested()
    @Type(() => BalanceSheetDto)
    balanceSheet: BalanceSheetDto;

    @IsOptional()
    @IsArray()
    rateShocks?: number[];

    /** Optional LCR data; if omitted, LCR is derived from balance sheet */
    @IsOptional()
    @ValidateNested()
    @Type(() => LCRRequestDto)
    lcr?: LCRRequestDto;
}

// ─── Result Types (not validated – outbound only) ──────────────

export interface InstrumentDetail {
    name: string;
    amount: number;
    rate: number;
    maturityYears: number;
    isFloating: boolean;
    macaulayDuration: number;
    modifiedDuration: number;
    bpv: number;
}

export interface DurationGapResult {
    assetDuration: number;
    liabilityDuration: number;
    durationGap: number;
    leverageAdjustedGap: number;
    totalAssets: number;
    totalLiabilities: number;
    interpretation: string;
    assetDetails: InstrumentDetail[];
    liabilityDetails: InstrumentDetail[];
}

export interface NIIScenario {
    shockBps: number;
    nii: number;
    change: number;
    changePct: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface NIIResult {
    baseNII: number;
    assetIncome: number;
    liabilityCost: number;
    scenarios: NIIScenario[];
}

export interface EVEScenario {
    shockBps: number;
    eve: number;
    change: number;
    changePct: number;
}

export interface EVEResult {
    baseEVE: number;
    scenarios: EVEScenario[];
}

export interface LCRResult {
    lcr: number;
    hqlaTotal: number;
    hqlaBreakdown: {
        level1: number;
        level2a: number;
        level2aAdjusted: number;
        level2b: number;
        level2bAdjusted: number;
        level2Cap: number;
        level2Applied: number;
    };
    totalNetOutflows: number;
    threshold: number;
    status: 'compliant' | 'warning' | 'breach';
}

export interface BPVInstrument {
    name: string;
    amount: number;
    bpv: number;
    modifiedDuration: number;
}

export interface BPVResult {
    totalAssetBPV: number;
    totalLiabilityBPV: number;
    netBPV: number;
    assetBPVs: BPVInstrument[];
    liabilityBPVs: BPVInstrument[];
    interpretation: string;
}

export interface FullAnalysisResult {
    summary: {
        totalAssets: number;
        totalLiabilities: number;
        equity: number;
        timestamp: string;
    };
    durationGap: DurationGapResult;
    niiSimulation: NIIResult;
    eve: EVEResult;
    bpv: BPVResult;
    lcr: LCRResult | null;
}
