import { Module } from '@nestjs/common';
import { PayrollItemsService } from './payroll-items.service';
import { PayrollItemsController } from './payroll-items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollItems } from './payroll-items.entity';
import { UserModule } from '../user/user.module';
import { AwardModule } from '../award/award.module';
import { Payroll } from '../payroll/payroll.entity';
import { BonusModule } from '../bonus/bonus.module';
import { SellerReportModule } from '../seller-report/seller-report.module';

@Module({
  imports: [TypeOrmModule.forFeature([PayrollItems, Payroll]), UserModule, AwardModule, BonusModule, SellerReportModule],
  providers: [PayrollItemsService],
  controllers: [PayrollItemsController],
})
export class PayrollItemsModule {}
