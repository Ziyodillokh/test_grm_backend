import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
    description: `price`,
    example: '1600',
  })
  @IsNotEmpty()
  @IsUUID('4')
  readonly kassa_report: string;

  @ApiProperty({
    description: `comment`,
    example: 'Lorem Picsum...',
  })
  @IsOptional()
  @IsString()
  readonly comment: string;
}