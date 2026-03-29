import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class CreateDebtDto {
  @ApiProperty({ description: 'Full name of the debtor' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Amount given', default: 0 })
  @IsNumber()
  @Min(0)
  given: number;

  @ApiProperty({ description: 'Amount owed', default: 0 })
  @IsNumber()
  @Min(0)
  owed: number;
}
