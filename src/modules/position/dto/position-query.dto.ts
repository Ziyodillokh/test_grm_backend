// color-query.dto.ts
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class PositionQueryDto {
  @ApiProperty({
    description: `search`,
    example: 'qwe',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

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
    description: `IsActive`,
    example: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly is_active?: string;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default PositionQueryDto;
