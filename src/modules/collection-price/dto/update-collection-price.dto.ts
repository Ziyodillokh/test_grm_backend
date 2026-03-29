import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

class UpdateCollectionPriceDto {
  @ApiProperty({ example: 100.5, required: false })
  @IsNumber()
  @IsOptional()
  secondPrice?: number;

  @ApiProperty({ example: 200.75, required: false })
  @IsNumber()
  @IsOptional()
  priceMeter?: number;

  @ApiProperty({ example: 150.3, required: false })
  @IsNumber()
  @IsOptional()
  comingPrice?: number;
}

export default UpdateCollectionPriceDto;

export class SetDiscountDto {
  @ApiProperty({ type: Boolean, description: 'Add or remove discount', required: true })
  @IsBoolean()
  isAdd: boolean;
}
