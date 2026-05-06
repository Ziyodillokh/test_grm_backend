  import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
  import { QrBase } from '../qr-base/qr-base.entity';
  import { Partiya } from '../partiya/partiya.entity';
  import { BaseEntity } from '../../common/database/base.entity';
  import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
  import { Collection } from '@modules/collection/collection.entity';
  import { Country } from '@modules/country/country.entity';
  import { Cashflow } from '../cashflow/cashflow.entity';
  import { ColumnNumericTransformer } from '../../infra/helpers';

  @Entity('factory')
  export class Factory extends BaseEntity {
    @Column('varchar', { unique: true })
    title: string;

    @Column('boolean', { default: false })
    isReportEnabled: boolean;

    @Column('numeric', { precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0 })
    owed: number;

    @Column('numeric', { precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0 })
    given: number;

    @Column('numeric', { precision: 20, scale: 2, transformer: new ColumnNumericTransformer(), default: 0 })
    totalDebt: number;

    @OneToMany(() => QrBase, (qrBase) => qrBase.factory)
    qrBases: QrBase[];

    @OneToMany(() => Partiya, (partiya) => partiya.factory)
    partiyas: Partiya[];

    @OneToMany(() => FactoryReportItem, (factoryReportItem) => factoryReportItem.factory)
    factoryReportItem: FactoryReportItem[];

    @OneToMany(() => Collection, (collection) => collection.factory)
    collections: Collection[];

    @OneToMany(() => Cashflow, (cashflow) => cashflow.factory)
    cashflows: Cashflow[];

    @ManyToOne(() => Country, country => country.factories, { onDelete: 'SET NULL' })
    @JoinColumn()
    country: Country;
  }
