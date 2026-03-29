import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NumericTransformer } from '../../common/database/transformers/numeric.transformer';

// Relation imports
import { QrBase } from '../qr-base/qr-base.entity';
import { Filial } from '../filial/filial.entity';
import { CollectionPrice } from '../collection-price/collection-price.entity';
import { Partiya } from '../partiya/partiya.entity';
import { User } from '../user/user.entity';
import { Order } from '../order/order.entity';
import { Transfer } from '../transfer/transfer.entity';
import { ProductHistory } from '../product-history/product-history.entity';
import { Booking } from '../booking/booking.entity';
import { TransferCache } from '../transfer-cache/transfer-cache.entity';
import { QrCode } from '../qr-code/qr-code.entity';
import { ReInventory } from '../re-inventory/re-inventory.entity';

@Entity('product')
export class Product extends BaseEntity {
  @Column({ nullable: true })
  code: string;

  @Column('int')
  count: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  booking_count: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  price: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  secondPrice: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  priceMeter: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  comingPrice: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  draft_priceMeter: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  draft_comingPrice: number;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  x: number;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  y: number;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  totalSize: number;

  @Column({ type: 'boolean', default: false })
  isInternetShop: boolean;

  @Column('int', { default: 0 })
  check_count: number;

  /**
   * Stock availability flag: set to true when stock depletes (y < 0.2 or count < 1),
   * set back to false when stock is restored (reject/return).
   * NOTE: This is NOT a pure soft-delete field -- it is toggled on/off based on stock levels.
   * True soft-delete is handled by BaseEntity.deletedDate (TypeORM @DeleteDateColumn).
   * Removing this field would break ~20+ raw SQL queries that filter on is_deleted.
   */
  @Column('boolean', { default: false })
  is_deleted: boolean;

  @Column('varchar', { nullable: true })
  partiya_title: string;

  // --- Relations ---

  @ManyToOne(() => QrBase, (qrBase) => qrBase.products, { onDelete: 'SET NULL' })
  @JoinColumn()
  bar_code: QrBase;

  @ManyToOne(() => Filial, (filial) => filial.products)
  @JoinColumn()
  filial: Filial;

  @ManyToOne(() => CollectionPrice, (cp) => cp.products)
  @JoinColumn()
  collection_price: CollectionPrice;

  @ManyToOne(() => Partiya, (partiya) => partiya.products, { onDelete: 'SET NULL' })
  @JoinColumn()
  partiya: Partiya;

  @ManyToMany(() => User, (user) => user.favoriteProducts)
  favoriteUsers: User[];

  @OneToMany(() => Order, (order) => order.product)
  orders: Order[];

  @OneToMany(() => Transfer, (transfer) => transfer.product)
  transfers: Transfer[];

  @OneToMany(() => ProductHistory, (history) => history.product)
  histories: ProductHistory[];

  @OneToMany(() => Booking, (booking) => booking.product)
  bookings: Booking[];

  @OneToMany(() => TransferCache, (tc) => tc.product)
  transfer_cache: TransferCache[];

  @OneToMany(() => QrCode, (qrCode) => qrCode.product)
  qr_code: QrCode[];

  @OneToMany(() => ReInventory, (ri) => ri.product)
  re_inventory: ReInventory[];
}
