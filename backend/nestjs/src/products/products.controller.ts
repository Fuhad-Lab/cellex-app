import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@Query('limit') limit: number = 50, @Query('category') category?: string) {
    const products = await this.productsService.list(limit, category);
    return { success: true, products };
  }

  @Get('trending')
  async trending(@Query('limit') limit: number = 20) {
    const products = await this.productsService.trending(limit);
    return { success: true, products };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const product = await this.productsService.getById(Number(id));
    return { success: true, product };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const product = await this.productsService.create(req.userId, body);
    return { success: true, product };
  }

  @Post('search')
  async search(@Body() body: any) {
    const products = await this.productsService.search(body.query, body.limit || 20);
    return { success: true, products };
  }

  @Post('by-ids')
  async byIds(@Body() body: any) {
    const products = await this.productsService.byIds(body.ids || []);
    return { success: true, products };
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const product = await this.productsService.update(Number(id), req.userId, body);
    return { success: true, product };
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.productsService.delete(Number(id), req.userId);
    return { success: true };
  }
}
