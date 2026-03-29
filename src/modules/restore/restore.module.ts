import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Filial } from '../filial/filial.entity';
import { Kassa } from '../kassa/kassa.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Order } from '../order/order.entity';
import { RestoreService } from './restore.service';
import { User } from '../user/user.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { Product } from '../product/product.entity';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import { RestoreController } from './restore.controller';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Filial, Kassa, Cashflow, Order, User, QrBase, Product, CashflowType, PackageTransfer]),
  ],
  controllers: [RestoreController],
  providers: [RestoreService],
  exports: [RestoreService],
})
export class RestoreModule {
}