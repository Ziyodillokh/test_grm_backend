import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../client/client.entity';
import { Visit } from './visit.entity';
import { VisitController } from './visit.controller';
import { VisitService } from './visit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Visit, Client])],
  controllers: [VisitController],
  providers: [VisitService],
  exports: [VisitService],
})
export class VisitModule {}
