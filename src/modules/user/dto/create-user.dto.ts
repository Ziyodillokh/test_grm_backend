import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ description: 'Branch ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  readonly filial?: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  readonly firstName?: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  readonly lastName?: string;

  @ApiProperty({ description: 'Father name', example: 'Smith' })
  @IsOptional()
  @IsString()
  readonly fatherName?: string;

  @ApiProperty({ description: 'Hire date', example: '2024-01-15', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly hired?: Date;

  @ApiProperty({ description: 'Position ID', example: 'uuid' })
  @IsOptional()
  @IsString()
  readonly position?: string;

  @ApiProperty({ description: 'Work start time (HH:mm)', example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'from must be in HH:mm format' })
  from?: string;

  @ApiProperty({ description: 'Work end time (HH:mm)', example: '17:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'to must be in HH:mm format' })
  to?: string;

  @ApiProperty({ description: 'Phone number', example: '+998901234567' })
  @IsOptional()
  @IsString()
  readonly phone?: string;

  @ApiProperty({ description: 'Login identifier', example: '#123456' })
  @IsOptional()
  @IsString()
  readonly login?: string;

  @ApiProperty({ description: 'Monthly salary', example: 5000000 })
  @IsOptional()
  @IsNumber()
  readonly salary?: number;

  @ApiProperty({ description: 'Avatar media ID', example: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  readonly avatar?: string;
}
