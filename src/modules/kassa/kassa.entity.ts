import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Order } from '../order/order.entity';
import { Filial } from '../filial/filial.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { User } from '../user/user.entity';
import { KassaProgresEnum, FilialTypeEnum } from '../../infra/shared/enum';
import KassaReportProgresEnum from '../../infra/shared/enum/kassa-report-progres.enum';
import { Report } from '../report/report.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { IReportAggregates } from '../../common/interfaces/report-aggregates.interface';

@Entity('kassa')
export class Kassa extends BaseEntity implements IReportAggregates {
  // ─── Vaqt va holat ──────────────────────────────────────────
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ─── Oy va yil (KassaReport dan ko'chirildi) ───────────────
  @Column({ type: 'int', default: 0 })
  year: number;

  @Column({ type: 'int', default: 0 })
  month: number;

  // ─── Sotuv aggregatlari ─────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  totalSellCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSum: number;

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
  return_size: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  plasticSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  internetShopSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  sale: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  return_sale: number;

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
  totalSaleSizeReturn: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  cash_collection: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  discount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  income: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  expense: number;

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
  opening_balance: number;

  // ─── Qarz ma'lumotlari ─────────────────────────────────────
  @Column('int', { default: 0 })
  debt_count: number;

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
  debt_profit_sum: number;

  // ─── Dealer ma'lumotlari ───────────────────────────────────
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  dealer_frozen_owed: number;

  @Column('jsonb', { default: null, nullable: true })
  old_debt_info: Object;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  plan_price: number;

  // ─── Status va tasdiqlash ──────────────────────────────────
  @Column({ type: 'varchar', default: KassaProgresEnum.OPEN })
  status: KassaProgresEnum;

  @Column('varchar', { default: KassaReportProgresEnum.OPEN })
  confirmationStatus: string;

  @Column({ default: false })
  isAccountantConfirmed: boolean;

  @Column({ default: false })
  isMManagerConfirmed: boolean;

  @Column({ default: false })
  is_cancelled: boolean;

  @Column('varchar', { default: FilialTypeEnum.FILIAL })
  filialType: FilialTypeEnum;

  @Column({ default: 0 })
  kassaStatus: number;

  // ─── Relations ─────────────────────────────────────────────
  @ManyToOne(() => Filial, (filial) => filial.kassa, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @OneToMany(() => Order, (order) => order.kassa, { cascade: true })
  orders: Order[];

  @OneToMany(() => Cashflow, (cashflow) => cashflow.kassa)
  cashflow: Cashflow[];

  @ManyToOne(() => Report, (report) => report.kassas, { onDelete: 'SET NULL' })
  @JoinColumn()
  report: Report;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'SET NULL' })
  @JoinColumn()
  closer: User;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'SET NULL' })
  @JoinColumn()
  closer_m: User;
}
