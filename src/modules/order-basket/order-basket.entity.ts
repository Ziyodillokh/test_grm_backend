import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { Product } from '../product/product.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { User } from '../user/user.entity';
import { QrCode } from '../qr-code/qr-code.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('order_basket')
export class OrderBasket extends BaseEntity {
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  x: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @Column({ type: 'int', default: 0 })
  order_index: number;

  @Column('boolean', { default: false })
  is_transfer: boolean;

  @Column('boolean', { default: false })
  isMetric: boolean;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn()
  seller: User;

  @ManyToOne(() => Product, (prod) => prod.id)
  @JoinColumn()
  product: Product;

  @OneToOne(() => QrCode, (qr_code) => qr_code.order_basket)
  @JoinColumn()
  qr_code: QrCode;
}
