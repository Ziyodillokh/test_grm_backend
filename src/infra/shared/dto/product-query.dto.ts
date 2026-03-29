import { IsArray, isArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { ProductReportEnum, ProductStatusEnum } from '../enum';

const required = false;

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = Number(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

function parseTextToArray({ key, value }: TransformFnParams) {
  const arr = value ? JSON.parse(value) : '';
  if (!isArray(arr)) {
    throw new BadRequestException(`${key} should be array`);
  }
  return arr;
}

class ProductQueryDto {
  @ApiProperty({
    description: `start date`,
    example: '2023-05-02 08:10:23.726769',
    required
  })
  @IsOptional()
  @IsString()
  readonly startDate: Date;

  @ApiProperty({
    description: `end date`,
    example: '2023-05-02 08:10:23.726769',
    required

  })
  @IsOptional()
  @IsString()
  readonly endDate: Date;

  @ApiProperty({
    description: `start price`,
    example: 20,
    required
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly startPrice: number;

  @ApiProperty({
    description: `end price`,
    example: 50,
    required

  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly endPrice: number;

  @ApiProperty({
    description: `style`,
    example: '["Modern", "Classic"]',
    required
  })
  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  readonly style: string[];

  @ApiProperty({
    description: `size`,
    example: '["3x4", "5x6"]',
    required

  })
  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  readonly size: string[];

  @ApiProperty({
    description: `shape`,
    example: '["Triangle", "Square"]',
    required

  })
  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  readonly shape: string[];

  @ApiProperty({
    description: `color`,
    example: '["Red", "Yellow"]',
    required

  })
  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  readonly color: string[];

  @ApiProperty({
    description: `collection id`,
    required,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly collectionId: string;

  @ApiProperty({
    description: `model id`,
    required,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly modelId: string;

  @ApiProperty({
    description: `filial id`,
    required,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly filialId: string;

  @ApiProperty({
    description: `partiya id`,
    required,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly partiyaId: string;

  @ApiProperty({
    description: `search`,
    required,
    example: '...',
  })
  @IsOptional()
  @IsString()
  readonly search: string;

  @ApiProperty({
    description: `internet shop product need come`,
    required,
    example: true,
  })  
  @IsOptional()
  readonly isInternetShop: string;

  @ApiProperty({
    description: `Limit`,
    required,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({
    description: `Page`,
    required,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;

  @ApiProperty({
    description: `isMetric`,
    example: true,
    required
  })
  @IsOptional()
  readonly isMetric: string | boolean;

  @ApiProperty({
    description: `isMetric`,
    example: true,
    required
  })
  type?: ProductReportEnum

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
    this.isMetric = this.isMetric == 'true';
  }
}

export default ProductQueryDto;
