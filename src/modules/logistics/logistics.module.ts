import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Logistics } from './logistics.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { LogisticsService } from './logistics.service';
import { LogisticsController } from './logistics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Logistics, Cashflow])],
  providers: [LogisticsService],
  controllers: [LogisticsController],
  exports: [LogisticsService],
})
export class LogisticsModule {}
