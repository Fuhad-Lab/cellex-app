import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '../common/database.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, DatabaseService],
})
export class NotificationsModule {}
