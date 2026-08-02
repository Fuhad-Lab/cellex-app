import { Body, Controller, Post, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

/**
 * PaymentsController
 *
 * Handles payment verification ONLY.
 *
 * CRITICAL: Payment success is NEVER trusted from the client.
 * The client sends a payment reference, and NestJS verifies it
 * directly with Paystack's server-to-server API.
 *
 * Only after Paystack confirms the payment does the order status
 * change to 'paid'.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Verify a payment.
   * Body: { reference: "paystack_reference", orderId: "uuid" }
   *
   * Flow:
   * 1. Client makes payment via Paystack (client-side)
   * 2. Client sends reference to this endpoint
   * 3. NestJS calls Paystack's verify API (server-to-server)
   * 4. If Paystack says "success" AND amount matches order total → mark as paid
   * 5. If anything doesn't match → reject
   */
  @Post('verify')
  async verifyPayment(@Req() req: any, @Body() dto: VerifyPaymentDto) {
    const result = await this.paymentsService.verifyPayment(req.userId, dto);
    return { success: true, ...result };
  }
}
