import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async listUsers() {
    return this.db.select('profiles', 'id,full_name,phone,created_at', {}, { order: 'created_at', limit: 100 });
  }

  async moderate(body: any) {
    // Flag content (posts, products, reviews)
    if (body.type === 'post') {
      await this.db.update('feed_posts', { status: 'flagged' }, { id: body.id });
    } else if (body.type === 'product') {
      await this.db.update('products', { status: 'inactive' }, { id: body.id });
    }
  }
}
