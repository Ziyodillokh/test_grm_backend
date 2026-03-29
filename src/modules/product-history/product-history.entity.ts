import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Product } from '../product/product.entity';

@Entity()
export class ProductHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.histories, { onDelete: 'CASCADE' })
  @JoinColumn()
  product: Product;

  @Column('text')
  action: string;

  @CreateDateColumn({ name: 'dateOne', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'dateTwo', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedDate', nullable: true })
  deletedDate?: Date;
}
