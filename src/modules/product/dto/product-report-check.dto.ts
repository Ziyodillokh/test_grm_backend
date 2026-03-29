import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ProductReportEnum } from '../../../infra/shared/enum';
import { ApiProperty } from '@nestjs/swagger';

class ProductReportCheckDto {
  @ApiProperty({
    description: `filial id`,
    example: 'UUID',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  filialId: string;

  @ApiProperty({
    description: `tip`,
    example: ProductReportEnum.INVENTORY,
    required: false,
    enum: ProductReportEnum,
  })
  @IsOptional()
  @IsEnum(ProductReportEnum)
  tip: ProductReportEnum;
}

export default ProductReportCheckDto;