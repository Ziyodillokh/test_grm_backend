import { IsOptional, IsString, IsNumber, IsArray, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateProductExcelDto {
  @IsOptional()
  @IsString()
  code: string;

  @ApiProperty({
    description: `Carpet color.`,
    example: 'UUID',
  })
  @IsOptional()
  color: object;

  @IsOptional()
  @IsNumber()
  secondPrice: number;

  @IsOptional()
  @IsNumber()
  count: number;

  @IsOptional()
  @IsNumber()
  check_count: number;

  @IsOptional()
  @IsString()
  country: string;

  @IsOptional()
  @IsNumber()
  comingPrice: number;

  @IsOptional()
  @IsNumber()
  collectionPrice: number;

  @ApiProperty({
    description: `Carpet price by meter.`,
    example: 15,
  })
  @IsOptional()
  @IsNumber()
  priceMeter: number;

  @IsOptional()
  shape: string;

  @IsOptional()
  size: string;

  @IsOptional()
  style: string;

  @IsOptional()
  collection: string;

  @IsOptional()
  model: object;

  @IsOptional()
  @IsNumber()
  m2: number;

  @IsOptional()
  @IsBoolean()
  isMetric: boolean;

  @IsOptional()
  @IsBoolean()
  isEdited: boolean;

  @IsOptional()
  @IsBoolean()
  displayPrice: number;

  @IsOptional()
  @IsNumber()
  cost: number;

  @IsOptional()
  @IsNumber()
  y: number;
}

export default UpdateProductExcelDto;
