import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CashFlowEnum } from '../../../infra/shared/enum';
import CashflowTipEnum from '../../../infra/shared/enum/cashflow/cashflow-tip.enum';

class CreateCashflowDto {
  @ApiProperty({
    description: `price`,
    example: '1600',
  })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({
    description: `type`,
    example: CashFlowEnum.InCome,
  })
  @IsNotEmpty()
  @IsString()
  readonly type: CashFlowEnum;

  @ApiProperty({
    description: `comment`,
    example: 'for lunch',
  })
  @IsOptional()
  @IsString()
  readonly comment: string;

  @ApiProperty({
    description: `title`,
    example: 'Магазин Расход',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: `kassa id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  readonly kassa: string;

  @ApiProperty({
    description: `user id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  readonly createdBy: string;

  @ApiProperty({
    description: `debt id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  debtId?: string;

  @ApiProperty({
    description: `factory id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  factoryId?: string;

  @ApiProperty({
    description: `cashflow_type id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  readonly cashflow_type: string;

  @ApiProperty({
    description: `report id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  readonly report: string;

  @ApiProperty({
    description: `cashflow tip`,
    example: CashflowTipEnum.CASHFLOW,
  })
  @IsOptional()
  @IsEnum(CashflowTipEnum)
  readonly tip: CashflowTipEnum;

  @ApiProperty({
    description: `date`,
    example: '2026-04-10T12:00:00',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: `is online`,
    example: false,
    type: 'boolean',
  })
  @IsOptional()
  is_online?: boolean = false;

  order: string;
}

export default CreateCashflowDto;
