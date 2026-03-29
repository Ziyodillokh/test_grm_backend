import { IsBoolean, IsDate, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
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

class queryPartiyaDto {
  @ApiProperty({
    description: `start_date`,
    example: 'date',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly start_date?: Date;

  @ApiProperty({
    description: `end_date`,
    example: 'date',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly end_date?: string;

  @ApiProperty({
    description: `country`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  readonly country?: string;

  @ApiProperty({
    description: `partiya_no`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  readonly partiya_no?: string;

  @ApiProperty({
    description: `factory`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  readonly factory?: string;


  @ApiProperty({
    description: `warehouse`,
    example: 'UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  readonly warehouse?: string;

  @ApiProperty({
    description: `is_active`,
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly is_active?: boolean;

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

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default queryPartiyaDto;