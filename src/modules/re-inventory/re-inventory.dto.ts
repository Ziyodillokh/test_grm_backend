import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductReportEnum } from '@infra/shared/enum';

export class ReInventoryQueryDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  @IsEnum(ProductReportEnum)
  type: ProductReportEnum;

  @ApiProperty({
    required: false
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({ description: 'Page'})
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  page: number;

  @ApiProperty({ description: 'Limit' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  limit: number;
}

export class ProcessInventoryDto {
  @ApiProperty()
  @IsString()
  code: string; // qrbase.code

  @ApiProperty()
  @IsBoolean()
  isMetric: boolean;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  @Min(0.000001)
  value: number; // kelgan miqdor (uzunlik yoki dona)

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  filialId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  sizeId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  shapeId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  styleId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  factoryId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  id?: string;
}
