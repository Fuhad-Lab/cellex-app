import { IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  reference: string;

  @IsUUID()
  orderId: string;
}
