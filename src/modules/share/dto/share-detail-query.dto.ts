import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ShareDetailQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  month?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiProperty({ required: false, description: 'income | expense' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false, description: 'capital | profit (faqat expense uchun)' })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number = 20;
}
