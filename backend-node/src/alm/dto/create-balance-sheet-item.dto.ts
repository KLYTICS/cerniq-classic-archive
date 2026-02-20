import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BalanceSheetItemDto {
  @IsString()
  @IsIn(['asset', 'liability'])
  category: string;

  @IsString()
  subcategory: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  balance: number;

  @IsNumber()
  rate: number;

  @IsNumber()
  @Min(0)
  duration: number;

  @IsOptional()
  @IsDateString()
  repriceDate?: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @IsString()
  @IsIn(['fixed', 'variable', 'hybrid'])
  rateType: string;
}

export class BulkBalanceSheetImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceSheetItemDto)
  items: BalanceSheetItemDto[];
}
