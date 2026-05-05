import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class FactoryDetailQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  year?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  month?: number;

  @IsOptional()
  fromDate?: string;

  @IsOptional()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
