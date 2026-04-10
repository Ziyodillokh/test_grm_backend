import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PartiyaCollectionPriceItemDto {
  @ApiProperty({ example: 'uuid-of-collection' })
  @IsUUID('4')
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: 25.5, description: 'Factory price per square meter' })
  @IsNumber()
  @Min(0)
  factoryPricePerKv: number;

  @ApiProperty({ example: 5.0, description: 'Overhead per square meter' })
  @IsNumber()
  @Min(0)
  overheadPerKv: number;
}

export class UpsertPartiyaCollectionPriceDto {
  @ApiProperty({ example: 'uuid-of-partiya' })
  @IsUUID('4')
  @IsNotEmpty()
  partiyaId: string;

  @ApiProperty({ type: [PartiyaCollectionPriceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartiyaCollectionPriceItemDto)
  items: PartiyaCollectionPriceItemDto[];
}
