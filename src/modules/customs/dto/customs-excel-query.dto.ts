import { IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CustomsExcelQueryDto {
  @ApiProperty({ required: false, description: 'Year (default: current year)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiProperty({ required: false, description: 'Month 1-12 (default: current month)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  month?: number;

  @ApiProperty({ required: false, description: 'Specific customs ID for single export' })
  @IsOptional()
  @IsUUID('4')
  customsId?: string;
}
