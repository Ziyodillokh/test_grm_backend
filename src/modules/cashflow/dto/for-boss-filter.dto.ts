import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CashFlowEnum } from 'src/infra/shared/enum';

export class FilterCashflowByMonthDto {
  @IsInt()
  @Type(() => Number)
  month: number;

  @IsInt()
  @Type(() => Number)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(CashFlowEnum)

  type?: CashFlowEnum;
}
