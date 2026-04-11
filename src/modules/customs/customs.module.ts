import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Customs } from './customs.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CustomsService } from './customs.service';
import { CustomsController } from './customs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Customs, Cashflow])],
  providers: [CustomsService],
  controllers: [CustomsController],
  exports: [CustomsService],
})
export class CustomsModule {}
