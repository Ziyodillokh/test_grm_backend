import { Column, Entity, OneToMany } from 'typeorm';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('award')
export class Award extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column('int')
  sum: number;

  @OneToMany(() => PayrollItems, (payrollItems) => payrollItems.award)
  payroll_items: PayrollItems[];
}
