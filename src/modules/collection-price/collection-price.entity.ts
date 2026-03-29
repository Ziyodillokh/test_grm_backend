import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { Collection } from '../collection/collection.entity';
import { Product } from '../product/product.entity';
import { Filial } from '../filial/filial.entity';
import { CollectionPriceEnum } from '../../infra/shared/enum';
import { Discount } from '../discount/discount.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('collection_price')
export class CollectionPrice extends BaseEntity {
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  secondPrice: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  priceMeter: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  comingPrice: number;

  @Column('varchar', { default: CollectionPriceEnum.filial })
  type: CollectionPriceEnum;

  @ManyToOne(() => Collection, (collection) => collection.collection_prices, {onDelete: 'CASCADE'})
  @JoinColumn()
  collection: Collection;

  @OneToMany(() => Product, (product) => product.collection_price)
  products: Product[];

  @OneToOne(() => Filial, (filial) => filial.id, {onDelete: 'SET NULL'})
  dealer: Filial;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @ManyToMany(() => Discount, (discount) => discount.collectionPrices, {onDelete: 'SET NULL'})
  @JoinTable()
  discounts: Discount[];
}
