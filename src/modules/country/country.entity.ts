import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';
import { Partiya } from '../partiya/partiya.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';
import { Collection } from '@modules/collection/collection.entity';
import { Factory } from '@modules/factory/factory.entity';
import { factory } from 'ts-jest/dist/transformers/hoist-jest';

@Entity('country')
export class Country extends BaseEntity {
  @Column('varchar', { unique: true })
  title: string;

  @OneToMany(() => QrBase, (qrBase) => qrBase.country)
  qrBase: QrBase[];

  @OneToMany(() => Partiya, (partiya) => partiya.country)
  partiyas: Partiya[];

  @OneToMany(() => CountryReportItem, (countryReportItem) => countryReportItem.country)
  countryReportItem: CountryReportItem[];

  @OneToMany(() => Collection, (collection) => collection.country)
  collections: Collection[];

  @OneToMany(()=> Factory, factory=> factory.country)
  factories: Factory[];
}
