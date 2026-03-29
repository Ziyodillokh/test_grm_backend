import { Column, Entity, OneToMany } from 'typeorm';
import { Partiya } from '../partiya/partiya.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('partiya_number')
export class PartiyaNumber extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  title: string;

  @OneToMany(() => Partiya, (partiya) => partiya.partiya_no)
  Partiyas: Partiya[];
}
