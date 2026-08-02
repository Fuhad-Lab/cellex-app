import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { DatabaseService } from '../common/database.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, DatabaseService],
})
export class UploadsModule {}
