import { OrderEnum } from 'src/infra/shared/enum';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { Kassa } from '../kassa/kassa.entity';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { QrBase } from '../qr-base/qr-base.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { QrCode } from '../qr-code/qr-code.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { CollectionReportItem } from '../collection-report-item/collection-report-item.entity';
import { Client } from '../client/client.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';

@Entity('order')
export class Order extends BaseEntity {
  @Column({ type: 'varchar', default: OrderEnum.Progress })
  status: OrderEnum;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  price: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  x: number;

  @Column('numeric', {
    precision: 20,
    scale: 3,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  kv: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

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
  managerDiscountSum: number;

  @Column({ type: 'decimal', nullable: true, default: 0 })
  discountPercentage: number;

  @Column({ default: 'order' })
  tip: string;

  @Column({ type: 'boolean', default: false })
  isDebt: boolean;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  plasticSum: number;

  @ManyToOne(() => User, (user) => user.sellerOrders)
  @JoinColumn()
  seller: User;

  @ManyToOne(() => User, (user) => user.createdByOrders)
  @JoinColumn()
  createdBy: User;

  @ManyToOne(() => Kassa, (kassa) => kassa.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  kassa: Kassa;

  @ManyToOne(() => Product, (product) => product.orders, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  product: Product;

  @ManyToOne(() => QrBase, (bar_code) => bar_code.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  bar_code: QrBase;

  @OneToMany(() => Cashflow, (cashflow) => cashflow.order, { onDelete: 'SET NULL', nullable: true })
  cashflow: Cashflow[];

  @OneToOne(() => QrCode, (qr_code) => qr_code.product)
  @JoinColumn()
  qr_code: QrCode;

  @ManyToOne(() => SellerReport, (sellerReport) => sellerReport.orders, { onDelete: 'SET NULL' })
  @JoinColumn()
  report: SellerReport;

  @ManyToOne(() => SellerReportItem, (sellerReportItem) => sellerReportItem.orders, { onDelete: 'SET NULL' })
  @JoinColumn()
  report_item: SellerReportItem;

  @ManyToOne(() => CollectionReportItem, (collectionReportItem) => collectionReportItem.orders, { onDelete: 'SET NULL' })
  @JoinColumn()
  collectionReportItem: CollectionReportItem;

  @ManyToOne(() => FactoryReportItem, (factoryReportItem) => factoryReportItem.orders, { onDelete: 'SET NULL' })
  @JoinColumn()
  factoryReportItem: FactoryReportItem;

  @ManyToOne(() => CountryReportItem, (countryReportItem) => countryReportItem.orders, { onDelete: 'SET NULL' })
  @JoinColumn()
  countryReportItem: CountryReportItem;

  @ManyToOne(() => Client, (client) => client.orders, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  client: Client;
}
