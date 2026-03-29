import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { ClientOrder } from '@modules/client-order/client-order.entity';
import { QrBase } from '@modules/qr-base/qr-base.entity';

@Entity('client_order_item')
export class ClientOrderItem extends BaseEntity {

  @Column('int')
  count: number;

  @ManyToOne(() => QrBase, item => item.client_order_items, { onDelete: 'SET NULL' })
  @JoinColumn()
  product: QrBase;

  @Column({ type: 'varchar', nullable: true })
  price: string;

  @ManyToOne(() => ClientOrder, clientOrder => clientOrder.client_order_items, { onDelete: 'SET NULL' })
  @JoinColumn()
  clientOrder: ClientOrder;
}
