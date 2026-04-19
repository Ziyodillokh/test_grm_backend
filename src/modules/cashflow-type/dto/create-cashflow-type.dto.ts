import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Position } from '../../position/position.entity';
import CashflowTypeEnum from '../../../infra/shared/enum/cashflow/cashflow-type.enum';

class CreateCashflowTypeDto {
  @ApiProperty({ example: 'Income', description: 'Title of the cashflow type' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'debt', description: 'Slug for the cashflow type' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    example: 'UUID',
    description: 'SVG icon media id',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  icon?: string;

  @ApiProperty({
    example: '[{"id": "UUID"}, {"id": "UUID"}]',
    description: 'Position id',
    required: true,
  })
  @IsNotEmpty()
  @IsArray()
  positions?: Position[];

  @ApiProperty({
    example: CashflowTypeEnum.INCOME,
    description: 'Position id',
    required: true,
    enum: CashflowTypeEnum,
  })
  @IsNotEmpty()
  @IsEnum(CashflowTypeEnum)
  type: CashflowTypeEnum;
}

export default CreateCashflowTypeDto;
