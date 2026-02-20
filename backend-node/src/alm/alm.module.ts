import { Module } from '@nestjs/common';
import { AlmService } from './alm.service';
import { AlmController } from './alm.controller';

@Module({
    controllers: [AlmController],
    providers: [AlmService],
    exports: [AlmService],
})
export class AlmModule {}
