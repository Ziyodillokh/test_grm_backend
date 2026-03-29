import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Filial } from '../filial/filial.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('contact')
export class Contact extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('varchar')
  secondName: string;

  @Column('text')
  comment: string;

  @Column('varchar')
  phone: string;

  @ManyToOne(() => Filial, (filial) => filial.contacts, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

}
