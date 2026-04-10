import { IsOptional, IsUUID, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SalesQueryDto {
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

  @ApiProperty({ required: false, description: 'Filial ID (filial/internet tabs)' })
  @IsOptional()
  @IsUUID('4')
  filialId?: string;

  @ApiProperty({ required: false, description: 'Dealer filial ID (dealer tab)' })
  @IsOptional()
  @IsUUID('4')
  dealerId?: string;

  @ApiProperty({ required: false, description: 'Partiya ID (partiya tab drill-down)' })
  @IsOptional()
  @IsUUID('4')
  partiyaId?: string;

  @ApiProperty({
    required: false,
    description: 'Group by dimension',
    enum: ['filial', 'dealer', 'country', 'factory', 'collection', 'model', 'size'],
  })
  @IsOptional()
  @IsString()
  groupBy?: string;

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
