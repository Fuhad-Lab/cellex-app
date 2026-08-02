import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly msgService: MessagingService) {}

  @Get('conversations')
  async listConversations(@Req() req: any) {
    const conversations = await this.msgService.listConversations(req.userId);
    return { success: true, conversations };
  }

  @Get('messages')
  async getMessages(@Req() req: any, @Query('conversationId') convId: string) {
    const messages = await this.msgService.getMessages(convId, req.userId);
    return { success: true, messages };
  }

  @Post('send')
  async sendMessage(@Req() req: any, @Body() body: any) {
    const message = await this.msgService.send(body.conversationId, req.userId, body.encryptedContent, body.iv);
    return { success: true, message };
  }
}
