import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Debt } from './debt.entity';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';

import { CashflowModule } from '../cashflow/cashflow.module';
import { CashflowTypeModule } from '../cashflow-type/cashflow-type.module';

@Module({
  imports: [TypeOrmModule.forFeature([Debt]), forwardRef(() => CashflowModule), forwardRef(() => CashflowTypeModule)],
  providers: [DebtService],
  controllers: [DebtController],
  exports: [DebtService],
})
export class DebtModule {}
