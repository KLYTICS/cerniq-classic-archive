import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AlmService } from './alm.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { AlmController } from './alm.controller';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AlmController],
  providers: [AlmService, AlmEnterpriseService, AuthGuard, PrismaService],
  exports: [AlmService, AlmEnterpriseService],
})
export class AlmModule {}
