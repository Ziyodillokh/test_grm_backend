import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsEnum, IsString, IsDate, Max, Min } from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { FilialTypeEnum } from 'src/infra/shared/enum';
import CashFlowEnum from '../../../../infra/shared/enum/cashflow/cash-flow.enum';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = Number(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(`${key} should be integer.`);
  }
  return int;
}

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(FilialTypeEnum)
  filialType?: FilialTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  year?: number;

  @ApiProperty({ description: 'Limit', example: 20, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit?: number;

  @ApiProperty({ description: 'Page', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page?: number;

  constructor() {
    this.limit = this.limit ? this.limit : 100;
    this.page = this.page ? this.page : 1;
  }
}

export class HomePageCurrMonth {
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  readonly startDate: Date;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  readonly endDate: Date;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;
}

export class HomePageCurrLeft {
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  readonly year: string;
}

export class HomePageCurrMonthExpense {
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  readonly cashflow_type: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  readonly year: string;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({ example: 1, default: 1, required: false })
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
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filial_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  readonly user_id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  readonly cashflow_type: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @IsEnum(CashFlowEnum)
  readonly type: CashFlowEnum;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({ example: 1, default: 1, required: false })
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
  @ApiProperty({ required: false })
  @IsOptional()
  readonly debt_id: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  readonly month: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @IsEnum(CashFlowEnum)
  readonly type: CashFlowEnum;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({ example: 1, default: 1, required: false })
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
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filial: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly year: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly type: string;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly limit: number;

  @ApiProperty({ example: 1, default: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(parsePaginationQuery)
  readonly page: number = 1;
}

export class ReportMonthlyV2 {
  @ApiProperty({ required: false })
  @IsOptional()
  readonly filialId: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  readonly month: number;

  @ApiProperty({ required: false })
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
