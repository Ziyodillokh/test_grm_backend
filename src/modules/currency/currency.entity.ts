import { Column, Entity } from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('currency')
export class Currency extends BaseEntity{
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  usd: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  uzs: string;

  @Column({ type: 'timestamp' })
  date: string;
}
