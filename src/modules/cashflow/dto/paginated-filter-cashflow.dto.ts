// dto/paginated-filter-cashflow.dto.ts
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CashFlowEnum } from '../../../infra/shared/enum';
import CashflowTipEnum from '../../../infra/shared/enum/cashflow/cashflow-tip.enum';

export class PaginatedFilterCashflowDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ enum: CashFlowEnum })
  @IsEnum(CashFlowEnum)
  @IsOptional()
  type?: CashFlowEnum;

  @ApiPropertyOptional({ enum: CashflowTipEnum })
  @IsOptional()
  tip?: CashflowTipEnum | string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  filialId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  kassaId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  createdById?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_online?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cashflowSlug?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  kassaReport?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  report?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  debt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  month?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  cashflowTypeId?: string;

  @ApiPropertyOptional({ description: 'Cashflow.report.month bo\'yicha filter' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  reportMonth?: number;

  @ApiPropertyOptional({ description: 'Cashflow.report.year bo\'yicha filter' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  reportYear?: number;

  @ApiPropertyOptional({ description: 'Cashflow yaratuvchi user.position.role bo\'yicha filter' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  createdByRole?: number;
}
