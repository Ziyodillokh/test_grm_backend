import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Filial } from '@modules/filial/filial.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import PackageTransferEnum from '../../infra/shared/enum/package-transfer.enum';
import { User } from '@modules/user/user.entity';
import { PackageCollectionPrice } from '@modules/package-collection-price/package-collection-price.entity';

@Entity('package_transfer')
export class PackageTransfer extends BaseEntity {
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total_kv: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total_profit_sum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total_sum: number;

  /** Gross profit across accepted transfers: Σ kv × (dealerPriceMeter − comingPrice) */
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total_profit: number;

  /** Discount vs retail price: Σ kv × (origPriceMeter − dealerPriceMeter) */
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total_discount: number;

  @Column('int', {default: 0})
  total_count: number;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @Column('varchar', { default: PackageTransferEnum.Progress })
  status: PackageTransferEnum;

  @Column()
  title: string;

  @OneToMany(() => PackageCollectionPrice, (pcp) => pcp.package, { cascade: true })
  collection_prices: PackageCollectionPrice[];

  @ManyToOne(() => Filial, filial => filial.dealer_package_transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  dealer: Filial;

  @ManyToOne(() => Filial, filial => filial.package_transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  from: Filial;

  @ManyToOne(() => User, user => user.package_transfers, { onDelete: 'SET NULL' })
  @JoinColumn()
  d_manager: User;

  @ManyToOne(() => User, (user) => user.package_transfer_deliveries, { onDelete: 'SET NULL' })
  @JoinColumn()
  courier: User;

  @OneToMany(() => Transfer, transfer => transfer.package)
  transfers: Transfer[];
}