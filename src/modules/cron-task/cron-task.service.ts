import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as dayOfYear from 'dayjs/plugin/dayOfYear';

import { KassaService } from '../kassa/kassa.service';
import { ReportService } from '../report/report.service';
import { SellerReportItemService } from '../seller-report-item/seller-report-item.service';
import { SellerReportService } from '../seller-report/seller-report.service';
import { CollectionReportService } from '../collection-report-item/collection-report-item.service';
import { OrderService } from '../order/order.service';
import { FactoryReportService } from '../factory-report-item/factory-report-item.service';
import { CountryReportService } from '../country-report-item/country-report-item.service';
import { PlanYearService } from '../plan-year/plan-year.service';
import { PlanYear } from '../plan-year/plan-year.entity';

dayjs.extend(dayOfYear);

@Injectable()
export class CronTaskService {
  private readonly logger = new Logger(CronTaskService.name);

  constructor(
    private readonly kassaService: KassaService,
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    private readonly sellerReportItemService: SellerReportItemService,
    private readonly sellerReportService: SellerReportService,
    private readonly collectionReportItemService: CollectionReportService,
    private readonly factoryReportItemService: FactoryReportService,
    private readonly countryReportItemService: CountryReportService,
    private readonly planYearService: PlanYearService,
    @InjectRepository(PlanYear)
    private readonly planYearRepository: Repository<PlanYear>,
  ) {}

  onModuleInit() {
    this.logger.log('🕐 CronTaskService initialized - cron jobs are registered.');
    this.logger.log('  - kassa-cron: runs at 00:00 daily');
    this.logger.log('  - monthly-cron: runs at 23:00 daily (end-of-month logic)');
  }

  /**
   * Runs every day at 00:00
   */
  @Cron('0 0 * * *', {
    name: 'kassa-cron',
  })
  async handleDailyCron() {
    try {
      const currentDay = dayjs().dayOfYear();
      const year = dayjs().year();

      await this.planYearRepository.update({ year }, { day: currentDay });

      await this.sellerReportItemService.generateDailyReportsForAllSellers();
      await this.sellerReportItemService.linkAllItemsToMonthlyReports();
      await this.collectionReportItemService.createDailyReport();
      await this.factoryReportItemService.createDailyReport();
      await this.countryReportItemService.createDailyReport();

      this.logger.log('✅ Daily cron executed successfully.');
    } catch (error) {
      this.logger.error('❌ Error in daily cron:', error);
    }
  }

  /**
   * Runs every day at 23:00 and triggers only if it’s the last day of the month
   */
  @Cron('0 23 * * *', {
    name: 'monthly-cron',
  })
  async handleMonthlyCron2() {
    try {
      const today = dayjs();
      const lastDay = today.endOf('month').date();

      if (today.date() === lastDay) {
        this.logger.log('📅 Last day of the month detected — running end-of-month logic...');
        await this.kassaService.handleEndOfMonth();
        this.logger.log('✅ End-of-month process completed successfully.');
      } else {
        this.logger.debug('Not the last day of the month — skipping end-of-month logic.');
      }
    } catch (error) {
      this.logger.error('❌ Error in monthly cron:', error);
    }
  }
}
