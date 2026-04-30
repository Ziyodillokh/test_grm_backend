import { Column, Entity, OneToMany } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('shape')
export class Shape extends BaseEntity {
  @Column('varchar', { unique: true })
  title: string;

  @OneToMany(() => QrBase, (qrBase) => qrBase.shape, { onDelete: 'SET NULL' })
  qrBase: QrBase[];
}
