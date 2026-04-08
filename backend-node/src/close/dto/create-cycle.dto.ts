import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCycleDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsOptional()
  @IsString()
  targetCloseAt?: string; // ISO date — controller resolves
}
