import { Module } from '@nestjs/common';
import { DealerTransactionItemService } from './dealer-transaction_item.service';
import { DealerTransactionItemController } from './dealer-transaction_item.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DealerTransactionItem } from './dealer-transaction_item.entity';
@Module({
  imports: [TypeOrmModule.forFeature([DealerTransactionItem])],
  controllers: [DealerTransactionItemController],
  providers: [DealerTransactionItemService],
  exports: [DealerTransactionItemService],
})
export class DealerTransactionItemModule {}
