import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('transfer_cache')
export class TransferCache extends BaseEntity {
  @Column('int')
  count: number;

  @ManyToOne(() => Product, (pr) => pr.transfer_cache)
  @JoinColumn()
  product: Product;

  @ManyToOne(() => User, (ur) => ur.bookings)
  @JoinColumn()
  user: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: string;
}
