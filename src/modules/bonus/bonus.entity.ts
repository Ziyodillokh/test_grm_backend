import { Column, Entity, OneToMany } from 'typeorm';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { BaseEntity } from '../../common/database/base.entity';
import BonusType from 'src/infra/shared/enum/forbonus/bonus-type';
import OperatorType from 'src/infra/shared/enum/forbonus/operator-type';
import ConditionUnit from 'src/infra/shared/enum/forbonus/condition-type';

@Entity('bonus')
export class Bonus extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column('int')
  condition: number;

  @Column('enum', { enum: ConditionUnit, default: ConditionUnit.SQUARE_METER })
  conditionUnit: ConditionUnit;

  @Column('enum', { enum: OperatorType, default: OperatorType.GREATER_THAN })
  operator: OperatorType;

  @Column('float')
  bonusAmount: number;

  @Column('enum', { enum: BonusType, default: BonusType.PERCENT })
  bonusUnit: BonusType;

  @Column({ type: 'date' })
  endDate: Date;

  @OneToMany(() => PayrollItems, (payrollItems) => payrollItems.bonus)
  payroll_items: PayrollItems[];
}
