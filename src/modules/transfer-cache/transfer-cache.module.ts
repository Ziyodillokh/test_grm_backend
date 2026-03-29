import { Module } from '@nestjs/common';
import { TransferCacheService } from './transfer-cache.service';
import { TransferCacheController } from './transfer-cache.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferCache } from './transfer-cache.entity';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransferCache, Product, User])],
  providers: [TransferCacheService],
  controllers: [TransferCacheController],
})
export class TransferCacheModule {
}
