import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductReportEnum } from '../../../infra/shared/enum';

class CheckProductDto {
  @ApiProperty({
    description: `bar code`,
    example: 'UUID',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  bar_code: string;

  @ApiProperty({
    description: `y`,
    example: 500,
    required: false,
  })
  @IsNotEmpty()
  @IsNumber()
  y: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  collection: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  model: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  color: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  size: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  shape: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  style: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  country: string;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isMetric: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  factory: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  filialId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tip: ProductReportEnum;
}

export default CheckProductDto;
