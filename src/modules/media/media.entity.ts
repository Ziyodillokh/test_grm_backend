import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../user/user.entity';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { BaseEntity } from '../../common/database/base.entity';
import { Style } from '@modules/style/style.entity';

@Entity('media')
export class Media extends BaseEntity {
  @Column()
  path: string;

  @Column()
  model: string;

  @Column()
  mimetype: string;

  @Column()
  size: number;

  @Column({ nullable: true })
  name: string | null;

  @OneToMany(() => CashflowType, (CashflowType) => CashflowType.icon)
  cashflowTypes: CashflowType[];

  @OneToMany(() => User, (user) => user.avatar)
  users: User[];

  @OneToMany(() => Style, (style) => style.photo)
  style: Style[];

  @OneToMany(() => QrBase, (qr_base) => qr_base.imgUrl)
  qr_bases: QrBase[];

  @ManyToOne(() => QrBase, (qrbase) => qrbase.other_images)
  @JoinColumn()
  i_image?: QrBase;
}
