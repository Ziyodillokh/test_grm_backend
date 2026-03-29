import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import PlanYearType from 'src/infra/shared/enum/plan-year.enum';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('plan_year')
export class PlanYear extends BaseEntity {
  @Column({ type: 'int' })
  year: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  yearlyGoal: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  collectedAmount: number;

  @Column({ type: 'int', default: 1 })
  day: number;

  @Column('enum', { default: PlanYearType.PLANYEAR, enum: PlanYearType })
  type: PlanYearType;

  @Column({ type: 'int', default: 0 })
  status: number;

  @ManyToOne(() => Filial, (filial) => filial.planYear, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @ManyToOne(() => User, (user) => user.planYear, { onDelete: 'SET NULL' })
  @JoinColumn()
  user: User;
}
