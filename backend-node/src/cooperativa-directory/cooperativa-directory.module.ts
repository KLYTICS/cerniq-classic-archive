import { Module } from '@nestjs/common';
import { CooperativaDirectoryController } from './cooperativa-directory.controller';
import { CooperativaDirectoryService } from './cooperativa-directory.service';

@Module({
  controllers: [CooperativaDirectoryController],
  providers: [CooperativaDirectoryService],
  exports: [CooperativaDirectoryService],
})
export class CooperativaDirectoryModule {}
