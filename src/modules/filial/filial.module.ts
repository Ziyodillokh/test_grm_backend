import { forwardRef, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Filial } from './filial.entity';
import { FilialService } from './filial.service';
import { FilialController } from './filial.controller';
import { FilialQueryParserMiddleware } from '../../infra/middleware';
import { FilialReportModule } from '../filial-report/filial-report.module';
import { PositionModule } from '../position/position.module';
import { Kassa } from '../kassa/kassa.entity';
import { ReportsModule } from '../report/report.module';
import { KassaModule } from '../kassa/kassa.module';
import { PlanYearModule } from '../plan-year/plan-year.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Filial, Kassa]),
    FilialReportModule,
    PlanYearModule,
    PositionModule,
    forwardRef(() => KassaModule),
    forwardRef(() => ReportsModule),
  ],
  controllers: [FilialController],
  providers: [FilialService],
  exports: [FilialService],
})
export class FilialModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FilialQueryParserMiddleware).forRoutes({ path: '/filial', method: RequestMethod.GET });
  }
}
