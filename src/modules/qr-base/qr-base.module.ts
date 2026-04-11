import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrBase } from './qr-base.entity';
import { QrBaseService } from './qr-base.service';
import { QrBaseController } from './qr-base.controller';
import { CountryModule } from '../country/country.module';
import { CollectionModule } from '../collection/collection.module';
import { ColorModule } from '../color/color.module';
import { ShapeModule } from '../shape/shape.module';
import { SizeModule } from '../size/size.module';
import { StyleModule } from '../style/style.module';
import { ModelModule } from '../model/model.module';
import { FactoryModule } from '../factory/factory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QrBase]),
    CountryModule,
    CollectionModule,
    ColorModule,
    ShapeModule,
    SizeModule,
    StyleModule,
    ModelModule,
    FactoryModule,
  ],
  controllers: [QrBaseController],
  providers: [QrBaseService],
  exports: [QrBaseService],
})
export class QrBaseModule {}
