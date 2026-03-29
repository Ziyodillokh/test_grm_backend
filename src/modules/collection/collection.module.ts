import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Collection } from './collection.entity';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { Factory } from '@modules/factory/factory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection, Factory])],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
