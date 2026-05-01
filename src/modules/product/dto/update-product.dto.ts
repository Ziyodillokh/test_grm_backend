import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Product code', example: '2346290837462098' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'Uzbekistan' })
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ description: 'Color', example: 'yellow' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Date', example: '2023-05-02 08:10:23' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Count', example: 3 })
  @IsOptional()
  @IsNumber()
  count?: number;

  @ApiPropertyOptional({ description: 'Check count', example: 3 })
  @IsOptional()
  @IsNumber()
  check_count?: number;

  @ApiPropertyOptional({ description: 'Image URL media ID', example: 'uuid' })
  @IsOptional()
  @IsUUID(4)
  imgUrl?: string;

  @ApiPropertyOptional({ description: 'Price', example: 1500000 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'Second price', example: 1200000 })
  @IsOptional()
  @IsNumber()
  secondPrice?: number;

  @IsOptional()
  @IsNumber()
  priceMeter?: number;

  @ApiPropertyOptional({ description: 'Coming price', example: 800000 })
  @IsOptional()
  @IsNumber()
  comingPrice?: number;

  @ApiPropertyOptional({ description: 'Shape', example: 'square' })
  @IsOptional()
  @IsString()
  shape?: string;

  @ApiPropertyOptional({ description: 'Size', example: '2x3' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ description: 'Style', example: 'classic' })
  @IsOptional()
  @IsString()
  style?: string;

  @ApiPropertyOptional({ description: 'Branch ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  filial?: string;

  @ApiPropertyOptional({ description: 'Model ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Other images', example: ['link1', 'link2'] })
  @IsOptional()
  @IsArray()
  otherImgs?: string[];

  @ApiPropertyOptional({ description: 'Is metric', example: true })
  @IsOptional()
  @IsBoolean()
  isMetric?: boolean;

  @ApiPropertyOptional({ description: 'Is internet shop product', example: false })
  @IsOptional()
  @IsBoolean()
  isInternetShop?: boolean;

  @ApiPropertyOptional({ description: 'Internet info text' })
  @IsOptional()
  @IsString()
  internetInfo?: string;

  @IsOptional()
  x?: number;

  @IsOptional()
  y?: number;

  video?: string;
  is_deleted?: boolean;
}

export default UpdateProductDto;
