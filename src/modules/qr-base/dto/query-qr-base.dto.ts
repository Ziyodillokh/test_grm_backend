import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class QueryQrBaseDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly limit?: number = 100;

  @ApiPropertyOptional({ description: 'Search by code or related fields' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  readonly status?: string;
}
