import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payroll } from './payroll.entity';
import { User } from '../user/user.entity';
import { PayrollItems } from '../payroll-items/payroll-items.entity';
import { Award } from '../award/award.entity';
import { Report } from '../report/report.entity';
import { Cashflow } from '../cashflow/cashflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payroll, User, PayrollItems, Award, Report, Cashflow])],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
