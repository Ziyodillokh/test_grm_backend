import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { Filial } from '../filial/filial.entity';
import { FilialReportStatusEnum } from '../../infra/shared/enum';
import { BaseEntity } from '../../common/database/base.entity';
import { ReInventory } from '@modules/re-inventory/re-inventory.entity';

@Entity('filial_report')
export class FilialReport extends BaseEntity {
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date?: Date;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  volume: number;

  @Column('int', { default: 0 })
  count: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  cost: number;

  @Column('varchar', { default: null, nullable: true })
  excel: string;

  @Column('varchar', { default: FilialReportStatusEnum.OPEN })
  status: FilialReportStatusEnum;

  @ManyToOne(() => Filial, (filial) => filial.filial_reports, { onDelete: 'CASCADE' })
  @JoinColumn()
  filial: Filial;

  @OneToMany(() => ReInventory, re_inventory => re_inventory.filial_report)
  re_inventory: ReInventory[];
}
