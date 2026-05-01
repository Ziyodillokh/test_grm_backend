import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Product } from '../product/product.entity';
import { ColumnNumericTransformer } from '../../infra/helpers';
import { ProductExcel } from '../excel/excel-product.entity';
import { Country } from '../country/country.entity';
import { Factory } from '../factory/factory.entity';
import { User } from '../user/user.entity';
import { PartiyaNumber } from '../partiya_number/partiya_number.entity';
import { Filial } from '../filial/filial.entity';
import { PartiyaStatusEnum } from '../../infra/shared/enum';
import { BaseEntity } from '../../common/database/base.entity';
import { PartiyaCollectionPrice } from '../partiya-collection-price/partiya-collection-price.entity';

@Entity('partiya')
export class Partiya extends BaseEntity{
  @ManyToOne(() => Country, country => country.partiyas, { onDelete: 'SET NULL' })
  @JoinColumn()
  country: Country;

  @ManyToOne(() => Factory, factory => factory.partiyas, { onDelete: 'SET NULL' })
  @JoinColumn()
  factory: Factory;

  @ManyToOne(() => PartiyaNumber, (partiya_number) => partiya_number.Partiyas, { onDelete: 'SET NULL' })
  @JoinColumn()
  partiya_no: PartiyaNumber;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  expense: number;

  @Column('numeric', {
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  volume: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: string;

  @OneToMany(() => Product, (product) => product.partiya)
  products: Product[];

  @OneToMany(() => ProductExcel, (product) => product.partiya, { cascade: true })
  productsExcel: ProductExcel[];

  @OneToMany(() => PartiyaCollectionPrice, (pcp) => pcp.partiya, { cascade: true })
  collection_prices: PartiyaCollectionPrice[];

  @ManyToOne(() => Filial, warehouse => warehouse.partiyas, { onDelete: 'SET NULL' })
  @JoinColumn()
  warehouse: Filial;

  @ManyToOne(() => User, user => user.partiyas, { onDelete: 'SET NULL' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', default: PartiyaStatusEnum.NEW })
  partiya_status: PartiyaStatusEnum;
}
