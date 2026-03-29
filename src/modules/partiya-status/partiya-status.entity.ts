import { Column, Entity, OneToMany } from 'typeorm';
import { Partiya } from '../partiya/partiya.entity';
import { PartiyaStatusEnum } from '../../infra/shared/enum';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('partiya_status')
export class PartiyaStatus extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  title: string;

  @Column({ type: 'enum', enum: PartiyaStatusEnum, default: PartiyaStatusEnum.NEW, unique: true })
  slug: PartiyaStatusEnum;

  @OneToMany(() => Partiya, (partiya) => partiya.partiya_status)
  partiyas: Partiya[];
}
