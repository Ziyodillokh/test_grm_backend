import { forwardRef, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Partiya } from './partiya.entity';
import { PartiyaService } from './partiya.service';
import { PartiyaController } from './partiya.controller';
import { ExcelModule } from '../excel/excel.module';
import { ActionModule } from '../action/action.module';
import PartiyaQueryParserMiddleware from '../../infra/middleware/partiya-query-parser';
import { PartiyaStatusModule } from '../partiya-status/partiya-status.module';
import { Filial } from '../filial/filial.entity';
import { ProductExcel } from '../excel/excel-product.entity';
import { PartiyaCollectionPriceModule } from '../partiya-collection-price/partiya-collection-price.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partiya, Filial, ProductExcel]),
    ActionModule,
    forwardRef(() => ExcelModule),
    PartiyaStatusModule,
    PartiyaCollectionPriceModule,
  ],
  controllers: [PartiyaController],
  providers: [PartiyaService],
  exports: [PartiyaService],
})
export class PartiyaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PartiyaQueryParserMiddleware).forRoutes({ path: '/partiya', method: RequestMethod.GET });
  }
}
