// src/modules/chatgpt/chatgpt.entity.ts
import { Column, Entity, ManyToOne } from 'typeorm';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity()
export class ChatInteraction extends BaseEntity {
  @Column('text', { nullable: true })
  prompt: string;

  @Column('text', { nullable: true })
  response: string;

  @ManyToOne(() => User, (user) => user.chats, { onDelete: 'CASCADE' })
  user: User;
}
