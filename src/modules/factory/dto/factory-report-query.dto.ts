import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class FactoryReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  year?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  month?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
