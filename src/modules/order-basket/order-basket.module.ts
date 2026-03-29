import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderBasket } from './order-basket.entity';
import { OrderBasketController } from './order-basket.controller';
import { OrderBasketService } from './order-basket.service';
import { CollectionPriceModule } from '../collection-price/collection-price.module';
import { QrCodeModule } from '../qr-code/qr-code.module';
import { QrBaseModule } from '../qr-base/qr-base.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrderBasket]), CollectionPriceModule, QrCodeModule, QrBaseModule],
  controllers: [OrderBasketController],
  providers: [OrderBasketService],
  exports: [OrderBasketService],
})
export class OrderBasketModule {
}