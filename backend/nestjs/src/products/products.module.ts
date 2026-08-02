import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { DatabaseService } from '../common/database.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, DatabaseService],
})
export class ProductsModule {}
