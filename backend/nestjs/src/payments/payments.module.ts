import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DatabaseService } from '../common/database.service';
import { RedisService } from '../common/redis.service';
import { OrdersService } from '../orders/orders.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, DatabaseService, RedisService, OrdersService],
})
export class PaymentsModule {}
