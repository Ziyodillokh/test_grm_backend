import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateShareDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'foyda chiqim totalDebt\'ga tegishimi (default true)' })
  @IsOptional()
  @IsBoolean()
  isProfitDebt?: boolean;
}
