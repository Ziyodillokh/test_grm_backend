import { Column, Entity, OneToMany } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('size')
export class Size extends BaseEntity {
  @Column({ type: 'varchar', unique: true, nullable: true })
  title: string;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  x: number;

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
    scale: 3,
    transformer: new ColumnNumericTransformer(),
  })
  kv: number;

  @OneToMany(() => QrBase, (qrBase) => qrBase.size, { onDelete: 'SET NULL' })
  qrBase: QrBase[];
}
