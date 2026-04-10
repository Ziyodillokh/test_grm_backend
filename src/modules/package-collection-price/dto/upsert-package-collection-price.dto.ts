import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PackageCollectionPriceItemDto {
  @ApiProperty({ description: 'Collection ID' })
  @IsUUID('4')
  collectionId: string;

  @ApiProperty({ description: 'Dealer sale price per m² (discounted)' })
  @IsNumber()
  @Min(0)
  dealerPriceMeter: number;
}

export class UpsertPackageCollectionPriceDto {
  @ApiProperty({ description: 'Package transfer ID' })
  @IsUUID('4')
  packageId: string;

  @ApiProperty({ description: 'Dealer prices per collection', type: [PackageCollectionPriceItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PackageCollectionPriceItemDto)
  items: PackageCollectionPriceItemDto[];
}
