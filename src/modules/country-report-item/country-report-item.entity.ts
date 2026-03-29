import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Filial } from '../filial/filial.entity';
import { Order } from '../order/order.entity';
import { Country } from '../country/country.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('country_report_item')
export class CountryReportItem extends BaseEntity {
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int', nullable: true })
  day: number;

  @Column({ type: 'date', nullable: true })
  date: Date;

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

  @Column({ type: 'int', default: 0 })
  totalCount: number;

  @Column('numeric', {
    default: 0,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalKv: number;

  @Column('numeric', {
    default: 0,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalPrice: number;

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

  @OneToMany(() => Order, (order) => order.countryReportItem)
  orders: Order[];

  @ManyToOne(() => Filial, (filial) => filial.countryReportItem, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @ManyToOne(() => Country, (country) => country.countryReportItem, { onDelete: 'SET NULL' })
  @JoinColumn()
  country: Country;

  @Column('text', { array: true, nullable: true })
  filialIds: string[];
}
