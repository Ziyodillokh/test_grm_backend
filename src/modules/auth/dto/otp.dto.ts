import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class OtpConfirmDto {
  @ApiProperty({ description: 'Phone number', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
