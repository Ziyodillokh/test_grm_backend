import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreatePayrollItemDto {
  // @ApiProperty()
  // @IsString()
  // title: string;

  // @ApiProperty()
  @IsOptional()
  @IsNumber()
  total: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  selectedMonth: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  plastic: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  in_hand: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  prepayment: number;

  @ApiProperty({ example: 'UUID' })
  @IsOptional()
  @IsUUID('4')
  payrollId: string;

  @ApiProperty({ example: 'UUID' })
  @IsOptional()
  @IsUUID('4')
  userId: string;

  @ApiProperty({ example: 'UUID' })
  @IsOptional()
  @IsUUID('4')
  awardId: string;

  @ApiProperty({ example: 'UUID' })
  @IsOptional()
  @IsUUID('4')
  bonusId: string;

  @ApiProperty({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  is_premium?: boolean;

  @ApiProperty({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  is_bonus?: boolean;

  // @ApiProperty()
  @IsOptional()
  @IsNumber()
  salary: number;

  @IsOptional()
  @IsInt()
  year: number;
}

export default CreatePayrollItemDto;
