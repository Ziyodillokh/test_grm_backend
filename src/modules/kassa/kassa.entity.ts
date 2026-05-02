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
  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ─── Oy va yil ─────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  year: number;

  @Column({ type: 'int', default: 0 })
  month: number;

  // ─── Sotuv aggregatlari (kassa darajasi: NO total prefix, Sum suffix mavjud joyda) ──
  @Column({ type: 'int', default: 0 })
  saleCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  saleSize: number;

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
  saleReturn: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  sizeReturn: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  additionalProfitSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  netProfitSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  discountSum: number;

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

  // ─── Pul oqimi (income/expense — Sum qo'shilmaydi) ────────
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
  cashCollection: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  inHand: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  openingBalance: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  planPrice: number;

  // ─── Qarz ma'lumotlari ─────────────────────────────────────
  @Column('int', { default: 0 })
  debtCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debtSize: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debtSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  debtProfitSum: number;

  // ─── Dealer-only ──────────────────────────────────────────
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  frozenOwed: number;

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
  isManagerRejected: boolean;

  @Column({ default: false })
  isAccountantRejected: boolean;

  @Column({ default: false })
  isCancelled: boolean;

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
}
