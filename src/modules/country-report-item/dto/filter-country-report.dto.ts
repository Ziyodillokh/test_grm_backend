import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCountryReportDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  filialId?: string;

  @IsOptional()
  countryId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export interface FilterMonthlyCountryReportDto {
  year?: string | number;
  month?: string | number;
  filialId?: string;
  countryId?: string;
  page?: string | number;
  limit?: string | number;
}
