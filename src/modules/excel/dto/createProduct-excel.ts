import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateProductExcDto {
  @ApiProperty({
    description: `Carpet code`,
    example: '23462908374643',
    required: false,
  })
  @IsOptional()
  @IsString()
  code: string;

  @ApiProperty({
    description: `Carpet count`,
    example: 3,
  })
  @IsNotEmpty()
  @IsNumber()
  count: number;

  @IsOptional()
  @IsNumber()
  displayPrice: number;

  @ApiProperty({
    description: `Carpet image url`,
    example: 'https://carpet.jpg',
    required: false,
  })

  @IsOptional()
  @IsNumber()
  comingPrice: number;

  @ApiProperty({
    description: `Collection price`,
    example: '8',
  })
  @IsOptional()
  @IsNumber()
  collectionPrice: number;

  @ApiProperty({
    description: `price meter`,
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  priceMeter: number;

  @IsOptional()
  @IsBoolean()
  isMetric: boolean;

  @IsOptional()
  @IsBoolean()
  isEdited: boolean;

  @IsOptional()
  @IsString()
  partiya: string;

  @IsOptional()
  @IsString()
  bar_code: string;

  y?: number;
}

export default CreateProductExcDto;
