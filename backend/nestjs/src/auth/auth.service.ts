import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async verifyUser(userId: string) {
    if (!userId) return null;
    const users = await this.db.select('profiles', 'id,full_name,avatar_url', { id: userId }, { limit: 1 });
    return users[0] || null;
  }
}
