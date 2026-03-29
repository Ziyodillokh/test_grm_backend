import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaperReportDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  kv: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title: string;
}
