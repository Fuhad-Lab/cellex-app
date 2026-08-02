import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(userId: string) {
    const profiles = await this.db.select('profiles', '*', { id: userId }, { limit: 1 });
    return profiles[0] || null;
  }

  async updateProfile(userId: string, data: any) {
    const allowed = ['full_name', 'phone', 'address', 'avatar_url'];
    const updates: any = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (data[k] !== undefined) updates[k] = data[k];
    }
    const result = await this.db.update('profiles', updates, { id: userId });
    return result[0];
  }
}
