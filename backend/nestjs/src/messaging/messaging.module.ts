import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { DatabaseService } from '../common/database.service';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, DatabaseService],
})
export class MessagingModule {}
