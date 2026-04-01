import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { User } from '../user/user.entity';

@Entity('video-message')
export class VideoMessage extends BaseEntity {
  @Column({ nullable: true })
  videoPath: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'int', nullable: true })
  targetRole: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  targetUser: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn()
  sender: User;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
