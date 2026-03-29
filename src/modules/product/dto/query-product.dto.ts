import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class QueryProductDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly limit?: number = 100;

  @ApiPropertyOptional({ description: 'Filter by branch ID' })
  @IsOptional()
  @IsString()
  readonly filial?: string;

  @ApiPropertyOptional({ description: 'Filter by bar code ID' })
  @IsOptional()
  @IsString()
  readonly bar_code?: string;

  @ApiPropertyOptional({ description: 'Search by code' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ description: 'Search fields (comma separated)' })
  @IsOptional()
  @IsString()
  readonly fields?: string;

  @ApiPropertyOptional({ description: 'Filter by is_deleted' })
  @IsOptional()
  @IsString()
  readonly is_deleted?: string;
}
