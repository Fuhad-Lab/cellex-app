import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Module({
  providers: [DatabaseService],
})
export class AuditModule {}
