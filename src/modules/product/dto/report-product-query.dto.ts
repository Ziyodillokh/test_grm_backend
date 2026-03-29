import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { ProductReportEnum } from '../../../infra/shared/enum';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}

class ReportProductQuery {
  @ApiProperty({
    description: `filial id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  readonly filialId: string;

  @ApiProperty({
    description: `type`,
    example: ProductReportEnum.DEFICIT,
    enum: ProductReportEnum,
  })
  @IsOptional()
  @IsEnum(ProductReportEnum)
  readonly type: ProductReportEnum;

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
  readonly page: number = 1

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export default ReportProductQuery;
