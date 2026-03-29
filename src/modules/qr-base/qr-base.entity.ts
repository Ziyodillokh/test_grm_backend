import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NumericTransformer } from '../../common/database/transformers/numeric.transformer';
import { ProductStatus } from '../../common/enums/product-status.enum';

// Relation imports
import { Collection } from '../collection/collection.entity';
import { Color } from '../color/color.entity';
import { Model } from '../model/model.entity';
import { Size } from '../size/size.entity';
import { Shape } from '../shape/shape.entity';
import { Style } from '../style/style.entity';
import { Country } from '../country/country.entity';
import { Factory } from '../factory/factory.entity';
import { Media } from '../media/media.entity';
import { Product } from '../product/product.entity';
import { Order } from '../order/order.entity';
import { ClientOrderItem } from '../client-order-item/client-order-item.entity';
import { QrCode } from '../qr-code/qr-code.entity';
import { ReInventory } from '../re-inventory/re-inventory.entity';
import { ProductExcel } from '../excel/excel-product.entity';
import { Transfer } from '../transfer/transfer.entity';

@Entity('qrbase')
export class QrBase extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('jsonb', { nullable: true })
  otherImgs: string[];

  @Column({ nullable: true, type: 'text' })
  internetInfo: string;

  @Column({ type: 'boolean', default: false })
  isMetric: boolean;

  /** @deprecated Use status field instead (PUBLISHED = active + accepted) */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** @deprecated Use status field instead (PUBLISHED = active + accepted) */
  @Column({ type: 'boolean', default: false })
  is_accepted: boolean;

  @Column('varchar', { default: ProductStatus.NOT_READY })
  status: ProductStatus;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  i_price: number;

  @Column('varchar', { nullable: true })
  sizeType: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  // --- Relations ---

  @ManyToOne(() => Collection, (collection) => collection.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  collection: Collection;

  @ManyToOne(() => Color, (color) => color.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  color: Color;

  @ManyToOne(() => Model, (model) => model.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  model: Model;

  @ManyToOne(() => Size, (size) => size.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  size: Size;

  @ManyToOne(() => Shape, (shape) => shape.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  shape: Shape;

  @ManyToOne(() => Style, (style) => style.qrBase, { onDelete: 'SET NULL' })
  @JoinColumn()
  style: Style;

  @ManyToOne(() => Country, (country) => country.qrBase)
  @JoinColumn()
  country: Country;

  @ManyToOne(() => Factory, (factory) => factory.qrBases)
  @JoinColumn()
  factory: Factory;

  @ManyToOne(() => Media, (media) => media.qr_bases)
  @JoinColumn()
  imgUrl: Media;

  @OneToMany(() => Media, (media) => media.i_image)
  other_images: Media[];

  @OneToMany(() => Product, (product) => product.bar_code)
  products: Product[];

  @OneToMany(() => Order, (order) => order.bar_code)
  orders: Order[];

  @OneToMany(() => ClientOrderItem, (item) => item.product)
  client_order_items: ClientOrderItem[];

  @OneToMany(() => QrCode, (qrCode) => qrCode.qr_base)
  qr_code: QrCode[];

  @OneToMany(() => ReInventory, (ri) => ri.bar_code)
  re_inventory: ReInventory[];

  @OneToMany(() => ProductExcel, (pe) => pe.bar_code)
  productsExcel: ProductExcel[];

  @OneToMany(() => Transfer, (transfer) => transfer.bar_code)
  transfers: Transfer[];
}
