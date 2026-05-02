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

  // ─── Sotuv aggregatlari (report darajasi: total prefix + Sum suffix) ──
  @Column({ type: 'int', default: 0 })
  totalSaleCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSaleSize: number;

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
  totalSizeReturn: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalAdditionalProfitSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalNetProfitSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDiscountSum: number;

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

  // ─── Pul oqimi (income/expense — Sum qo'shilmaydi) ────────
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
  totalCashCollection: number;

  // ─── Manager va accountant hisob-kitobi ─────────────────────
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

  // ─── Qarz aggregatlari ─────────────────────────────────────
  @Column('int', { default: 0 })
  totalDebtCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDebtSize: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDebtSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDebtProfitSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalFrozenOwed: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  dealerPlan: number;

  // ─── Status va workflow ────────────────────────────────────
  @Column({ default: false })
  isCancelled: boolean;

  @Column({ default: false })
  isAccountantConfirmed: boolean;

  @Column({ default: false })
  isMManagerConfirmed: boolean;

  @Column('varchar', { default: ReportProgresEnum.OPEN })
  status: ReportProgresEnum;

  @Column('int', { default: 0 })
  reportStatus: number;

  @Column('varchar', { default: FilialTypeEnum.FILIAL })
  filialType: FilialTypeEnum;

  // ─── Relations ─────────────────────────────────────────────
  @OneToMany(() => Kassa, (kassa) => kassa.report)
  kassas: Kassa[];

  @OneToMany(() => Cashflow, (cashflow) => cashflow.report)
  cashflow: Cashflow[];

  @ManyToOne(() => Filial, (filial) => filial.report, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;
}
