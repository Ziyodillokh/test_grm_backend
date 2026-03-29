import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCollectionReportDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  filialId?: string;

  @IsOptional()
  collectionId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export interface FilterMonthlyReportDto {
  year?: string | number;
  month?: string | number;
  filialId?: string;
  collectionId?: string;
  page?: string | number;
  limit?: string | number;
  factory?: string
  country?: string
}
