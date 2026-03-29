import { Module } from '@nestjs/common';
import { PartiyaStatusService } from './partiya-status.service';
import { PartiyaStatusController } from './partiya-status.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartiyaStatus } from './partiya-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PartiyaStatus])],
  providers: [PartiyaStatusService],
  controllers: [PartiyaStatusController],
  exports: [PartiyaStatusService],
})
export class PartiyaStatusModule {
}
