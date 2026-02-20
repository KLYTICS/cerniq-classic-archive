import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';

describe('AuthService', () => {
    let service: AuthService;
    let prisma: {
        user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
        refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    };
    let jwtService: { sign: jest.Mock; verify: jest.Mock };

    beforeEach(async () => {
        prisma = {
            user: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            refreshToken: {
                create: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
        };

        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: prisma },
                { provide: JwtService, useValue: jwtService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    describe('register', () => {
        it('should create a new user and return tokens', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({
                id: 'test-id',
                email: 'test@example.com',
                name: 'Test User',
            });
            prisma.refreshToken.create.mockResolvedValue({});

            const result = await service.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            });

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user.email).toBe('test@example.com');
            expect(prisma.user.create).toHaveBeenCalled();
        });

        it('should throw ConflictException if email exists', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'existing-id',
                email: 'test@example.com',
            });

            await expect(
                service.register({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            ).rejects.toThrow('Email already registered');
        });
    });

    describe('login', () => {
        it('should throw UnauthorizedException for invalid user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.login({
                    email: 'nonexistent@example.com',
                    password: 'password123',
                }),
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw UnauthorizedException when no password hash', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-id',
                email: 'test@example.com',
                passwordHash: null,
            });

            await expect(
                service.login({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            ).rejects.toThrow('Invalid credentials');
        });
    });

    describe('logout', () => {
        it('should revoke refresh token', async () => {
            prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

            await service.logout('some-refresh-token');
            expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
        });

        it('should handle empty token gracefully', async () => {
            await service.logout('');
            // Should not throw
        });
    });
});
