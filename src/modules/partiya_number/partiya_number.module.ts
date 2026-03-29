import { Module } from '@nestjs/common';
import { PartiyaNumberService } from './partiya_number.service';
import { PartiyaNumberController } from './partiya_number.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartiyaNumber } from './partiya_number.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PartiyaNumber])],
  providers: [PartiyaNumberService],
  controllers: [PartiyaNumberController],
  exports: [PartiyaNumberService],
})
export class PartiyaNumberModule {
}
