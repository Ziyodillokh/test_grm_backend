import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientOrderStatus } from '../../../common/enums';
import {
  OrderStatusEnum,
  PaymentTypeEnum,
} from '../client-order.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientOrderDto {
  @ApiProperty({
    description: 'Order items',
    example: [{ product: 'UUID', count: 1 }],
  })
  @IsNotEmpty()
  @IsArray()
  client_order_items: { product: string; count: number }[];

  @ApiProperty({
    description: 'Payment type',
    enum: PaymentTypeEnum,
    example: PaymentTypeEnum.IN_HAND,
  })
  @IsEnum(PaymentTypeEnum)
  @IsNotEmpty()
  payment_type: PaymentTypeEnum;

  @ApiProperty({ description: 'Delivery comment', required: false })
  @IsOptional()
  @IsString()
  readonly delivery_comment?: string;

  @ApiProperty({ description: 'City', example: 'Tashkent', required: false })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiProperty({ description: 'District', example: 'Yunusabad', required: false })
  @IsOptional()
  @IsString()
  readonly district?: string;

  @ApiProperty({ description: 'Full address', required: false })
  @IsOptional()
  @IsString()
  full_address?: string;

  @ApiProperty({ description: 'Location link', required: false })
  @IsOptional()
  @IsString()
  readonly location_link?: string;

  @ApiProperty({ description: 'Planned delivery date', example: '2025-09-22', required: false })
  @IsOptional()
  @IsString()
  readonly date?: string;

  @ApiProperty({ description: 'User ID', example: 'UUID' })
  @IsNotEmpty()
  @IsString()
  readonly user: string;
}

export class UpdateClientOrderDto {
  @ApiProperty({ description: 'Delivery status', required: false })
  @IsOptional()
  @IsBoolean()
  readonly delivery?: boolean;

  @ApiProperty({ description: 'Payment status', enum: ClientOrderStatus, required: false })
  @IsOptional()
  @IsEnum(ClientOrderStatus)
  readonly payment_status?: ClientOrderStatus;

  @ApiProperty({ description: 'Order status', enum: OrderStatusEnum, required: false })
  @IsOptional()
  @IsEnum(OrderStatusEnum)
  readonly order_status?: OrderStatusEnum;

  @ApiProperty({ description: 'Delivery comment', required: false })
  @IsOptional()
  @IsString()
  readonly delivery_comment?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiProperty({ description: 'District', required: false })
  @IsOptional()
  @IsString()
  readonly district?: string;

  @ApiProperty({ description: 'Location link', required: false })
  @IsOptional()
  @IsString()
  readonly location_link?: string;

  @ApiProperty({ description: 'Planned delivery date', required: false })
  @IsOptional()
  @IsString()
  readonly date?: string;
}

export class QueryClientOrderDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Auth token for client queries' })
  @IsOptional()
  @IsString()
  token?: string;
}
