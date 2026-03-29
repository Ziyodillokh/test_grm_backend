import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransferStatus } from '../../../common/enums';

export class CreateTransferBasketDto {
  @ApiProperty({ description: 'From filial ID', example: 'uuid' })
  @IsNotEmpty()
  @IsString()
  readonly from: string;

  @ApiProperty({ description: 'To filial ID', example: 'uuid' })
  @IsNotEmpty()
  @IsString()
  readonly to: string;

  @ApiProperty({ description: 'Courier user ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  courier: string;

  progres?: TransferStatus;
}
