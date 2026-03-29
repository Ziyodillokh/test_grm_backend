import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { KassaProgresEnum } from '../enum';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = Number(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class KassaQueryDto {
  @ApiProperty({
    description: `start date`,
    example: '2023-05-02 08:10:23.726769',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly startDate: string;

  @ApiProperty({
    description: `end date`,
    example: '2023-05-02 08:10:23.726769',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly endDate: string;

  @ApiProperty({
    description: 'year',
    required: false,
  })
  @IsOptional()
  readonly year: number;

  @ApiProperty({
    description: 'month',
    required: false,
  })
  @IsOptional()
  readonly month: number;

  @ApiProperty({
    description: `filial id`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly filial: string;

  @ApiProperty({
    description: `kassa report id`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly report: string;

  @ApiProperty({
    description: `is active type`,
    example: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly isActive: boolean;

  @ApiProperty({
    description: `status`,
    example: KassaProgresEnum.OPEN,
    required: false,
    enum: KassaProgresEnum,
  })
  @IsOptional()
  @IsEnum(KassaProgresEnum)
  readonly status: KassaProgresEnum;

  @ApiProperty({
    description: `Limit`,
    example: 20,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({
    description: `Page`,
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default KassaQueryDto;
