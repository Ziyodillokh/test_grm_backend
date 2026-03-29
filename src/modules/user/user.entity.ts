import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BaseEntity } from '../../common/database/base.entity';
import { NumericTransformer } from '../../common/database/transformers/numeric.transformer';

// Relation imports (lazy strings used where circular deps would cause issues)
import { Position } from '../position/position.entity';
import { Filial } from '../filial/filial.entity';
import { Order } from '../order/order.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Action } from '../action/action.entity';
import { ClientOrder } from '../client-order/client-order.entity';
import { Product } from '../product/product.entity';
import { Transfer } from '../transfer/transfer.entity';
import { UserTimeLog } from '../user-time-log/user-time-log.entity';
import { Partiya } from '../partiya/partiya.entity';
import { Booking } from '../booking/booking.entity';
import { Note } from '../note/note.entity';
import { Media } from '../media/media.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { Client } from '../client/client.entity';
import { PackageTransfer } from '../package-transfer/package-transfer.entity';
import { PlanYear } from '../plan-year/plan-year.entity';
import { ChatInteraction } from '../chatgpt/chatgpt.entity';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { TransferCache } from '../transfer-cache/transfer-cache.entity';

@Entity('users')
export class User extends BaseEntity {
  /**
   * Suspension flag: false means the user is deactivated/suspended (cannot log in).
   * This is NOT a soft-delete flag -- actual deletion is handled by BaseEntity.deletedDate.
   * isActive is used for auth checks (auth.service.ts) and user filtering.
   * A suspended user (isActive=false) can potentially be reactivated,
   * while a soft-deleted user (deletedDate set) is permanently removed.
   */
  @Column({ type: 'boolean', nullable: true, default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  firstName: string;

  @Column({ type: 'varchar', nullable: true })
  lastName: string;

  @Column({ type: 'varchar', nullable: true })
  fatherName: string;

  @Column({ type: 'varchar' })
  login: string;

  @Column({ type: 'timestamp', nullable: true })
  hired: Date;

  @Column({ type: 'time', nullable: true })
  from: string;

  @Column({ type: 'time', nullable: true })
  to: string;

  @Column({ type: 'varchar', nullable: true })
  username: string;

  @Column('numeric', {
    nullable: true,
    precision: 20,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  salary: number;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', select: false })
  password: string;

  @Column({ default: true, nullable: true, type: 'boolean' })
  isUpdated: boolean;

  // --- Relations ---

  @ManyToOne(() => Position, (position) => position.users)
  @JoinColumn()
  position: Position;

  @ManyToOne(() => Filial, (filial) => filial.users)
  @JoinColumn()
  filial: Filial;

  @OneToOne(() => Filial, (filial) => filial.manager)
  m_filial: Filial;

  @OneToMany(() => Order, (order) => order.seller)
  sellerOrders: Order[];

  @OneToMany(() => Order, (order) => order.casher)
  casherOrders: Order[];

  @OneToMany(() => Cashflow, (cashflow) => cashflow.casher)
  cashflow: Cashflow[];

  @OneToMany(() => Action, (action) => action.user)
  actions: Action[];

  @OneToMany(() => ClientOrder, (clientOrder) => clientOrder.user)
  clientOrders: ClientOrder[];

  @ManyToMany(() => Product, (product) => product.favoriteUsers)
  @JoinTable()
  favoriteProducts: Product[];

  @OneToMany(() => Transfer, (transfer) => transfer.transferer)
  transfers: Transfer[];

  @OneToMany(() => Transfer, (transfer) => transfer.cashier)
  transferCashier: Transfer[];

  @OneToMany(() => UserTimeLog, (timeLog) => timeLog.user)
  timeLogs: UserTimeLog[];

  @OneToMany(() => Partiya, (partiya) => partiya.user)
  partiyas: Partiya[];

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  @OneToMany(() => Note, (note) => note.user)
  notes: Note[];

  @ManyToOne(() => Media, (media) => media.users)
  @JoinColumn()
  avatar: Media;

  @OneToMany(() => SellerReport, (report) => report.user)
  reports: SellerReport[];

  @OneToMany(() => PayrollItems, (payrollItem) => payrollItem.user)
  payroll_items: PayrollItems[];

  @OneToMany(() => Client, (client) => client.user)
  clients: Client[];

  @OneToMany(() => Transfer, (transfer) => transfer.courier)
  deliveries: Transfer[];

  @OneToMany(() => PackageTransfer, (pt) => pt.courier)
  package_transfer_deliveries: PackageTransfer[];

  @OneToMany(() => PlanYear, (planYear) => planYear.user)
  planYear: PlanYear[];

  @OneToMany(() => ChatInteraction, (chat) => chat.user)
  chats: ChatInteraction[];

  @OneToMany(() => PackageTransfer, (pt) => pt.d_manager)
  package_transfers: PackageTransfer[];

  public async hashPassword(password: string): Promise<void> {
    this.password = await bcrypt.hash(password, 10);
  }

  public isPasswordValid(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
