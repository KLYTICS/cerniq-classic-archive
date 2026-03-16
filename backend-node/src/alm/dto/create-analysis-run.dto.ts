import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StressTestingParamsDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  paths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  horizon?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  volatility?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  meanReversion?: number;
}

export class CreateAnalysisRunDto {
  @IsString()
  institutionId: string;

  @IsOptional()
  @IsString()
  @IsIn(['full_analysis'])
  analysisType?: 'full_analysis';

  @IsOptional()
  @IsString()
  triggeredBy?: string;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  @IsString()
  scenarioSet?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  rateShocks?: number[];

  @IsOptional()
  @IsObject()
  assumptions?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => StressTestingParamsDto)
  stressTesting?: StressTestingParamsDto;
}
