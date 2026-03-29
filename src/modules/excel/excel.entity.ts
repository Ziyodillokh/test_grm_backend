import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('excel')
export class Excel extends BaseEntity {
  @Column()
  path: string;
}
