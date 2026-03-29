import { BaseEntity } from '../../common/database/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('increment')
export class Increment extends BaseEntity {
  @Column({ default: 0, type: 'int' })
  index: number;
}
