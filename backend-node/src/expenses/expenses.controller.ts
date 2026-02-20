import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Request,
    Query,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('api/expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Post('process-receipt')
    processReceipt(@Body() dto: any, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.processReceipt(organizationId, userId, dto);
    }

    @Post()
    create(@Body() createDto: { merchantName: string; amount: number; transactionDate: string; category?: string; description?: string; receiptUrl?: string }, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.create(organizationId, userId, createDto);
    }

    @Get()
    findAll(@Query('status') status: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.findAll(organizationId, userId, status as any);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.findOne(id, organizationId, userId);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateDto: any,
        @Request() req: any,
    ) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.update(id, organizationId, userId, updateDto);
    }

    @Post(':id/submit')
    submit(@Param('id') id: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.submit(id, organizationId, userId);
    }

    @Post(':id/approve')
    approve(@Param('id') id: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.approve(id, organizationId, userId);
    }

    @Post(':id/reject')
    reject(@Param('id') id: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.reject(id, organizationId, userId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        const organizationId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.expensesService.remove(id, organizationId, userId);
    }
}
