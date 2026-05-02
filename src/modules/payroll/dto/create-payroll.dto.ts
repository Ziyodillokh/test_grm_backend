import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePayrollDto {
  @ApiProperty()
  @IsString()
  title: string;

  // @ApiProperty({ type: 'number', default: 0 })
  @IsOptional()
  @IsNumber()
  premium?: number;

  // @ApiProperty({ type: 'number', default: 0 })
  @IsOptional()
  @IsNumber()
  bonus?: number;

  // @ApiProperty({ type: 'number', default: 0 })
  @IsOptional()
  @IsNumber()
  plastic?: number;

  // @ApiProperty({ type: 'number', default: 0 })
  @IsOptional()
  @IsNumber()
  inHand?: number;

  @ApiProperty({ example: '1' })
  @IsInt()
  month: number;
}
