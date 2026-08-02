import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { UploadsModule } from './uploads/uploads.module';
import { InternalTokenGuard } from './common/internal-token.guard';
import { AuditInterceptor } from './common/audit.interceptor';
import { ErrorFilter } from './common/error.filter';
import { DatabaseService } from './common/database.service';
import { RedisService } from './common/redis.service';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute per service token
    }]),
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    MessagingModule,
    NotificationsModule,
    AdminModule,
    AuditModule,
    UploadsModule,
  ],
  providers: [
    InternalTokenGuard,
    AuditInterceptor,
    ErrorFilter,
    DatabaseService,
    RedisService,
  ],
  controllers: [HealthController],
})
export class AppModule {}
