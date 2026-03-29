import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { NumericTransformer } from '../../common/database/transformers/numeric.transformer';
import { TransferStatus } from '../../common/enums';
import { User } from '../user/user.entity';
import { Filial } from '../filial/filial.entity';
import { Product } from '../product/product.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { PackageTransfer } from '../package-transfer/package-transfer.entity';

@Entity('transfer')
export class Transfer extends BaseEntity {
  @Column('varchar', { default: 'Нет имя', nullable: true })
  title: string;

  @Column({ type: 'int' })
  count: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'boolean', default: false })
  isChecked: boolean;

  @Column({ type: 'varchar', default: TransferStatus.PROGRESS, name: 'progres' })
  progress: string;

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
  oldComingPrice: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
    default: 0,
  })
  kv: number;

  @Column({ type: 'boolean', default: false })
  for_dealer: boolean;

  @Column('varchar', { default: null, nullable: true })
  group: string;

  @Column({ type: 'int', default: 0 })
  order_index: number;

  @ManyToOne(() => User, (user) => user.deliveries)
  @JoinColumn()
  courier: User;

  @ManyToOne(() => Filial)
  @JoinColumn()
  from: Filial;

  @ManyToOne(() => Filial)
  @JoinColumn()
  to: Filial;

  @ManyToOne(() => Product, (product) => product.transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  product: Product;

  @ManyToOne(() => QrBase, (qrBase) => qrBase.transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  bar_code: QrBase;

  @ManyToOne(() => User, (user) => user.transfers)
  @JoinColumn()
  transferer: User;

  @ManyToOne(() => User, (user) => user.transferCashier)
  @JoinColumn()
  cashier: User;

  @ManyToOne(() => PackageTransfer, (pt) => pt.transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  package: PackageTransfer;
}
