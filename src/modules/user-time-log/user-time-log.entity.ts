import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../user/user.entity';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('userTimeLog')
export class UserTimeLog extends BaseEntity {
  @ManyToOne(() => User, (user) => user.timeLogs)
  @JoinColumn()
  user: User;

  @Column()
  enter: Date;

  @Column({ nullable: true })
  leave: Date;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalTime: number;
}
