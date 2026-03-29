import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import { User } from '../user/user.entity';
import { UserRoleEnum } from '../../infra/shared/enum';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('position')
export class Position extends BaseEntity {
  @Column('varchar')
  title: string;

  @Column('boolean', { default: true })
  is_active: boolean;

  @OneToMany(() => User, (user) => user.position)
  users: User[];

  @ManyToMany(() => CashflowType, (cashflowType) => cashflowType.positions)
  cashflow_types: CashflowType[];

  @Column({ type: 'int', default: UserRoleEnum.CLIENT, nullable: true })
  role: UserRoleEnum;
}
