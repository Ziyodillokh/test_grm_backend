import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { Client } from './client.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Filial } from '../filial/filial.entity';
import { Order } from '../order/order.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Client, User, Filial, Order, Cashflow, CashflowType])],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
