import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DatabaseService } from '../common/database.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, DatabaseService, RedisService],
})
export class OrdersModule {}
