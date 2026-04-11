import { Entity, Column, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Cashflow } from '../cashflow/cashflow.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('customs')
export class Customs extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

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
  given: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDebt: number;

  @OneToMany(() => Cashflow, (cashflow) => cashflow.customs, { onDelete: 'SET NULL' })
  cashflows: Cashflow[];
}
