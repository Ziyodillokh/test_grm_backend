import { Column, Entity, OneToMany } from 'typeorm';
import { QrBase } from '../qr-base/qr-base.entity';
import { Partiya } from '../partiya/partiya.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';
import { Factory } from '@modules/factory/factory.entity';

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

  @OneToMany(() => Factory, (factory) => factory.country)
  factories: Factory[];
}
