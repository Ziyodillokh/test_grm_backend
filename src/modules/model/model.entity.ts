import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Collection } from '../collection/collection.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('model')
export class Model extends BaseEntity {
  @Column('varchar')
  title: string;

  @ManyToOne(() => Collection, (collection) => collection.model, { onDelete: 'SET NULL' })
  collection: Collection;

  @OneToMany(() => QrBase, (qrBase) => qrBase.model, { onDelete: 'SET NULL' })
  qrBase: QrBase[];
}
