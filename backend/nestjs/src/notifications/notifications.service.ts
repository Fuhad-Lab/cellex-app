import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string) {
    return this.db.select('buyers_notifications',
      'id,type,title,message,data,read,created_at',
      { user_id: userId }, { order: 'created_at', limit: 50 });
  }

  async markRead(userId: string, notificationId: string) {
    await this.db.update('buyers_notifications', { read: true },
      { id: notificationId, user_id: userId });
  }
}
