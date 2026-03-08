import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { PrismaService } from '../prisma.service';
import { AlmModule } from '../alm/alm.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    AlmModule,
    EmailModule,
  ],
  controllers: [PortalController],
  providers: [PrismaService],
})
export class PortalModule {}
