import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    Patch,
    Request,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

@Controller('api/organizations')
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Post()
    create(@Body() createDto: { name: string; slug: string; description?: string }, @Request() req: any) {
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.create(createDto, userId);
    }

    @Get()
    findAll(@Request() req: any) {
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.findAll(userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req: any) {
        const userId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.findOne(id, userId);
    }

    @Post(':id/members')
    addMember(
        @Param('id') id: string,
        @Body() addMemberDto: { userId: string; role: string },
        @Request() req: any,
    ) {
        const requesterId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.addMember(id, addMemberDto as any, requesterId);
    }

    @Delete(':id/members/:userId')
    removeMember(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Request() req: any,
    ) {
        const requesterId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.removeMember(id, userId, requesterId);
    }

    @Patch(':id/members/:userId/role')
    updateMemberRole(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Body() body: { role: string },
        @Request() req: any,
    ) {
        const requesterId = req.headers['x-user-id'] || 'user-id-placeholder';
        return this.organizationsService.updateMemberRole(
            id,
            userId,
            body.role as any,
            requesterId,
        );
    }
}
