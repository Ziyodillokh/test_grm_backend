import { Column, Entity, JoinColumn, ManyToMany, OneToMany, OneToOne } from 'typeorm';
import { Kassa } from '../kassa/kassa.entity';
import { User } from '../user/user.entity';
import { Product } from '../product/product.entity';
import { Action } from '../action/action.entity';
import { ClientOrder } from '../client-order/client-order.entity';
import { Partiya } from '../partiya/partiya.entity';
import { FilialTypeEnum } from '../../infra/shared/enum';
import { FilialReport } from '../filial-report/filial-report.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Contact } from '../contact/contact.entity';
import { Client } from '../client/client.entity';
import { Report } from '../report/report.entity';
import { PlanYear } from '../plan-year/plan-year.entity';
import { ColumnNumericTransformer } from 'src/infra/helpers';
import { CollectionReportItem } from '../collection-report-item/collection-report-item.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';
import { PaperReport } from '@modules/paper-report/paper-report.entity';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';

@Entity('filial')
export class Filial extends BaseEntity {
  @Column()
  title: string;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  given: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  owed: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  telegram: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  startWorkTime: string;

  @Column({ nullable: true })
  endWorkTime: string;

  /**
   * @deprecated Use BaseEntity.deletedDate (TypeORM @DeleteDateColumn) for soft-delete.
   * Kept temporarily for backward compatibility with existing queries.
   * Will be removed after migration to TypeORM soft-delete is complete.
   */
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  addressLink: string;

  @Column({ nullable: true })
  landmark: string;

  @Column({ nullable: true })
  phone1: string;

  @Column({ nullable: true })
  phone2: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  need_get_report: boolean;

  @OneToOne(() => User, (user) => user.m_filial, { onDelete: 'SET NULL' })
  @JoinColumn()
  manager: User;

  @Column('enum', { default: FilialTypeEnum.FILIAL, enum: FilialTypeEnum })
  type: FilialTypeEnum;

  @OneToMany(() => Kassa, (kassa) => kassa.filial)
  kassa: Kassa[];

  @OneToMany(() => FilialReport, (filial_report) => filial_report.filial)
  filial_reports: FilialReport[];

  @OneToMany(() => User, (user) => user.filial)
  users: User[];

  @OneToMany(() => Product, (product) => product.filial)
  products: Product[];

  @OneToMany(() => Action, (action) => action.filial)
  actions: Action[];

  @OneToMany(() => Partiya, (partiya) => partiya.warehouse)
  partiyas: Partiya[];

  @OneToMany(() => Contact, (contact) => contact.filial)
  contacts: Contact[];

  @OneToMany(() => Cashflow, (cashflow) => cashflow.filial)
  cashflow: Cashflow[];

  @OneToMany(() => Client, (client) => client.filial, { cascade: true })
  clients: Client[];

  @OneToMany(() => Report, (report) => report.filial)
  report: Report[];

  @OneToMany(() => PlanYear, (planYear) => planYear.filial)
  planYear: PlanYear[];

  @OneToMany(() => CollectionReportItem, (collectionReport) => collectionReport.filial)
  collectionReportItem: CollectionReportItem[];

  @OneToMany(() => FactoryReportItem, (factoryReport) => factoryReport.filial)
  factoryReportItem: FactoryReportItem[];

  @OneToMany(() => CountryReportItem, (countryReport) => countryReport.filial)
  countryReportItem: CountryReportItem[];

  @OneToMany(() => PaperReport, (paperReport) => paperReport.filial)
  paperReport: PaperReport[];

  @OneToMany(()=> PackageTransfer, package_transfer => package_transfer.dealer)
  dealer_package_transfers: PackageTransfer[];

  @OneToMany(()=> PackageTransfer, package_transfer => package_transfer.from)
  package_transfers: PackageTransfer[];
}
