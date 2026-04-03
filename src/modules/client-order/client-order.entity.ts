import {
  Column,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NumericTransformer } from '../../common/database/transformers/numeric.transformer';
import { ClientOrderStatus } from '../../common/enums';

export enum PaymentTypeEnum {
  IN_HAND = 'IN_HAND',
  PAYME = 'PAYME',
}

export enum OrderStatusEnum {
  NEW = 'NEW',
  IN_PROCESS = 'IN_PROCESS',
  CANCELLED = 'CANCELLED',
  DONE = 'DONE',
}

@Entity('client_order')
export class ClientOrder extends BaseEntity {
  @Column()
  @Generated('increment')
  sequence: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  totalPrice: number;

  @Column('varchar', { default: PaymentTypeEnum.IN_HAND })
  payment_type: PaymentTypeEnum;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  pre_payment: number;

  @Column('varchar', { default: ClientOrderStatus.UN_PAYED })
  payment_status: ClientOrderStatus;

  @Column('varchar', { default: OrderStatusEnum.NEW })
  order_status: OrderStatusEnum;

  @Column({ type: 'boolean', default: false })
  delivery: boolean;

  @Column('numeric', {
    precision: 7,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  deliverySum: number;

  @Column({ type: 'text', nullable: true })
  delivery_comment: string;

  @Column({ type: 'varchar', nullable: true })
  city: string;

  @Column({ type: 'varchar', nullable: true })
  district: string;

  @Column({ type: 'varchar', nullable: true })
  full_address: string;

  @Column({ type: 'varchar', nullable: true })
  location_link: string;

  @Column({ type: 'varchar', nullable: true })
  date: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startDate: string;

  @OneToMany('ClientOrderItem', 'clientOrder')
  client_order_items: any[];

  @ManyToOne('User', 'clientOrders', { onDelete: 'SET NULL' })
  @JoinColumn()
  user: any;

  @ManyToOne('Cashflow', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  cashflow: any;
}
