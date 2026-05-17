import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminKeyGuard } from '../auth/admin-key.guard';
import { ControlTowerService } from './control-tower.service';
import {
  type ControlTowerSummary,
  type OperatorActionRequest,
  type OperatorActionResult,
} from './control-tower.types';

class ControlTowerActionDto implements OperatorActionRequest {
  @IsIn([
    'refresh_intelligence',
    'open_portal_cycle',
    'sweep_demo_seats',
    'run_pipeline',
    'retry_pipeline_job',
    'refresh_session_snapshot',
  ])
  action:
    | 'refresh_intelligence'
    | 'open_portal_cycle'
    | 'sweep_demo_seats'
    | 'run_pipeline'
    | 'retry_pipeline_job'
    | 'refresh_session_snapshot';

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  jobId?: string;
}

@Controller('admin/api/control-tower')
@UseGuards(AdminKeyGuard)
export class ControlTowerController {
  constructor(private readonly controlTower: ControlTowerService) {}

  @Get('summary')
  async getSummary(): Promise<ControlTowerSummary> {
    return this.controlTower.getSummary();
  }

  @Post('actions')
  async runAction(
    @Body() body: ControlTowerActionDto,
  ): Promise<OperatorActionResult> {
    return this.controlTower.runAction(
      body.action,
      body as unknown as Record<string, unknown>,
    );
  }
}
