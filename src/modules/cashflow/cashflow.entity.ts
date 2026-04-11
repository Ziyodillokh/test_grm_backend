import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Kassa } from '../kassa/kassa.entity';
import { User } from '../user/user.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashFlowEnum, CashflowStatusEnum } from '../../infra/shared/enum';
import { Order } from '../order/order.entity';
import { Filial } from '../filial/filial.entity';
import { Report } from '../report/report.entity';
import { Debt } from '../debt/debt.entity';
import { Factory } from '../factory/factory.entity';
import { Logistics } from '../logistics/logistics.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('cashflow')
export class Cashflow extends BaseEntity {
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  price: number;

  @Column('varchar', { default: CashFlowEnum.InCome })
  type: CashFlowEnum;

  @Column('varchar', { default: CashflowTipEnum.CASHFLOW })
  tip: CashflowTipEnum;

  @Column('varchar', { nullable: true })
  comment: string;

  @Column('varchar', { nullable: true })
  title: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column('boolean', { default: false })
  is_online: boolean;

  @Column({ default: false })
  is_cancelled: boolean;

  @Column({ default: false })
  is_static: boolean;

  @Column('varchar', { default: CashflowStatusEnum.PENDING, nullable: true })
  status: CashflowStatusEnum;

  @ManyToOne(() => CashflowType, (cashflow_type) => cashflow_type.cashflow, { onDelete: 'SET NULL' })
  @JoinColumn()
  cashflow_type: CashflowType;

  @ManyToOne(() => Kassa, (kassa) => kassa.cashflow, { onDelete: 'SET NULL' })
  @JoinColumn()
  kassa: Kassa;

  @ManyToOne(() => Filial, (filial) => filial.cashflow, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @ManyToOne(() => User, (user) => user.cashflow)
  @JoinColumn()
  createdBy: User;

  @ManyToOne(() => Order, (order) => order.cashflow, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  order: Order;

  @ManyToOne(() => Report, (report) => report.cashflow, { onDelete: 'SET NULL' })
  @JoinColumn()
  report: Report;

  @ManyToOne(() => Debt, (debt) => debt.cashflow, { onDelete: 'SET NULL' })
  @JoinColumn()
  debt: Debt;

  @ManyToOne(() => Factory, (factory) => factory.cashflows, { onDelete: 'SET NULL' })
  @JoinColumn()
  factory: Factory;

  @ManyToOne(() => Logistics, (logistics) => logistics.cashflows, { onDelete: 'SET NULL' })
  @JoinColumn()
  logistics: Logistics;

  @OneToMany(() => Cashflow, cashflow => cashflow.parent)
  child: Cashflow[];

  @ManyToOne(() => Cashflow, cashflow => cashflow.child, { onDelete: 'CASCADE' })
  @JoinColumn()
  parent: Cashflow;
}
