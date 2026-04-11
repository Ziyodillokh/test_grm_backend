import { Module } from '@nestjs/common';
import { FactoryService } from './factory.service';
import { FactoryController } from './factory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factory } from './factory.entity';
import { Country } from '@modules/country/country.entity';
import { Cashflow } from '../cashflow/cashflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Factory, Country, Cashflow])],
  providers: [FactoryService],
  controllers: [FactoryController],
  exports: [FactoryService],
})
export class FactoryModule {
}
