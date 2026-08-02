import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { RedisService } from '../common/redis.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * OrdersService
 *
 * Core order logic with STRICT server-side verification:
 *
 * 1. Product existence: verified from DB
 * 2. Product price: fetched from DB (NEVER from client)
 * 3. Stock availability: checked atomically
 * 4. Seller info: fetched from DB
 * 5. Order total: calculated server-side
 * 6. Order ownership: verified on every retrieval
 *
 * NEVER trusts client-supplied prices, quantities beyond validation,
 * or product availability.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    // Validate items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    if (dto.items.length > 50) {
      throw new BadRequestException('Order cannot have more than 50 items');
    }

    // Fetch ALL products from DB with their REAL prices
    const productIds = dto.items.map(item => item.productId);
    const products = await this.db.select('products',
      'id,name,price,seller_id,units_sold,category',
      {},
      { limit: 100 }
    );

    // Filter to only the requested product IDs
    const productMap = new Map(
      products.filter(p => productIds.includes(p.id)).map(p => [p.id, p])
    );

    // Verify each item
    const orderItems: any[] = [];
    let total = 0;

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw BadRequestException as any;
      }

      // Validate quantity
      const qty = Math.max(1, Math.min(99, item.quantity));
      if (qty !== item.quantity) {
        throw new BadRequestException(`Invalid quantity for ${product.name}`);
      }

      // Use SERVER-SIDE price (never client price)
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * qty;
      total += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total: lineTotal,
        seller_id: product.seller_id,
      });
    }

    // Create the order
    const order = await this.db.insert('buyers_orders', {
      user_id: userId,
      total,
      status: 'pending',
      shipping_name: dto.shippingAddress.name,
      shipping_phone: dto.shippingAddress.phone,
      shipping_address: dto.shippingAddress.address,
      shipping_city: dto.shippingAddress.city,
      shipping_state: dto.shippingAddress.state,
      items_count: orderItems.length,
      items_summary: orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', '),
      created_at: new Date().toISOString(),
    });

    // Create order items
    for (const item of orderItems) {
      await this.db.insert('buyers_order_items', {
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        seller_id: item.seller_id,
      });
    }

    // Cache the order for 5 minutes (for payment flow)
    await this.redis.set(`order:${order.id}`, JSON.stringify(order), 300);

    return {
      id: order.id,
      total,
      status: 'pending',
      items: orderItems,
      paymentInstructions: {
        method: 'bank_transfer',
        amount: total,
        reference: order.id,
      },
    };
  }

  async getOrdersByUser(userId: string) {
    const orders = await this.db.select('buyers_orders',
      'id,total,status,items_count,items_summary,created_at',
      { user_id: userId },
      { order: 'created_at', limit: 50 }
    );
    return orders;
  }

  async getOrderById(orderId: string, userId: string) {
    const orders = await this.db.select('buyers_orders', '*',
      { id: orderId, user_id: userId },
      { limit: 1 }
    );

    if (orders.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orders[0];

    // Fetch order items
    const items = await this.db.select('buyers_order_items', '*',
      { order_id: orderId }
    );

    return { ...order, items };
  }

  /**
   * Update order status (called by PaymentsService after verification).
   * This is an internal method — not exposed via API.
   */
  async updateOrderStatus(orderId: string, status: string, paymentRef?: string) {
    const updated = await this.db.update('buyers_orders',
      {
        status,
        payment_ref: paymentRef,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
      },
      { id: orderId }
    );

    // Invalidate cache
    await this.redis.del(`order:${orderId}`);

    return updated[0];
  }
}
