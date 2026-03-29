import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { Media } from '@modules/media/media.entity';

@Entity('style')
export class Style extends BaseEntity {
  @Column({ unique: true, type: 'varchar' })
  title: string;

  @ManyToOne(() => Media, (media) => media.users, { onDelete: 'SET NULL' })
  photo: Media;

  @OneToMany(() => QrBase, (qrBase) => qrBase.style, { onDelete: 'SET NULL' })
  qrBase: QrBase[];
}
