import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCollectionReportItemDto {
  @IsString()
  date: string;

  @IsString()
  @IsUUID('4')
  filialId: string;

  @IsString()
  @IsUUID('4')
  collectionId: string;

  @IsNumber()
  @IsOptional()
  totalCount?: number = 0;

  @IsNumber()
  @IsOptional()
  totalKv?: number = 0;

  @IsNumber()
  @IsOptional()
  totalPrice?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSaleCount?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSaleSize?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSalePrice?: number = 0;

  @IsNumber()
  @IsOptional()
  totalPlasticSum?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSaleReturnPrice?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSaleReturnCount?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSaleReturnKv?: number = 0;
}
