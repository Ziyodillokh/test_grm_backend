import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '../../../common/enums/product-status.enum';

export class UpdateQrBaseDto {
  @ApiPropertyOptional({ description: 'QR code', example: '123456789' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Country ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Collection ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ description: 'Factory ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  factory?: string;

  @ApiPropertyOptional({ description: 'Size ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ description: 'Shape ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  shape?: string;

  @ApiPropertyOptional({ description: 'Style ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  style?: string;

  @ApiPropertyOptional({ description: 'Color ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Model ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Is metric' })
  @IsOptional()
  @IsBoolean()
  isMetric?: boolean;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Product status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Internet price' })
  @IsOptional()
  @IsNumber()
  i_price?: number;

  @ApiPropertyOptional({ description: 'Internet info text' })
  @IsOptional()
  @IsString()
  internetInfo?: string;
}

export default UpdateQrBaseDto;
