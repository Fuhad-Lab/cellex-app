import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get()
  async list(@Req() req: any) {
    const notifications = await this.notifService.list(req.userId);
    return { success: true, notifications };
  }

  @Post('read')
  async markRead(@Req() req: any, @Body() body: any) {
    await this.notifService.markRead(req.userId, body.notificationId);
    return { success: true };
  }
}
