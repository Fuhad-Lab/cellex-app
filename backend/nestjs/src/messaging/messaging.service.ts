import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class MessagingService {
  constructor(private readonly db: DatabaseService) {}

  async listConversations(userId: string) {
    const { data } = await (this.db as any).supabase
      .from('conversations')
      .select('*,conversation_members!inner(user_id)')
      .or(`participant1.eq.${userId},participant2.eq.${userId}`)
      .order('last_message_at', { ascending: false });
    return data || [];
  }

  async getMessages(conversationId: string, userId: string) {
    // Verify access
    await this.verifyAccess(conversationId, userId);
    return this.db.select('messages', 'id,sender_id,encrypted_content,iv,created_at',
      { conversation_id: conversationId }, { order: 'created_at', limit: 100 });
  }

  async send(conversationId: string, senderId: string, encryptedContent: string, iv: string) {
    await this.verifyAccess(conversationId, senderId);
    const message = await this.db.insert('messages', {
      conversation_id: conversationId,
      sender_id: senderId,
      encrypted_content: encryptedContent,
      iv,
    });
    await this.db.update('conversations',
      { last_message: '[Encrypted message]', last_message_at: new Date().toISOString() },
      { id: conversationId });
    return message;
  }

  private async verifyAccess(conversationId: string, userId: string) {
    const convs = await this.db.select('conversations', 'id,participant1,participant2',
      { id: conversationId }, { limit: 1 });
    if (!convs.length) throw new ForbiddenException('Conversation not found');
    const conv = convs[0];
    if (conv.participant1 !== userId && conv.participant2 !== userId) {
      // Check conversation_members
      const members = await this.db.select('conversation_members', 'id',
        { conversation_id: conversationId, user_id: userId }, { limit: 1 });
      if (!members.length) throw new ForbiddenException('Not authorized');
    }
  }
}
