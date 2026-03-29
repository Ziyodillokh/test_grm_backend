import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductHistoryDto {
  @ApiProperty({ description: 'Description of the action performed on the product' })
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiPropertyOptional({ description: 'Author or user who performed the action' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({ description: 'ID of the product associated with this history' })
  @IsNotEmpty()
  @IsUUID('4')
  productId: string;
}
