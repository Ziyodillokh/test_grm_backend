import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Model } from '../model/model.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { CollectionPrice } from '../collection-price/collection-price.entity';
import { CollectionReportItem } from '../collection-report-item/collection-report-item.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { Country } from '@modules/country/country.entity';
import { Factory } from '@modules/factory/factory.entity';

@Entity('collection')
export class Collection extends BaseEntity {
  @Column({ unique: true })
  title: string;

  @Column('text', {nullable: true})
  description: string;

  @Column('text', {nullable: true})
  paymentDeliveryInfo: string;

  @OneToMany(() => Model, (model) => model.collection, { onDelete: 'SET NULL' })
  model: Model[];

  @OneToMany(() => QrBase, (qrBase) => qrBase.collection, { onDelete: 'SET NULL' })
  qrBase: QrBase[];

  @OneToMany(() => CollectionPrice, (collectionPrice) => collectionPrice.collection, { onDelete: 'SET NULL' })
  collection_prices: CollectionPrice[];

  @OneToMany(() => CollectionReportItem, (collectionReportItem) => collectionReportItem.collection, { onDelete: 'SET NULL' })
  collectionReportItem: CollectionReportItem[];

  @ManyToOne(() => Country, (country) => country.collections, { onDelete: 'SET NULL' })
  @JoinColumn()
  country: Country;

  @ManyToOne(() => Factory, (factory) => factory.collections, { onDelete: 'SET NULL' })
  @JoinColumn()
  factory: Factory;
}
