import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Entity, Column, Generated, OneToMany } from 'typeorm';
import { Cashflow } from '../cashflow/cashflow.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('debts')
export class Debt extends BaseEntity {
  @Column({ nullable: true }) // nullable: true qo'shing
  fullName: string;

  @Column({ nullable: false })
  phone: string;

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
  totalDebt: number;

  @Column()
  @Generated('increment')
  number_debt: number;

  @OneToMany(() => Cashflow, (cashflow) => cashflow.debt, { onDelete: 'SET NULL' })
  cashflow: Cashflow[];
}
