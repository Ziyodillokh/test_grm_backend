import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import orderTypeEnum from '../enum/order.type.enum';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = Number(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class OrderQueryDto {
  @ApiPropertyOptional({
    description: `start date`,
    example: '2023-05-02 08:10:23.726769',
  })
  @IsOptional()
  @IsString()
  readonly startDate: Date;

  @ApiPropertyOptional({
    description: `end date`,
    example: '2023-05-02 08:10:23.726769',
  })
  @IsOptional()
  @IsString()
  readonly endDate: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly month: number;

  @ApiPropertyOptional({
    description: `start price`,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly startPrice: number;

  @ApiPropertyOptional({
    description: `end price`,
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly endPrice: number;

  @ApiPropertyOptional({
    description: `kassa id`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly kassa: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({
    description: `filial id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly filialId: string;

  @ApiPropertyOptional({
    description: `report id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly report: string;

  @ApiPropertyOptional({
    description: `search`,
    example: 'nmadir nmadr',
  })
  @IsOptional()
  @IsString()
  readonly search: string;

  @ApiPropertyOptional({
    description: `is active type`,
    example: orderTypeEnum.Accept,
    enum: orderTypeEnum,
  })
  @IsOptional()
  @IsEnum(orderTypeEnum)
  readonly status: orderTypeEnum;

  @ApiPropertyOptional({
    description: `Limit`,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number = 15;

  @ApiPropertyOptional({
    description: `Page`,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;

  @ApiPropertyOptional({
    description: `isMetric`,
    example: 'true',
    required: false,
  })
  @IsOptional()
  readonly isMetric: string | boolean;

  @IsOptional()
  style: string;
  @IsOptional()
  shape: string;
  @IsOptional()
  color: string;
  @IsOptional()
  model: string;
  @IsOptional()
  collection: string;
  @IsOptional()
  size: string;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
    this.isMetric = this.isMetric == 'true';
  }
}

export default OrderQueryDto;
