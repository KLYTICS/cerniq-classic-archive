import {
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReconciliationType } from '@prisma/client';

export class TieOutLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  /** 'gl' or 'ext' — which side of the rec the line came from */
  @IsString()
  side!: 'gl' | 'ext';
}

export class RunTieOutDto {
  @IsString()
  account!: string;

  @IsEnum(ReconciliationType)
  reconType!: ReconciliationType;

  @IsNumber()
  glBalance!: number;

  @IsNumber()
  externalBalance!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TieOutLineDto)
  lines!: TieOutLineDto[];
}
