import { Column, Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Order } from '../order/order.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity()
export class Client extends BaseEntity {
  @Column()
  fullName: string;

  @Column()
  phone: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  given: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  owed: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => Filial, (filial) => filial.clients)
  @JoinColumn({ name: 'filialId' })
  filial: Filial;

  @ManyToOne(() => User, (user) => user.clients)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Order, (order) => order.client)
  orders: Order[];
}
