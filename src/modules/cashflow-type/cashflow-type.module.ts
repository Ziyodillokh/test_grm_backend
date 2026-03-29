import { forwardRef, Module } from '@nestjs/common';
import { CashflowTypeService } from './cashflow-type.service';
import { CashflowTypeController } from './cashflow-type.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashflowType } from './cashflow-type.entity';
import { CashflowModule } from '../cashflow/cashflow.module';
import { User } from '@modules/user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashflowType, User]), forwardRef(() => CashflowModule)],
  providers: [CashflowTypeService],
  controllers: [CashflowTypeController],
  exports: [CashflowTypeService],
})
export class CashflowTypeModule {}
