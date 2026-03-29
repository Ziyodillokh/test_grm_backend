import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { Filial } from '@modules/filial/filial.entity';

@Entity('paper_report')
export class PaperReport extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  price: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @ManyToOne(() => Filial, (filial) => filial.paperReport, { onDelete: 'SET NULL' })
  @JoinColumn()
  filial: Filial;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  kv: number;
}
