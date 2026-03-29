import { ColumnNumericTransformer } from 'src/infra/helpers';
import { BaseEntity } from '../../common/database/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('dealer_transaction')
export class DealerTransaction extends BaseEntity{
  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  given: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  owed: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalPlasticSum: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalSum: number;
}
