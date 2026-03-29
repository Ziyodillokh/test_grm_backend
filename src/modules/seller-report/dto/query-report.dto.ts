import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

function parsePaginationQuery({ key, value }: TransformFnParams) {
  const int = parseInt(value);
  if (isNaN(int) || `${int}`.length !== value.length) {
    throw new BadRequestException(`${key} should be integer.`);
  }
  return int;
}

export class QueryReportDto {
  @ApiPropertyOptional()
  @Transform(parsePaginationQuery)
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @Transform(parsePaginationQuery)
  @IsOptional()
  @IsInt()
  month?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  filialId?: string;

  @ApiPropertyOptional()
  @Transform(parsePaginationQuery)
  @IsOptional()
  limit?: number;
  @ApiPropertyOptional()
  @Transform(parsePaginationQuery)
  @IsOptional()
  page?: number;
}

export class GenerateReportDto {
  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
