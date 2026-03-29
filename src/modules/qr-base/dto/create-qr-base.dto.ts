import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQrBaseDto {
  @ApiProperty({ description: 'QR code', example: '123456789' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: 'Country ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  country: string;

  @ApiProperty({ description: 'Collection ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  collection: string;

  @ApiProperty({ description: 'Size ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  size: string;

  @ApiProperty({ description: 'Shape ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  shape: string;

  @ApiProperty({ description: 'Factory ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  factory: string;

  @ApiProperty({ description: 'Style ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  style: string;

  @ApiProperty({ description: 'Color ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  color: string;

  @ApiProperty({ description: 'Model ID', example: 'uuid' })
  @IsNotEmpty()
  @IsUUID('4')
  model: string;

  @ApiPropertyOptional({ description: 'Is metric' })
  @IsOptional()
  @IsBoolean()
  isMetric?: boolean;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  imgUrl?: string;
  videoUrl?: string;

  @IsOptional()
  @IsNumber()
  count?: number;
}

export default CreateQrBaseDto;
