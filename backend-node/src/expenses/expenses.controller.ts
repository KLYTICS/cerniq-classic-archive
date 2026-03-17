import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Req,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
    constructor(
        private readonly expensesService: ExpensesService,
        private readonly anomalyDetectionService: AnomalyDetectionService,
    ) { }

    @Post(':orgId/analyze')
    analyzeOrganization(@Param('orgId') orgId: string) {
        return this.anomalyDetectionService.analyzeOrganization(orgId);
    }

    @Post('process-receipt')
    processReceipt(@Body() dto: any, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.processReceipt(organizationId, req.user.userId, dto);
    }

    @Post()
    create(@Body() createDto: { merchantName: string; amount: number; transactionDate: string; category?: string; description?: string; receiptUrl?: string }, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.create(organizationId, req.user.userId, createDto);
    }

    @Get()
    findAll(@Query('status') status: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.findAll(organizationId, req.user.userId, status as any);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.findOne(id, organizationId, req.user.userId);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateDto: any,
        @Req() req: any,
    ) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.update(id, organizationId, req.user.userId, updateDto);
    }

    @Post(':id/submit')
    submit(@Param('id') id: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.submit(id, organizationId, req.user.userId);
    }

    @Post(':id/approve')
    approve(@Param('id') id: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.approve(id, organizationId, req.user.userId);
    }

    @Post(':id/reject')
    reject(@Param('id') id: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.reject(id, organizationId, req.user.userId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        return this.expensesService.remove(id, organizationId, req.user.userId);
    }
}
