import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  async list(limit: number = 50, category?: string) {
    const filters: any = { status: 'active' };
    if (category) filters.category = category;
    return this.db.select('products', '*', filters, { order: 'created_at', limit });
  }

  async trending(limit: number = 20) {
    return this.db.select('products', '*', { status: 'active' }, { order: 'units_sold', limit });
  }

  async getById(id: number) {
    const products = await this.db.select('products', '*', { id }, { limit: 1 });
    if (!products.length) throw new NotFoundException('Product not found');
    return products[0];
  }

  async create(sellerId: string, data: any) {
    return this.db.insert('products', {
      seller_id: sellerId,
      name: data.name,
      description: data.description || '',
      price: data.price,
      image_url: data.image_url || '',
      category: data.category || 'General',
      stock: data.stock || 100,
      group_buy_enabled: data.group_buy_enabled || false,
      group_buy_target_count: data.group_buy_target_count || 3,
      group_buy_discount_pct: data.group_buy_discount_pct || 20,
      status: 'active',
    });
  }

  async search(query: string, limit: number = 20) {
    // Basic text search (NestJS side — FastAPI does semantic search)
    const { data, error } = await (this.db as any).supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('status', 'active')
      .limit(limit);
    return data || [];
  }

  async byIds(ids: number[]) {
    if (!ids.length) return [];
    const { data } = await (this.db as any).supabase
      .from('products')
      .select('*,sellers!products_seller_id_fkey(id,business_name,profile_image,slug)')
      .in('id', ids);
    return data || [];
  }

  async update(id: number, sellerId: string, data: any) {
    // Verify ownership
    const products = await this.db.select('products', 'seller_id', { id }, { limit: 1 });
    if (!products.length) throw new NotFoundException('Product not found');
    if (products[0].seller_id !== sellerId) throw new ForbiddenException('Not your product');

    const allowed = ['name', 'description', 'price', 'image_url', 'category', 'stock',
                     'group_buy_enabled', 'group_buy_target_count', 'group_buy_discount_pct', 'status'];
    const updates: any = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (data[k] !== undefined) updates[k] = data[k];
    }
    const result = await this.db.update('products', updates, { id });
    return result[0];
  }

  async delete(id: number, sellerId: string) {
    const products = await this.db.select('products', 'seller_id', { id }, { limit: 1 });
    if (!products.length) throw new NotFoundException('Product not found');
    if (products[0].seller_id !== sellerId) throw new ForbiddenException('Not your product');
    await this.db.update('products', { status: 'deleted' }, { id });
  }
}
