import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterFactoryReportDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  filialId?: string;

  @IsOptional()
  factoryId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export interface FilterMonthlyFactoryReportDto {
  year?: string | number;
  month?: string | number;
  filialId?: string;
  factoryId?: string;
  page?: string | number;
  limit?: string | number;
  country?: string;
}
