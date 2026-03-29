import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import ProductStatusEnum from '../../../infra/shared/enum/product.enum';
import { IMarketSizeTypeEnum } from '@infra/shared/enum/i-market.size-type.enum';

class UpdateInternetInfo {
  @ApiProperty({
    description: `internetInfo`,
    example: 'http://',
  })
  @IsOptional()
  @IsString()
  internetInfo: string;

  @ApiProperty({
    description: `otherImgs`,
    example: '["http://", "http://"]',
  })
  @IsOptional()
  @IsString()
  otherImgs: string[];

  @ApiProperty({
    description: 'Main Image',
  })
  @IsOptional()
  @IsUUID()
  imgUrl: string;

  @ApiProperty({
    description: 'Short Video',
  })
  @IsOptional()
  @IsUUID()
  videoUrl: string;

  @ApiProperty()
  @IsOptional()
  @IsEnum(ProductStatusEnum)
  status: ProductStatusEnum;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  i_price: number;

  @ApiProperty()
  @IsOptional()
  @IsEnum(IMarketSizeTypeEnum)
  sizeType: IMarketSizeTypeEnum;

  @ApiProperty({
    description: `Country`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  country: string;

  @ApiProperty({
    description: `Collection`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  collection: string;

  @ApiProperty({
    description: `Factory`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  factory: string;

  @ApiProperty({
    description: `Size`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  size: string;

  @ApiProperty({
    description: `Shape`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  shape: string;

  @ApiProperty({
    description: `Style`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  style: string;

  @ApiProperty({
    description: `color`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  color: string;

  @ApiProperty({
    description: `model`,
    example: 'UUID',
  })
  @IsOptional()
  @IsString()
  model: string;

  @IsOptional()
  @IsBoolean()
  isMetric?: boolean;
}

export default UpdateInternetInfo;