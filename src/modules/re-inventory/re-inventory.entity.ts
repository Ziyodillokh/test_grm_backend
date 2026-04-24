import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Product } from '@modules/product/product.entity';
import { QrBase } from '@modules/qr-base/qr-base.entity';
import { ColumnNumericTransformer } from '@infra/helpers';
import { FilialReport } from '@modules/filial-report/filial-report.entity';
import { User } from '@modules/user/user.entity';

@Entity('re_inventory')
export class ReInventory extends BaseEntity {
  @ManyToOne(() => Product, (product) => product.re_inventory, { onDelete: 'SET NULL' })
  @JoinColumn()
  product: Product;

  @ManyToOne(() => QrBase, (qr_base) => qr_base.re_inventory, { onDelete: 'SET NULL' })
  @JoinColumn()
  bar_code: QrBase;

  @Column('int', { default: 0 })
  count: number;

  @Column({
    type: 'numeric',
    scale: 2,
    precision: 20,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  y: number;

  @Column({
    type: 'numeric',
    scale: 2,
    precision: 20,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  check_count: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  comingPrice: number;

  @ManyToOne(() => FilialReport, filial_report => filial_report.re_inventory, { onDelete: 'CASCADE' })
  @JoinColumn()
  filial_report: FilialReport;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  last_checked_by: User;

  @Column({ type: 'timestamp', nullable: true })
  last_checked_at: Date;
}