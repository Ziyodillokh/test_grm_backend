import { IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class FactoryExcelQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  year?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  month?: number;

  @IsOptional()
  @IsUUID('4')
  factoryId?: string;
}
