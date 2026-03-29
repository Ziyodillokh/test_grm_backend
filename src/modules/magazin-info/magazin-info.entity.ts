import { BaseEntity } from '../../common/database/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('magazin_info')
export class MagazinInfo extends BaseEntity{
  @Column('varchar', { nullable: true })
  terms: string;

  @Column('varchar', { nullable: true })
  availability: string;

  @Column('varchar', { nullable: true })
  start_time: string;

  @Column('varchar', { nullable: true })
  end_time: string;

  @Column('int', { nullable: true, default: 0 })
  count: number;

  @Column('boolean', { default: false })
  allowed: boolean;
}
