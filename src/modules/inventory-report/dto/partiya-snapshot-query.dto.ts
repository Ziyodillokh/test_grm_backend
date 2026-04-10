import { IsOptional, IsUUID, IsDateString, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class PartiyaSnapshotQueryDto {
  @ApiProperty({ required: false, description: 'Year (default: current year)', example: 2026 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiProperty({ required: false, description: 'Snapshot date (default: today)', example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false, description: 'Filter by country ID' })
  @IsOptional()
  @IsUUID('4')
  countryId?: string;

  @ApiProperty({ required: false, description: 'Filter by factory ID' })
  @IsOptional()
  @IsUUID('4')
  factoryId?: string;

  @ApiProperty({ required: false, description: 'Filter by filial ID' })
  @IsOptional()
  @IsUUID('4')
  filialId?: string;

  @ApiProperty({ required: false, description: 'Search by partiya number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number = 50;
}
