import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { PackageTransfer } from '../package-transfer/package-transfer.entity';
import { Collection } from '../collection/collection.entity';

/**
 * Per-package per-collection dealer pricing (BUG F).
 *
 * Each accepted package is a discount sale to a dealer. Within the package,
 * products are grouped by collection and each collection gets its own
 * `dealerPriceMeter` — a sale price that is lower than the retail
 * `priceMeter` of the source filial. The difference becomes the package's
 * total_discount; the dealer still owes the sum at `dealerPriceMeter`.
 */
@Entity('package-collection-price')
@Index('uniq_package_collection', ['package', 'collection'], { unique: true })
export class PackageCollectionPrice extends BaseEntity {
  @ManyToOne(() => PackageTransfer, (pt) => pt.collection_prices, { onDelete: 'CASCADE' })
  @JoinColumn()
  package: PackageTransfer;

  @ManyToOne(() => Collection, { onDelete: 'CASCADE' })
  @JoinColumn()
  collection: Collection;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  dealerPriceMeter: number;
}
