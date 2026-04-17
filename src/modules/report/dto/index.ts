import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import CashFlowEnum from '../../../infra/shared/enum/cashflow/cash-flow.enum';

export * from './query-report.dto';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(
      `${key} should be integer. Or pagination query string may be absent, then the page=1, limit=10 will be used.`,
    );
  }
  return int;
}
export class HomePageCurrMonth {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({
    description: 'Start Date',
    required: false,
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  readonly startDate: Date;

  @ApiProperty({
    description: 'Start Date',
    required: false,
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  readonly endDate: Date;

  @ApiProperty({
    description: 'month',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({
    description: 'year',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;
}

export class HomePageCurrLeft {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({
    description: 'Month of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  readonly year: string;
}

export class HomePageCurrMonthExpense {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({
    description: `cashflow_type id`,
    required: false,
  })
  @IsOptional()
  readonly cashflow_type: string;

  @ApiProperty({
    description: 'Month of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  readonly year: string;

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

export class HomePageCurrMonthManagers {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly user_id: string;

  @ApiProperty({
    description: `cashflow_type id`,
    required: false,
  })
  @IsOptional()
  readonly cashflow_type: string;

  @ApiProperty({
    description: 'Month of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsEnum(CashFlowEnum)
  readonly type: CashFlowEnum;

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

export class HomePageCurrLeftKents {
  @ApiProperty({
    description: `debt id`,
    required: false,
  })
  @IsOptional()
  readonly debt_id: string;

  @ApiProperty({
    description: 'Month of data',
    required: false,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: string;

  @ApiProperty({
    description: 'Year of data',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsEnum(CashFlowEnum)
  readonly type: CashFlowEnum;

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

export class HomePageCurrMonthProdaja {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filial: string;

  @ApiProperty({
    description: 'month',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({
    description: 'year',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;

  @ApiProperty({
    description: 'type',
    required: false,
  })
  @IsString()
  @IsOptional()
  readonly type: string;

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
}

export class ReportMonthlyV2 {
  @ApiProperty({
    description: `filial id`,
    required: false,
  })
  @IsOptional()
  readonly filialId: string;

  @ApiProperty({
    description: 'month',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({
    description: 'year',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;
}

export class reportCorrect {
  @ApiProperty({ description: 'Only do or calc' })
  @IsString()
  @IsOptional()
  readonly type: 'calc' | 'do';
}

// Drill-in detail endpoint uchun DTO
export class ReportMonthlyV2Detail {
  @ApiProperty({ description: 'Detail turi', required: true })
  @IsString()
  readonly type: string;

  @ApiProperty({ description: 'month', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({ description: 'year', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;

  @ApiProperty({ description: 'filial id', required: false })
  @IsOptional()
  readonly filialId: string;
}