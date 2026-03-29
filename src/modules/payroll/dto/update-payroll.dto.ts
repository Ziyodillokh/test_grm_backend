import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdatePayrollDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  month: number;
}
