import { IsArray, IsInt, IsOptional, IsString, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class ShippingAddressDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}
