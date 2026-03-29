import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class AcceptTransferDto {
  @ApiProperty({ description: 'From filial ID' })
  @IsUUID('4')
  from: string;

  @ApiProperty({ description: 'Include transfer IDs', required: false })
  @IsArray()
  @IsOptional()
  include?: string[];

  @ApiProperty({ description: 'Exclude transfer IDs', required: false })
  @IsArray()
  @IsOptional()
  exclude?: string[];

  @ApiProperty({ description: 'To filial ID' })
  @IsUUID('4')
  to: string;
}

export class ChangePriceDto {
  @ApiProperty({ description: 'Collection ID' })
  @IsUUID('4')
  collection: string;

  @ApiProperty({ description: 'New price' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Package transfer ID' })
  @IsUUID('4')
  package_id: string;
}
