import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { PackageTransferController } from '@modules/package-transfer/package-transfer.controller';
import { PackageTransferService } from '@modules/package-transfer/package-transfer.service';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Kassa } from '@modules/kassa/kassa.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackageTransfer, CashflowType, Kassa, Cashflow]),
  ],
  controllers: [PackageTransferController],
  providers: [PackageTransferService],
  exports: [PackageTransferService]
})
export class PackageTransferModule {
}
