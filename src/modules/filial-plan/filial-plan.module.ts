import { Module } from '@nestjs/common';
import { FilialPlanService } from './filial-plan.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Filial } from '@modules/filial/filial.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { FilialPlanController } from '@modules/filial-plan/filial-plan.controller';
import { Order } from '@modules/order/order.entity';
import { User } from '@modules/user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    Filial,
    Kassa,
    Order,
    User
  ])],
  providers: [FilialPlanService],
  controllers: [FilialPlanController],
  exports: [FilialPlanService]
})
export class FilialPlanModule {
}
