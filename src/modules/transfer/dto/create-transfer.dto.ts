import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransferStatus } from '../../../common/enums';

export class CreateTransferDto {
  @ApiProperty({ description: 'Title', example: 'Transfer title' })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({ description: 'Count', example: 2 })
  @IsNotEmpty()
  @IsNumber()
  readonly count: number;

  @ApiProperty({ description: 'From filial ID', example: 'uuid' })
  @IsNotEmpty()
  @IsString()
  readonly from: string;

  @ApiProperty({ description: 'To filial ID', example: 'uuid' })
  @IsNotEmpty()
  @IsString()
  readonly to: string;

  @ApiProperty({ description: 'Product ID', example: 'uuid' })
  @IsNotEmpty()
  @IsString()
  readonly product: string;

  @ApiProperty({ description: 'Courier user ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  courier: string;

  progres?: TransferStatus;
}
