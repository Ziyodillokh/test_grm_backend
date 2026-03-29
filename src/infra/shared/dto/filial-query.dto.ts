import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { FilialTypeEnum } from '../enum';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class FilialQueryDto {
  @ApiProperty({
    description: 'title',
    example: 'Sanat Calypso',
    required: false,
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiProperty({
    description: FilialTypeEnum.FILIAL,
    enum: FilialTypeEnum,
    example: FilialTypeEnum.DEALER,
    default: FilialTypeEnum.DEALER,
    required: false,
  })
  @IsOptional()
  @IsEnum(FilialTypeEnum)
  type: FilialTypeEnum;

  @ApiProperty({
    description: `Is active`,
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsString()
  readonly isActive;

  @ApiProperty({
    description: `Limit`,
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({
    description: `Page`,
    example: 1,
    default: 1,
    required: false,
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

export default FilialQueryDto;
