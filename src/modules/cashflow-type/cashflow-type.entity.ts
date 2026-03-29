import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Position } from '../position/position.entity';
import CashflowTypeEnum from '../../infra/shared/enum/cashflow/cashflow-type.enum';
import { Media } from '../media/media.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('cashflow_type')
export class CashflowType extends BaseEntity {
  @Column('varchar')
  title: string;

  @Column('varchar')
  slug: string;

  @Column('varchar', { nullable: true, default: CashflowTypeEnum.INCOME })
  type: CashflowTypeEnum;

  @ManyToOne(() => Media, (media) => media.cashflowTypes)
  @JoinColumn()
  icon: Media;

  @Column('boolean', { default: true })
  is_visible: boolean;

  @ManyToMany(() => Position, (position) => position.cashflow_types)
  @JoinTable()
  positions: Position[];

  @OneToMany(() => Cashflow, (cashflow) => cashflow.cashflow_type)
  cashflow: Cashflow[];
}
