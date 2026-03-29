import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product code', example: '2346290837462098' })
  @IsNotEmpty()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'QR base code', example: '2346290837462098' })
  @IsNotEmpty()
  @IsString()
  bar_code: string;

  @ApiPropertyOptional({ description: 'Product date', example: '2023-05-02 08:10:23' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ description: 'Product count', example: 3 })
  @IsNotEmpty()
  @IsNumber()
  count: number;

  @ApiPropertyOptional({ description: 'Product price', example: 1500000 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'Second price', example: 1200000 })
  @IsOptional()
  @IsNumber()
  secondPrice?: number;

  @ApiProperty({ description: 'Price per meter', example: 500000 })
  @IsNotEmpty()
  @IsNumber()
  priceMeter?: number;

  @ApiProperty({ description: 'Coming price', example: 800000 })
  @IsNotEmpty()
  @IsNumber()
  comingPrice: number;

  @ApiPropertyOptional({ description: 'Branch ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  filial?: string;

  @ApiPropertyOptional({ description: 'Partiya ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  partiya?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsNumber()
  totalSize?: number;

  collection_price?: string;

  partiya_title?: string;
}

export default CreateProductDto;
