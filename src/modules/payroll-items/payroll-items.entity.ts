import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Payroll } from '../payroll/payroll.entity';
import { User } from '../user/user.entity';
import { Award } from '../award/award.entity';
import { Bonus } from '../bonus/bonus.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('payroll_items')
export class PayrollItems extends BaseEntity {
  @Column({ type: 'float', default: 0 })
  total: number;

  @Column({ type: 'float', default: 0 })
  plastic: number;

  @Column({ type: 'float', default: 0 })
  in_hand: number;

  @Column({ type: 'float', default: 0 })
  prepayment: number;

  @Column({ type: 'int', nullable: true })
  selectedMonth: number;

  @Column({ type: 'int', default: () => 'EXTRACT(YEAR FROM CURRENT_DATE)' })
  year: number;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @Column({ type: 'boolean', default: false })
  is_bonus: boolean;

  @ManyToOne(() => Payroll, (payroll) => payroll.payroll_items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payrollId' })
  payroll: Payroll;

  @ManyToOne(() => User, (user) => user.payroll_items, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Award, (award) => award.payroll_items)
  @JoinColumn()
  award: Award;

  @ManyToOne(() => Bonus, (bonus) => bonus.payroll_items)
  @JoinColumn()
  bonus: Bonus;
}
