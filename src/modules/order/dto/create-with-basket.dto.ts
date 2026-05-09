import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateWithBasketOrderDto {
  @ApiProperty({
    description: `price`,
    example: 1500,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly price: number;

  @ApiProperty({
    description: `Plastic Sum`,
    example: 500,
  })
  @IsNotEmpty()
  @IsNumber()
  readonly plasticSum: number;

  @ApiProperty({
    description: `comment`,
    example: 'Lorem Picsum....',
  })
  @IsOptional()
  @IsString()
  readonly comment: string;

  // ✅ Qo‘shildi: isDebt (qarzga sotildimi)
  @ApiProperty({
    description: `Is sold on credit (qarzga sotildimi)?`,
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly isDebt?: boolean;

  // ✅ Qo‘shildi: client (agar qarzga sotilsa — kimga)
  @ApiProperty({
    description: `Client ID (qarz kimga sotilgan)`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  readonly clientId?: string;

  @ApiProperty({
    description: `Qarz miqdori (qisman qarz holatida) — chek_total = price + plasticSum + debtAmount`,
    example: 12000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly debtAmount?: number;

  @ApiProperty({
    description: `O'tkazma orqali sotuv (bank transfer)`,
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly isTransfer?: boolean;

  @ApiProperty({
    description: `O'tkazma qoldig'i — child cashflow.price = ordersSum + transferRemainder`,
    example: 200,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  readonly transferRemainder?: number;
}

export default CreateWithBasketOrderDto;
