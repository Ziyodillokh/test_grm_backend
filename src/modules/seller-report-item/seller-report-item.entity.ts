import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { User } from '../user/user.entity';
import { Order } from '../order/order.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('seller-report-item')
export class SellerReportItem extends BaseEntity {
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @Column({ type: 'int', default: 0 })
  totalSellCount: number;

  @Column('numeric', {
    default: 0,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalSellKv: number;

  @Column('numeric', {
    default: 0,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalSellPrice: number;

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
  totalPlasticSum: number;

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
  totalSaleReturnPrice: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSaleReturnCount: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSaleReturnKv: number;

  @Column({ type: 'int', default: 0 })
  workTime: number;

  @ManyToOne(() => User, (user) => user.reports)
  @JoinColumn()
  user: User;

  @OneToMany(() => Order, (order) => order.report_item)
  orders: Order[];

  @ManyToOne(() => SellerReport, (sellerReport) => sellerReport.reportItems, { onDelete: 'SET NULL' })
  @JoinColumn()
  report: SellerReport;
}
