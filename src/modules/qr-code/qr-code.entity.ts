import {
  Column,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { Product } from '../product/product.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { Order } from '../order/order.entity';
import { OrderBasket } from '../order-basket/order-basket.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('qr_code')
export class QrCode extends BaseEntity {
  @Column()
  @Generated('increment')
  sequence: number; // auto-incremented, unique field

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('boolean', { default: false })
  is_connected: boolean;

  @ManyToOne(() => QrBase, (qrbase) => qrbase.qr_code, { nullable: true })
  @JoinColumn()
  qr_base: QrBase;

  @ManyToOne(() => Product, (product) => product.qr_code, { nullable: true })
  @JoinColumn()
  product: Product;

  @OneToOne(() => Order, (order) => order.qr_code, { onDelete: 'SET NULL' })
  @JoinColumn()
  order: Order;

  @OneToOne(() => OrderBasket, (order_basket) => order_basket.qr_code)
  @JoinColumn()
  order_basket: OrderBasket;
}
