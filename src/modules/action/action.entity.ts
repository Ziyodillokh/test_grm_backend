import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('action')
export class Action extends BaseEntity {
  @ManyToOne(() => User, (user) => user.actions)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Filial, (filial) => filial.actions)
  filial: Filial;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column('varchar')
  type: string;

  @Column('varchar')
  desc: string;

  @Column('jsonb')
  info;

  @Column('boolean', { default: false })
  is_done: boolean = false;
}
