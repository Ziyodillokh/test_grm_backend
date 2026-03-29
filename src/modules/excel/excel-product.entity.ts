import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Partiya } from '../partiya/partiya.entity';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { QrBase } from '../qr-base/qr-base.entity';

@Entity('productexcel')
export class ProductExcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, default: 0 })
  count: number;

  @Column({ nullable: true, default: 0 })
  check_count: number;

  @Column({ precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0, type: 'numeric' })
  displayPrice: number;

  @Column({ precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0, type: 'numeric', name: 'commingPrice' })
  comingPrice: number;

  @Column({ precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0, type: 'numeric' })
  updateCollectionCost: number;

  @Column({ nullable: true, default: false })
  isEdited: boolean;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  y: number;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  waiting_count: number;

  @ManyToOne(() => QrBase, (qrbase) => qrbase.productsExcel, { onDelete: 'SET NULL' })
  @JoinColumn()
  bar_code: QrBase;

  @ManyToOne(() => Partiya, (partiya) => partiya.productsExcel, { onDelete: 'CASCADE' })
  @JoinColumn()
  partiya: Partiya;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
