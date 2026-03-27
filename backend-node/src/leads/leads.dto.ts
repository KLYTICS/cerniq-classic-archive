import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class SubmitLeadDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  institutionName: string;

  @IsIn([
    'cooperativa',
    'credit_union',
    'community_bank',
    'cpa_consultant',
    'other',
  ])
  institutionType: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  referredBy?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsIn([
    'NEW',
    'CONTACTED',
    'DEMO_SCHEDULED',
    'DEMO_COMPLETED',
    'PROPOSAL_SENT',
    'NEGOTIATING',
    'CLOSED_WON',
    'CLOSED_LOST',
    'UNQUALIFIED',
  ])
  status?: string;

  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUp?: string;

  @IsOptional()
  @IsNumber()
  revenueAmount?: number;

  @IsOptional()
  @IsIn(['one_time', 'monthly', 'partner', 'enterprise'])
  dealType?: string;
}
