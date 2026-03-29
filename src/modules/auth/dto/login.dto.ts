import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'User login', example: 'admin' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ description: 'User password', example: 'secret' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
