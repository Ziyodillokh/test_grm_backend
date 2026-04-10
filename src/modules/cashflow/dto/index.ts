import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export { default as CreateCashflowDto } from './create-cashflow.dto';
export { default as UpdateCashflowDto } from './update-cashflow.dto';


export class createDealerCashflowDto {
  @ApiProperty({
    description: `price`,
    example: '1600',
  })
  @IsNotEmpty()
  @IsNumber()
  readonly price: number;

  @ApiProperty({
    description: `boolean`,
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  readonly is_online: boolean;

  @ApiProperty({
    description: `kassa id`,
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly kassa: string;

  @ApiProperty({
    description: `comment`,
    example: 'Lorem Picsum...',
  })
  @IsOptional()
  @IsString()
  readonly comment: string;

  @ApiProperty({
    description: `date`,
    example: '2026-04-10T12:00:00',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}