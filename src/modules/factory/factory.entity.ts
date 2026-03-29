  import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
  import { QrBase } from '../qr-base/qr-base.entity';
  import { Partiya } from '../partiya/partiya.entity';
  import { BaseEntity } from '../../common/database/base.entity';
  import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
  import { Collection } from '@modules/collection/collection.entity';
  import { Country } from '@modules/country/country.entity';

  @Entity('factory')
  export class Factory extends BaseEntity {
    @Column('varchar', { unique: true })
    title: string;

    @OneToMany(() => QrBase, (qrBase) => qrBase.factory)
    qrBases: QrBase[];

    @OneToMany(() => Partiya, (partiya) => partiya.factory)
    partiyas: Partiya[];

    @OneToMany(() => FactoryReportItem, (factoryReportItem) => factoryReportItem.factory)
    factoryReportItem: FactoryReportItem[];

    @OneToMany(() => Collection, (collection) => collection.factory)
    collections: Collection[];

    @ManyToOne(() => Country, country => country.factories, { onDelete: 'SET NULL' })
    @JoinColumn()
    country: Country;
  }
