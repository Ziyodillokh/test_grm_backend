import { IsOptional, IsUUID, IsDateString, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class FilialSnapshotQueryDto {
  @ApiProperty({ required: false, description: 'Filial ID (auto for F_MANAGER)' })
  @IsOptional()
  @IsUUID('4')
  filialId?: string;

  @ApiProperty({ required: false, description: 'Snapshot date (default: today)', example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    required: false,
    description: 'Group by dimension',
    enum: ['country', 'factory', 'collection', 'model', 'size'],
  })
  @IsOptional()
  @IsString()
  groupBy?: 'country' | 'factory' | 'collection' | 'model' | 'size';

  @ApiProperty({ required: false, description: 'Drill-down: country ID' })
  @IsOptional()
  @IsUUID('4')
  countryId?: string;

  @ApiProperty({ required: false, description: 'Drill-down: factory ID' })
  @IsOptional()
  @IsUUID('4')
  factoryId?: string;

  @ApiProperty({ required: false, description: 'Drill-down: collection ID' })
  @IsOptional()
  @IsUUID('4')
  collectionId?: string;

  @ApiProperty({ required: false, description: 'Drill-down: model ID' })
  @IsOptional()
  @IsUUID('4')
  modelId?: string;

  @ApiProperty({ required: false, description: 'Search by title' })
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
