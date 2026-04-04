import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Kassa } from '../kassa/kassa.entity';
import ReportProgresEnum from 'src/infra/shared/enum/report-progres.enum';
import { BossReport } from '../boss-report/boss-report.entity';
import { FilialTypeEnum } from 'src/infra/shared/enum';
import { Filial } from '../filial/filial.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { IReportAggregates } from '../../common/interfaces/report-aggregates.interface';

@Entity('report')
export class Report extends BaseEntity implements IReportAggregates {
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int', default: 0 })
  totalSellCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  additionalProfitTotalSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  in_hand: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  netProfitTotalSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSize: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalPlasticSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalInternetShopSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSale: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSaleReturn: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalCashCollection: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDiscount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalIncome: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalExpense: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  managerSum: number;
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
    name: 'accauntantSum',
  })
  accountantSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  managerSaldo: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  accountantSaldo: number;

  @Column('int', {default: 0})
  debt_count: number

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debt_kv: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debt_sum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  dealer_frozen_owed: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debt_profit_sum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  dealer_plan: number;

  @Column({ default: false })
  is_cancelled: boolean;

  @Column({ default: false })
  isAccountantConfirmed: boolean;

  @Column({ default: false })
  isMManagerConfirmed: boolean;

  @Column('varchar', { default: ReportProgresEnum.OPEN })
  status: ReportProgresEnum;

  @Column('varchar', { default: FilialTypeEnum.FILIAL })
  filialType: FilialTypeEnum;

  @OneToMany(() => Kassa, (kassa) => kassa.report)
  kassas: Kassa[];

  @ManyToOne(() => BossReport, (bossReport) => bossReport.report, { onDelete: 'SET NULL' })
  @JoinColumn()
  bossReport: BossReport;

  @OneToMany(() => Cashflow, (cashflow) => cashflow.report)
  cashflow: Cashflow[];

  @ManyToOne(() => Filial, (filial) => filial.report, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @Column('int', { default: 0 })
  reportStatus: number;
}
