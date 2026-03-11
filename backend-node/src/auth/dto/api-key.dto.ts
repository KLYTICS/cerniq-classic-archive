import { IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;
}
