import { BaseEntity } from '../../common/database/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('banner')
export class Banner extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  img: string;

  @Column({ type: 'int', generated: 'increment' })
  index: number;
}
