import { Column, Entity, OneToMany } from 'typeorm';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { BaseEntity } from '../../common/database/base.entity';

export enum PayrollStatus {
  SENT = 'Sent',
  REJECTED = 'Rejected',
  IN_PROGRESS = 'InProgress',
  ACCEPTED = 'Accepted',
}

@Entity('payroll')
export class Payroll extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'float', default: 0 })
  award: number;

  @Column({ type: 'float', default: 0 })
  bonus: number;

  @Column({ type: 'float', default: 0 })
  total: number;

  @Column({ type: 'float', default: 0 })
  plastic: number;

  @Column({ type: 'float', default: 0, name: 'in_hand' })
  inHand: number;

  @Column({ type: 'float', default: 0 })
  prepayment: number;

  @Column({
    type: 'varchar',
    default: PayrollStatus.SENT,
  })
  status: PayrollStatus;

  @Column('int', { default: 0 })
  month: number;

  @Column({ default: false })
  isAccountantConfirmed: boolean;

  @Column({ default: false })
  isMManagerConfirmed: boolean;

  @Column({ type: 'int', default: () => 'EXTRACT(YEAR FROM CURRENT_DATE)' })
  year: number;

  @OneToMany(() => PayrollItems, (payroll_items) => payroll_items.payroll)
  payroll_items: PayrollItems[];
}
