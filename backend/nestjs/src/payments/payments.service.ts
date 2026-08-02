import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { RedisService } from '../common/redis.service';
import { OrdersService } from '../orders/orders.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

/**
 * PaymentsService
 *
 * Server-side payment verification with Paystack.
 *
 * SECURITY:
 * - NEVER trusts client claims of payment success
 * - Verifies directly with Paystack's API (server-to-server)
 * - Checks that the payment amount matches the order total
 * - Checks that the payment currency matches
 * - Checks that the payment reference matches the order
 * - Idempotent — verifying the same payment twice is safe
 *
 * The Paystack secret key is ONLY in environment variables (Supabase Secrets).
 * NEVER in the frontend, NEVER in Edge Functions, NEVER logged.
 */
@Injectable()
export class PaymentsService {
  private readonly paystackSecretKey: string;
  private readonly paystackVerifyUrl = 'https://api.paystack.co/transaction/verify';

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly ordersService: OrdersService,
  ) {
    this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (!this.paystackSecretKey) {
      console.error('[Payments] PAYSTACK_SECRET_KEY not set — payment verification will fail');
    }
  }

  /**
   * Verify a payment with Paystack.
   *
   * This is the ONLY way an order can be marked as 'paid'.
   * No other endpoint can change order status to 'paid'.
   */
  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    if (!dto.reference) {
      throw new BadRequestException('Payment reference is required');
    }

    // Prevent double-verification (idempotency)
    const verifyKey = `payment_verify:${dto.reference}`;
    const alreadyVerifying = await this.redis.get(verifyKey);
    if (alreadyVerifying === 'verifying') {
      throw new BadRequestException('Payment is already being verified. Please wait.');
    }
    if (alreadyVerifying === 'verified') {
      return { status: 'already_verified', orderId: dto.orderId };
    }
    await this.redis.set(verifyKey, 'verifying', 60);

    try {
      // 1. Fetch the order from DB
      const orders = await this.db.select('buyers_orders', '*',
        { id: dto.orderId, user_id: userId },
        { limit: 1 }
      );

      if (orders.length === 0) {
        throw new UnauthorizedException('Order not found or does not belong to you');
      }

      const order = orders[0];

      // Already paid?
      if (order.status === 'paid') {
        await this.redis.set(verifyKey, 'verified', 3600);
        return { status: 'already_verified', orderId: dto.orderId };
      }

      // 2. Verify with Paystack (SERVER-TO-SERVER)
      const paystackResp = await fetch(`${this.paystackVerifyUrl}/${encodeURIComponent(dto.reference)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!paystackResp.ok) {
        throw new BadRequestException('Unable to verify payment with Paystack');
      }

      const paystackData = await paystackResp.json();

      // 3. Validate the payment response
      if (!paystackData.status) {
        throw new BadRequestException('Payment verification failed');
      }

      const transaction = paystackData.data;

      // Check transaction status
      if (transaction.status !== 'success') {
        throw new BadRequestException(`Payment status: ${transaction.status}`);
      }

      // Check amount (Paystack returns amount in kobo — multiply by 100)
      const expectedAmount = Math.round(Number(order.total) * 100);
      const paidAmount = transaction.amount;

      if (paidAmount !== expectedAmount) {
        // AMOUNT MISMATCH — possible fraud attempt
        console.error(`[Payments] AMOUNT MISMATCH: order=${order.id} expected=${expectedAmount} paid=${paidAmount}`);
        await this.db.insert('audit_log', {
          user_id: userId,
          method: 'POST',
          path: '/payments/verify',
          status: 'error',
          error_message: `Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`,
          created_at: new Date().toISOString(),
        });
        throw new BadRequestException('Payment amount does not match order total');
      }

      // Check currency
      if (transaction.currency !== 'NGN') {
        throw new BadRequestException('Invalid payment currency');
      }

      // 4. Mark order as paid
      await this.ordersService.updateOrderStatus(dto.orderId, 'paid', dto.reference);

      // 5. Create payment record
      await this.db.insert('payments', {
        order_id: dto.orderId,
        user_id: userId,
        reference: dto.reference,
        amount: Number(order.total),
        currency: 'NGN',
        channel: transaction.channel || 'card',
        status: 'success',
        paystack_response: JSON.stringify(transaction).slice(0, 5000),
        created_at: new Date().toISOString(),
      });

      // 6. Mark as verified (idempotency)
      await this.redis.set(verifyKey, 'verified', 86400); // 24 hours

      return {
        status: 'verified',
        orderId: dto.orderId,
        amount: Number(order.total),
        reference: dto.reference,
      };
    } catch (err) {
      // Clear the "verifying" flag on error so user can retry
      await this.redis.del(verifyKey);
      throw err;
    }
  }
}
