import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQrLogoDto {
  @ApiProperty({ description: 'URL link for QR code', example: 'https://gilam-market.uz' })
  @IsNotEmpty()
  @IsString()
  link: string;

  @ApiProperty({ description: 'Optional description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
