import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('note')
export class Note extends BaseEntity{
  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar'})
  color: string;

  @Column('text')
  content: string;

  @ManyToOne(() => User, user => user.notes, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

}