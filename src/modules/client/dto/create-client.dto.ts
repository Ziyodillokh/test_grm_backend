import { IsString, IsOptional, IsPhoneNumber, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ example: 'UUID' })
  @IsUUID('4')
  filialId: string;

  @ApiProperty({ example: 'UUID' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDebtor?: boolean;
}
