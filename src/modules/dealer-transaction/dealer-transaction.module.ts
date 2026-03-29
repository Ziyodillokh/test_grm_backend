import { Module } from '@nestjs/common';
import { DealerTransactionService } from './dealer-transaction.service';
import { DealerTransactionController } from './dealer-transaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DealerTransaction } from './dealer-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DealerTransaction])],
  controllers: [DealerTransactionController],
  providers: [DealerTransactionService],
  exports: [DealerTransactionService],
})
export class DealerTransactionModule {}
