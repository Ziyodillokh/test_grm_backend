import { Column, Entity, ManyToMany } from 'typeorm';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { CollectionPrice } from '../collection-price/collection-price.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('discount')
export class Discount extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  title: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  discountPercentage: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  discountSum: number;

  @Column({ type: 'boolean', default: false })
  isAdd: boolean;

  @ManyToMany(() => CollectionPrice, (price) => price.discounts)
  collectionPrices: CollectionPrice[];
}
