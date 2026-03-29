import { IsArray, isArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { TransferEnum, TransferProgresEnum } from '../enum';

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

class TransferQueryDto {
  @ApiProperty({
    description: `start date`,
    example: '2023-05-02 08:10:23.726769',
    required: false

  })
  @IsOptional()
  @IsString()
  readonly startDate;

  @ApiProperty({
    description: `end date`,
    example: '2023-05-02 08:10:23.726769',
    required: false

  })
  @IsOptional()
  @IsString()
  readonly endDate;

  @ApiProperty({
    description: `size`,
    example: '["3x4", "5x6"]',
    required: false

  })
  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  readonly size;

  @ApiProperty({
    description: `collection id`,
    example: 'uuid',
    required: false
  })
  @IsOptional()
  @Transform(parseTextToArray)
  readonly collectionId: string;

  @ApiProperty({
    description: `from filial id`,
    example: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString()
  from: string;

  @ApiProperty({
    description: `to filial id`,
    example: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString()
  to: string;

  @ApiProperty({
    description: `to filial id`,
    example: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString()
  filial: string;

  @ApiProperty({
    description: `package_transfer id`,
    example: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID('4')
  package_transfer: string;

  @ApiProperty({
    description: `type`,
    example: 'In or Out',
    required: false
  })
  @IsOptional()
  @IsString()
  @IsEnum(TransferEnum)
  type: TransferEnum;

  @ApiProperty({
    description: `type`,
    example: TransferProgresEnum.progress,
    required: false
  })
  @IsOptional()
  progress: TransferProgresEnum[];

  @ApiProperty({
    description: `search`,
    example: 'Type something...',
    required: false
  })
  @IsOptional()
  search: string;

  @ApiProperty({
    description: `Limit`,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @IsOptional()
  @IsArray()
  @Transform(parseTextToArray)
  model: string;

  @ApiProperty({
    description: `courier`,
    example: 'UUID',
  })
  @IsOptional()
  @IsUUID('4')
  courier: string;

  @ApiProperty({
    description: `Page`,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default TransferQueryDto;
