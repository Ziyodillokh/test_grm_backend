import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class QueryUserDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  readonly limit?: number = 100;

  @ApiPropertyOptional({ description: 'Filter by role (numeric)' })
  @IsOptional()
  @IsString()
  readonly role?: string;

  @ApiPropertyOptional({ description: 'Filter by branch ID' })
  @IsOptional()
  @IsString()
  readonly filial?: string;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  readonly search?: string;
}
