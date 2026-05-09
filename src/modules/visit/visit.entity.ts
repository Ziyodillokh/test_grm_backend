import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { Client } from '../client/client.entity';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';

export enum VisitOutcomeEnum {
  Purchase = 'purchase',
  NoPurchase = 'no_purchase',
}

@Entity('visit')
export class Visit extends BaseEntity {
  @Column({ type: 'varchar', length: 20, default: VisitOutcomeEnum.NoPurchase })
  outcome: VisitOutcomeEnum;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @ManyToOne(() => Filial, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'filialId' })
  filial: Filial;
}
