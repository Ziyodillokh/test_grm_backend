import { Column, Entity, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { Report } from '../report/report.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { IReportAggregates } from '../../common/interfaces/report-aggregates.interface';

@Entity('boss_report')
export class BossReport extends BaseEntity implements IReportAggregates {
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int', default: new Date().getMonth() + 1 })
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
  totalSum: number;

  @OneToMany(() => Report, (report) => report.bossReport)
  report: Report[];

  @Column('int', { default: 1 })
  status: number;
}
