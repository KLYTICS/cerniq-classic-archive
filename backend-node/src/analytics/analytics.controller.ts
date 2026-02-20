import { Controller, Get, Query, Request, Res } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('summary')
    getSummary(@Request() req: any) {
        const orgId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'demo-user';
        return this.analyticsService.getSummary(orgId, userId);
    }

    @Get('trends')
    getSpendingTrends(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Request() req: any,
    ) {
        const orgId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'demo-user';

        const range = {
            startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: endDate || new Date().toISOString(),
        };

        return this.analyticsService.getSpendingTrends(orgId, userId, range);
    }

    @Get('categories')
    getCategoryBreakdown(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Request() req: any,
    ) {
        const orgId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'demo-user';

        const range = startDate && endDate ? { startDate, endDate } : undefined;
        return this.analyticsService.getCategoryBreakdown(orgId, userId, range);
    }

    @Get('team')
    getTeamComparison(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Request() req: any,
    ) {
        const orgId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'demo-user';

        const range = startDate && endDate ? { startDate, endDate } : undefined;
        return this.analyticsService.getTeamComparison(orgId, userId, range);
    }

    @Get('export')
    async exportExpenses(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('format') format: string,
        @Request() req: any,
        @Res() res: any,
    ) {
        const orgId = req.headers['x-organization-id'] || 'default-org';
        const userId = req.headers['x-user-id'] || 'demo-user';

        const range = startDate && endDate ? { startDate, endDate } : undefined;
        const data = await this.analyticsService.exportExpenses(orgId, userId, range);

        if (format === 'csv' && res) {
            const headers = Object.keys(data[0] || {});
            const csv = [
                headers.join(','),
                ...data.map((row: any) => headers.map(h => `"${row[h]}"`).join(',')),
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
            return res.send(csv);
        }

        return res.json(data);
    }
}
