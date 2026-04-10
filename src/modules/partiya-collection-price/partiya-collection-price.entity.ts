import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/database/base.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { Partiya } from '../partiya/partiya.entity';
import { Collection } from '../collection/collection.entity';

@Entity('partiya-collection-price')
@Index('uniq_partiya_collection', ['partiya', 'collection'], { unique: true })
export class PartiyaCollectionPrice extends BaseEntity {
  @ManyToOne(() => Partiya, (p) => p.collection_prices, { onDelete: 'CASCADE' })
  @JoinColumn()
  partiya: Partiya;

  @ManyToOne(() => Collection, { onDelete: 'CASCADE' })
  @JoinColumn()
  collection: Collection;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  factoryPricePerKv: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  overheadPerKv: number;
}
