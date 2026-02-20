import { IsString, IsNumber, IsOptional, IsDateString, IsIn, Min } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['bank', 'credit_union', 'family_office'])
  type: string;

  @IsNumber()
  @Min(0)
  totalAssets: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  reportingDate: string;

  @IsString()
  workspaceId: string;
}
