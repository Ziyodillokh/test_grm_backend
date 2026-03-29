import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFactoryReportItemDto {
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
  totalSellCount?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSellKv?: number = 0;

  @IsNumber()
  @IsOptional()
  totalSellPrice?: number = 0;

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
