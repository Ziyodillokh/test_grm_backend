import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { CollectionPriceEnum } from '../../../infra/shared/enum';

class CreateCollectionPriceDto {
  @ApiProperty({ example: 100.5 })
  @IsOptional()
  @IsNumber()
  secondPrice: number;

  @ApiProperty({ example: 200.75 })
  @IsOptional()
  @IsNumber()
  priceMeter: number;

  @ApiProperty({ example: 150.3 })
  @IsOptional()
  @IsNumber()
  comingPrice: number;

  @ApiProperty({ example: 'uuid-of-collection' })
  @IsUUID('4')
  @IsNotEmpty()
  collectionId: string;

  type?: CollectionPriceEnum;
}

export default CreateCollectionPriceDto;