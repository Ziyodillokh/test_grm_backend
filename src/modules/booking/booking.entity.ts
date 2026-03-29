import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('booking')
export class Booking extends BaseEntity {
  @Column('int')
  count: number;

  @ManyToOne(() => Product, (pr) => pr.bookings)
  @JoinColumn()
  product: Product;

  @ManyToOne(() => User, (ur) => ur.bookings)
  @JoinColumn()
  user: User;
}
