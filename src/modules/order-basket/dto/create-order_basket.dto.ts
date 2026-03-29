import { IsBoolean, IsEmpty, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateOrderBasketDto {
  @ApiProperty({
    description: `qr_code id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsNumber()
  qr_code: number | string;

  @ApiProperty({
    description: `Is metric ?`,
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  readonly isMetric: boolean;

  @ApiProperty({
    description: `x`,
    example: 3,
    required: false,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly x: number;

  @IsEmpty()
  seller: string;

  @ApiProperty({
    description: `qr_code id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  product: string;

  @ApiProperty({
    description: `is_transfer`,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_transfer: boolean;

  order_index: number;
}

export default CreateOrderBasketDto;
