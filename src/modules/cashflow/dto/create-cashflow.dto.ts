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
    example: 'shop_expense',
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
    description: `street (Ko'cha) id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  streetId?: string;

  @ApiProperty({
    description: `client (Mijoz yoki Qarzdor) id — slug='debt' uchun`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiProperty({
    description: `street percent (foiz) — only for slug='street' income`,
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  streetPercent?: number;

  @ApiProperty({
    description: `factory id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  factoryId?: string;

  @ApiProperty({
    description: `logistics id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  logisticsId?: string;

  @ApiProperty({
    description: `customs id`,
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  customsId?: string;

  @ApiProperty({
    description: `share id (sherik) — only for cashflow_type slug='share'`,
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  shareId?: string;

  @ApiProperty({
    description: `share kind: capital (tani) or profit (foyda) — only for share expense`,
    example: 'capital',
    required: false,
  })
  @IsOptional()
  @IsString()
  shareKind?: 'capital' | 'profit';

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
