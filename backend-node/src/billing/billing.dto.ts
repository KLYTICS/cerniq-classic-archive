import { IsString, IsOptional, IsIn, IsEmail } from 'class-validator';

export class CheckoutRequestDto {
  @IsIn(['one_time', 'monthly', 'annual', 'partner'])
  tier: 'one_time' | 'monthly' | 'annual' | 'partner';

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  institutionName?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsString()
  successUrl: string;

  @IsString()
  cancelUrl: string;
}
