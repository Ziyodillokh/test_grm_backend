import { BaseEntity } from '../../common/database/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('client_request')
export class ClientRequest extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('varchar')
  location: string;

  @Column('varchar')
  phone: string;
}
