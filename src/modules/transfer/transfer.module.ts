import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transfer } from './transfer.entity';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { TransferCacheModule } from '../transfer-cache/transfer-cache.module';
import { PackageTransferModule } from '../package-transfer/package-transfer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer]),
    TransferCacheModule,
    PackageTransferModule,
  ],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService, TransferCacheModule, PackageTransferModule],
})
export class TransferModule {}
