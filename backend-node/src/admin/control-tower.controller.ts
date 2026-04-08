import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  ControlTowerService,
  type OperatorActionResult,
} from './control-tower.service';

class ControlTowerActionDto {
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
@UseGuards(AdminGuard)
export class ControlTowerController {
  constructor(private readonly controlTower: ControlTowerService) {}

  @Get('summary')
  async getSummary() {
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
