import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Street } from './street.entity';
import { StreetService } from './street.service';
import { StreetController } from './street.controller';
import { Cashflow } from '../cashflow/cashflow.entity';

import { CashflowModule } from '../cashflow/cashflow.module';
import { CashflowTypeModule } from '../cashflow-type/cashflow-type.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Street, Cashflow]),
    forwardRef(() => CashflowModule),
    forwardRef(() => CashflowTypeModule),
  ],
  providers: [StreetService],
  controllers: [StreetController],
  exports: [StreetService],
})
export class StreetModule {}
