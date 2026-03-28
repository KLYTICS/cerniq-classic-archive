import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QualificationDto {
  @ApiProperty({ description: 'Primary pain point' })
  @IsString()
  painPoint!: string; // 'regulatory_compliance' | 'risk_management' | 'reporting_efficiency' | 'cost_reduction'

  @ApiPropertyOptional({ description: 'Estimated annual budget for ALM tools' })
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional({ description: 'Timeline for implementation' })
  @IsOptional()
  @IsIn(['immediate', '1_3_months', '3_6_months', '6_12_months', 'exploring'])
  timeline?: string;

  @ApiPropertyOptional({ description: 'Decision maker or evaluator' })
  @IsOptional()
  @IsIn(['decision_maker', 'influencer', 'evaluator', 'researcher'])
  authority?: string;

  @ApiPropertyOptional({ description: 'Current ALM solution in use' })
  @IsOptional()
  @IsString()
  currentSolution?: string;

  @ApiPropertyOptional({ description: 'Next regulatory exam date' })
  @IsOptional()
  @IsString()
  nextExamDate?: string;
}
