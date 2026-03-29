import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { User } from '../user/user.entity';
import { Order } from '../order/order.entity';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('seller_report')
export class SellerReport extends BaseEntity {
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

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
  additionalProfitTotalSum: number;

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
  totalSaleReturnCount: number;

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
  totalSaleReturnKv: number;

  @ManyToOne(() => User, (user) => user.reports)
  @JoinColumn()
  user: User;

  @OneToMany(() => Order, (order) => order.report)
  orders: Order[];

  @OneToMany(() => SellerReportItem, (report_item) => report_item.report)
  reportItems: SellerReportItem[];
}
