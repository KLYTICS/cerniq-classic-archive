import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma.service';

describe('OrganizationsService', () => {
    let service: OrganizationsService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            organization: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
            },
            organizationMember: {
                findUnique: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<OrganizationsService>(OrganizationsService);
    });

    describe('create', () => {
        it('should create an organization and add creator as admin', async () => {
            prisma.organization.create.mockResolvedValue({
                id: 'org-1',
                name: 'Test Org',
                slug: 'test-org',
                members: [{ role: 'ADMIN', userId: 'user-1' }],
            });

            const result = await service.create({
                name: 'Test Org',
                slug: 'test-org',
            }, 'user-1');

            expect(result.name).toBe('Test Org');
            expect(prisma.organization.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: 'Test Org',
                        slug: 'test-org',
                    }),
                }),
            );
        });
    });

    describe('findAllForUser', () => {
        it('should return organizations for a user', async () => {
            prisma.organization.findMany.mockResolvedValue([
                { id: 'org-1', name: 'Org 1' },
                { id: 'org-2', name: 'Org 2' },
            ]);

            const result = await service.findAllForUser('user-1');

            expect(result).toHaveLength(2);
        });
    });

    describe('addMember', () => {
        it('should add a member to organization', async () => {
            prisma.organizationMember.findUnique
                .mockResolvedValueOnce({ id: '1', role: 'ADMIN' })  // requester is admin
                .mockResolvedValueOnce(null);  // target not yet member
            prisma.organizationMember.create.mockResolvedValue({
                id: 'mem-1',
                role: 'MEMBER',
                userId: 'new-user',
            });

            const result = await service.addMember('org-1', 'new-user', 'MEMBER', 'admin-user');

            expect(result.role).toBe('MEMBER');
        });

        it('should reject if requester is not admin', async () => {
            prisma.organizationMember.findUnique.mockResolvedValue({
                id: '1',
                role: 'MEMBER',
            });

            await expect(
                service.addMember('org-1', 'new-user', 'MEMBER', 'member-user'),
            ).rejects.toThrow();
        });
    });

    describe('removeMember', () => {
        it('should not allow removing the last admin', async () => {
            prisma.organizationMember.findUnique
                .mockResolvedValueOnce({ id: '1', role: 'ADMIN' })  // requester
                .mockResolvedValueOnce({ id: '2', role: 'ADMIN' }); // target
            prisma.organizationMember.count.mockResolvedValue(1); // only 1 admin

            await expect(
                service.removeMember('org-1', 'admin-user', 'admin-user'),
            ).rejects.toThrow();
        });
    });
});
