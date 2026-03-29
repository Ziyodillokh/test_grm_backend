import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTransferDto {
  @ApiProperty({ description: 'Title', example: 'Updated title', required: false })
  @IsOptional()
  @IsString()
  readonly title?: string;

  @ApiProperty({ description: 'Count', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  readonly count?: number;

  @ApiProperty({ description: 'Date', example: '2022-10-14', required: false })
  @IsOptional()
  @IsString()
  readonly date?: string;

  @ApiProperty({ description: 'From filial ID', example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  readonly from?: string;

  @ApiProperty({ description: 'To filial ID', example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  readonly to?: string;

  @ApiProperty({ description: 'Product ID', example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  readonly product?: string;

  @ApiProperty({ description: 'Transferer user ID', example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  readonly transferer?: string;
}
