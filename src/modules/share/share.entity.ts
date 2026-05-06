import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Entity, Column, OneToMany } from 'typeorm';
import { Cashflow } from '../cashflow/cashflow.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('share')
export class Share extends BaseEntity {
  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  capital: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  given_capital: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  given_profit: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  profit: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDebt: number;

  @OneToMany(() => Cashflow, (cashflow) => cashflow.share, { onDelete: 'SET NULL' })
  cashflow: Cashflow[];
}
