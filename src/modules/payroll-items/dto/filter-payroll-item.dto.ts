import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export default class FilterPayrollItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payrollId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}
