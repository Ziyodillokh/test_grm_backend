import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = Number(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class OrderBasketQueryDto {
  @ApiProperty({
    description: `Product`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID(4)
  readonly product: string;

  @ApiProperty({
    description: `filial`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID(4)
  readonly filial: string;

  @ApiProperty({
    description: `Limit`,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({
    description: `Page`,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;

  @ApiProperty({
    description: `is_transfer`,
    example: false,
  })
  @IsOptional()
  @IsString()
  is_transfer?: string;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default OrderBasketQueryDto;
