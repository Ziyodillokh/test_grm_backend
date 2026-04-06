import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('qr_logo')
export class QrLogo extends BaseEntity {
  @Column('varchar')
  link: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('text', { nullable: true })
  qrDataUrl: string;
}
