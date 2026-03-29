import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaperReportService } from './paper-report.service';
import { PaperReportController } from './paper-report.controller';
import { PaperReport } from './paper-report.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Order } from '@modules/order/order.entity';
import { ClientModule } from '@modules/client/client.module';
import { Debt } from '@modules/debt/debt.entity';
import { TransferModule } from '@modules/transfer/transfer.module';
import { ReportsModule } from '@modules/report/report.module';
import { Filial } from '@modules/filial/filial.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaperReport, Kassa, Cashflow, Order, Debt, Filial]), ClientModule, TransferModule, ReportsModule],
  controllers: [PaperReportController],
  providers: [PaperReportService],
})
export class PaperReportModule {}
