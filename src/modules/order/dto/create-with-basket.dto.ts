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
}

export default CreateWithBasketOrderDto;
