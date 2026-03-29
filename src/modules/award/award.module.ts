import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Award } from './award.entity';
import { AwardService } from './award.service';
import { AwardController } from './award.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Award])],
  controllers: [AwardController],
  providers: [AwardService],
  exports: [AwardService]
})
export class AwardModule {}
