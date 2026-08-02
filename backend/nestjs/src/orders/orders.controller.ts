import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * OrdersController
 *
 * Handles order creation and retrieval.
 *
 * CRITICAL SECURITY:
 * - Prices are fetched from the DB (NEVER from the client)
 * - Stock is checked and decremented atomically
 * - User identity comes from X-User-Id header (set by Edge Functions)
 * - Order ownership is verified on every retrieval
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Create a new order.
   * Body: { items: [{ productId, quantity }], shippingAddress: {...} }
   *
   * The client sends product IDs and quantities ONLY.
   * Prices, stock, and seller info are fetched server-side.
   */
  @Post()
  async createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(req.userId, dto);
    return { success: true, order };
  }

  /**
   * Get all orders for the authenticated user.
   */
  @Get()
  async getOrders(@Req() req: any) {
    const orders = await this.ordersService.getOrdersByUser(req.userId);
    return { success: true, orders };
  }

  /**
   * Get a single order by ID.
   * Ownership is verified — users can only see their own orders.
   */
  @Get(':id')
  async getOrder(@Req() req: any, @Param('id') id: string) {
    const order = await this.ordersService.getOrderById(id, req.userId);
    return { success: true, order };
  }
}
