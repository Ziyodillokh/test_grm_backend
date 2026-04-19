import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { ReportQueryDto } from './dto';
import * as dayjs from 'dayjs';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { CashFlowEnum, FilialTypeEnum, OrderEnum, UserRoleEnum } from '../../infra/shared/enum';
import { Report } from '../report/report.entity';
import { BossReport } from './boss-report.entity';
import { ReportService } from '../report/report.service';
import { CancelReportDto } from './dto/update-report.dto';
import ReportProgresEnum from 'src/infra/shared/enum/report-progres.enum';
import { Order } from '@modules/order/order.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';

@Injectable()
export class BossReportService {
  constructor(
    @InjectRepository(BossReport)
    private readonly bossReportRepo: Repository<BossReport>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {}

  async paginateReports(options: IPaginationOptions): Promise<Pagination<BossReport>> {
    const queryBuilder = this.bossReportRepo.createQueryBuilder('bossReport');
    queryBuilder.orderBy('bossReport.year', 'DESC').addOrderBy('bossReport.month', 'DESC');
    return paginate<BossReport>(queryBuilder, options);
  }

  async getCurrentReport(filial: Filial): Promise<BossReport> {
    const now = dayjs();
    const existing = await this.bossReportRepo.findOne({
      where: {
        year: now.year(),
        month: now.month() + 1,
      },
      relations: ['report'],
    });

    if (existing) return existing;

    const newReport = this.bossReportRepo.create({
      year: now.year(),
      month: now.month() + 1,
    });

    return await this.bossReportRepo.save(newReport);
  }

  async getReportByDate({ year, month }): Promise<BossReport> {
    const existing = await this.bossReportRepo.findOne({
      where: {
        year,
        month,
      },
    });

    if (existing) return existing;

    const newReport = this.bossReportRepo.create({
      year,
      month,
    });

    return await this.bossReportRepo.save(newReport);
  }

  async getReportsFiltered(query: ReportQueryDto, options: IPaginationOptions, user: User): Promise<Pagination<BossReport>> {
    const qb = this.bossReportRepo.createQueryBuilder('report');
    const currentYear = dayjs().year();
    const currentMonth = dayjs().month() + 1;

    const year = query.year || currentYear;

    qb.andWhere('report.year = :year', { year });

    if (!query.year || query.year === currentYear) {
      qb.andWhere('report.month <= :currentMonth', { currentMonth });
    }

    qb.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');

    return paginate<BossReport>(qb, options);
  }

  async getTotalReports(query: ReportQueryDto): Promise<{
    totalSellCount: number;
    additionalProfitTotalSum: number;
    netProfitTotalSum: number;
    totalSize: number;
    totalPlasticSum: number;
    totalInternetShopSum: number;
    totalSale: number;
    totalSaleReturn: number;
    totalCashCollection: number;
    totalDiscount: number;
    totalIncome: number;
    totalExpense: number;
    totalSum: number;
  }> {
    const qb = this.bossReportRepo.createQueryBuilder('report');
    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
    }

    const result = await qb
      .select('SUM(report.totalSellCount)', 'totalSellCount')
      .addSelect('SUM(report.additionalProfitTotalSum)', 'additionalProfitTotalSum')
      .addSelect('SUM(report.netProfitTotalSum)', 'netProfitTotalSum')
      .addSelect('SUM(report.totalSize)', 'totalSize')
      .addSelect('SUM(report.totalPlasticSum)', 'totalPlasticSum')
      .addSelect('SUM(report.totalInternetShopSum)', 'totalInternetShopSum')
      .addSelect('SUM(report.totalSale)', 'totalSale')
      .addSelect('SUM(report.totalSaleReturn)', 'totalSaleReturn')
      .addSelect('SUM(report.totalCashCollection)', 'totalCashCollection')
      .addSelect('SUM(report.totalDiscount)', 'totalDiscount')
      .addSelect('SUM(report.totalIncome)', 'totalIncome')
      .addSelect('SUM(report.totalExpense)', 'totalExpense')
      .addSelect('SUM(report.totalSum)', 'totalSum')
      .getRawOne();

    return {
      totalSellCount: parseInt(result?.totalSellCount || '0', 10),
      additionalProfitTotalSum: parseFloat(result?.additionalProfitTotalSum || '0'),
      netProfitTotalSum: parseFloat(result?.netProfitTotalSum || '0'),
      totalSize: parseFloat(result?.totalSize || '0'),
      totalPlasticSum: parseFloat(result?.totalPlasticSum || '0'),
      totalInternetShopSum: parseFloat(result?.totalInternetShopSum || '0'),
      totalSale: parseFloat(result?.totalSale || '0'),
      totalSaleReturn: parseFloat(result?.totalSaleReturn || '0'),
      totalCashCollection: parseFloat(result?.totalCashCollection || '0'),
      totalDiscount: parseFloat(result?.totalDiscount || '0'),
      totalIncome: parseFloat(result?.totalIncome || '0'),
      totalExpense: parseFloat(result?.totalExpense || '0'),
      totalSum: parseFloat(result?.totalSum || '0'),
    };
  }

  async changeValueByReport(filial: Filial, year: number, month: number): Promise<BossReport> {
    const reports = await this.reportRepo.find({
      where: { year, month },
    });

    const report = await this.getReportByDate({ year, month });
    Object.assign(report, {
      totalSellCount: 0,
      totalSize: 0,
      totalSale: 0,
      totalCashCollection: 0,
      additionalProfitTotalSum: 0,
      totalInternetShopSum: 0,
      totalDiscount: 0,
      totalPlasticSum: 0,
      netProfitTotalSum: 0,
      totalSum: 0,
      totalExpense: 0,
      totalIncome: 0,
    });

    for (const r of reports) {
      report.totalSellCount += r.totalSellCount || 0;
      report.totalSize += r.totalSize || 0;
      report.totalSale += r.totalSale || 0;
      report.totalCashCollection += r.totalCashCollection || 0;
      report.additionalProfitTotalSum += r.additionalProfitTotalSum || 0;
      report.totalInternetShopSum += r.totalInternetShopSum || 0;
      report.totalDiscount += r.totalDiscount || 0;
      report.totalPlasticSum += r.totalPlasticSum || 0;
      report.netProfitTotalSum += r.netProfitTotalSum || 0;
      report.totalSum += (r.managerSum + r.accountantSum) || 0;
      report.totalExpense += r.totalExpense || 0;
      report.totalIncome += r.totalIncome || 0;
    }

    return this.bossReportRepo.save(report);
  }

  async cancelValueReport(dto: CancelReportDto, bossReportId: string): Promise<BossReport> {
    const report = await this.reportService.findOne(dto.reportId);
    const bossReport = await this.findOne(bossReportId);
    if (report.is_cancelled) throw new BadRequestException('Report already cancelled');

    if (!report) {
      throw new BadRequestException('Kassa report is not found');
    }

    Object.assign(bossReport, {
      totalSellCount: bossReport.totalSellCount - (report.totalSellCount || 0),
      totalSize: bossReport.totalSize - (report.totalSize || 0),
      totalSale: bossReport.totalSale - (report.totalSale || 0),
      totalCashCollection: bossReport.totalCashCollection - (report.totalCashCollection || 0),
      additionalProfitTotalSum: bossReport.additionalProfitTotalSum - (report.additionalProfitTotalSum || 0),
      totalInternetShopSum: bossReport.totalInternetShopSum - (report.totalInternetShopSum || 0),
      totalDiscount: bossReport.totalDiscount - (report.totalDiscount || 0),
      totalPlasticSum: bossReport.totalPlasticSum - (report.totalPlasticSum || 0),
      netProfitTotalSum: bossReport.netProfitTotalSum - (report.netProfitTotalSum || 0),
      totalSum: bossReport.totalSum - ((report.managerSum + report.accountantSum) || 0),
      totalExpense: bossReport.totalExpense - (report.totalExpense || 0),
      totalIncome: bossReport.totalIncome - (report.totalIncome || 0),
    });
    return this.bossReportRepo.save(bossReport);
  }

  async testcreate() {
    const report = this.bossReportRepo.create({ year: 2025 });
    return await this.bossReportRepo.save(report);
  }

  async findOne(id: string) {
    const report = await this.bossReportRepo.findOne({
      where: {
        id,
      },
      relations: ['report'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async generateBossReportByYear(): Promise<BossReport[]> {
    const year = new Date().getFullYear();
    const currentMonth = dayjs().month() + 1;

    const createdOrUpdatedReports: BossReport[] = [];

    for (let month = 1; month <= 12; month++) {
      let report = await this.bossReportRepo.findOne({
        where: {
          year,
          month,
        },
      });
      let status: number;
      if (month < currentMonth) {
        status = 1;
      } else if (month === currentMonth) {
        status = 2;
      } else {
        status = 3;
      }

      if (report) {
        report.status = status;
      } else {
        report = this.bossReportRepo.create({
          year,
          month,
          status,
        });
      }

      const saved = await this.bossReportRepo.save(report);
      createdOrUpdatedReports.push(saved);
    }

    return createdOrUpdatedReports;
  }

  async generateAndLinkBossReportByYear(): Promise<BossReport[]> {
    const createdOrUpdatedReports = await this.generateBossReportByYear();

    for (const bossReport of createdOrUpdatedReports) {
      const reports = await this.reportService.findAllByYearMonthAndFilialType(
        bossReport.year,
        bossReport.month,
        FilialTypeEnum.FILIAL,
      );
      for (const report of reports) {
        report.bossReport = bossReport;
        await this.reportRepo.save(report);
      }
    }

    return createdOrUpdatedReports;
  }

  async aggregateAndSaveAnnualReports(): Promise<BossReport[]> {
    const year = new Date().getFullYear();
    const aggregatedReports: BossReport[] = [];

    for (let month = 1; month <= 12; month++) {
      const reports = await this.reportRepo.find({
        where: {
          year,
          month,
          status: ReportProgresEnum.ACCEPTED,
          filialType: FilialTypeEnum.FILIAL,
        },
      });

      const aggregated = {
        totalSellCount: 0,
        additionalProfitTotalSum: 0,
        netProfitTotalSum: 0,
        totalSize: 0,
        totalPlasticSum: 0,
        totalInternetShopSum: 0,
        totalSale: 0,
        totalSaleReturn: 0,
        totalCashCollection: 0,
        totalDiscount: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalSum: 0,
      };

      for (const br of reports) {
        aggregated.totalSellCount += br.totalSellCount || 0;
        aggregated.additionalProfitTotalSum += br.additionalProfitTotalSum || 0;
        aggregated.netProfitTotalSum += br.netProfitTotalSum || 0;
        aggregated.totalSize += br.totalSize || 0;
        aggregated.totalPlasticSum += br.totalPlasticSum || 0;
        aggregated.totalInternetShopSum += br.totalInternetShopSum || 0;
        aggregated.totalSale += br.totalSale || 0;
        aggregated.totalSaleReturn += br.totalSaleReturn || 0;
        aggregated.totalCashCollection += br.totalCashCollection || 0;
        aggregated.totalDiscount += br.totalDiscount || 0;
        aggregated.totalIncome += br.totalIncome || 0;
        aggregated.totalExpense += br.totalExpense || 0;
        aggregated.totalSum += (br.managerSum + br.accountantSum) || 0;
      }

      let bossReport = await this.bossReportRepo.findOne({
        where: { year, month },
      });

      if (!bossReport) {
        bossReport = this.bossReportRepo.create({
          year,
          month,
          ...aggregated,
          status: 1, // yoki istalgan default status
        });
      } else {
        Object.assign(bossReport, aggregated);
      }

      const saved = await this.bossReportRepo.save(bossReport);
      aggregatedReports.push(saved);
    }

    return aggregatedReports;
  }

  async createReportsForYear(): Promise<void> {
    for (let month = 1; month <= 12; month++) {
      await this.aggregateAndSaveAnnualReports();
    }
  }

  async deleteReport(id: string): Promise<void> {
    const result = await this.bossReportRepo.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Report not found');
    }
  }
  async restore(id: string): Promise<void> {
    const result = await this.bossReportRepo.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException('Report not found');
    }
  }

  async bossSumma(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.netProfitSum)', 'totalNetProfit')
      .where('order.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('order.status = :status', { status: OrderEnum.Accept })
      .getRawOne();

    return result;
  }

  // Service method
  async expenses(year: number, month: number, page: number = 1, limit: number = 10, filter?: 'boss' | 'biznes') {
    const yearNum = Number(year);
    const monthNum = Number(month);
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new Error('Year and month must be valid numbers');
    }

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
    const offset = (pageNum - 1) * limitNum;

    // Boss rasxodlari query
    const bosRasxodQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.avatar', 'avatar')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.slug = :slug', { slug: 'boss' })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.Consumption })
      .orderBy('cashflow.date', 'DESC');

    // Biznes rasxodlari query
    const biznesExpensesQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.avatar', 'avatar')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.slug IN (:...titles)', {
        titles: ['shop', 'rent', 'business', 'logistics', 'bank'],
      })
      .orderBy('cashflow.date', 'DESC');

    // Umumiy summalar uchun query (alohida querylar)
    const bossSumQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .select('SUM(cashflow.price)', 'total')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.slug = :slug', { slug: 'boss' })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.Consumption });

    const biznesSumQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .select('SUM(cashflow.price)', 'total')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.slug IN (:...titles)', {
        titles: ['shop', 'rent', 'business', 'logistics', 'bank'],
      });

    // Summalarni olish
    const [bossResult, biznesResult] = await Promise.all([bossSumQuery.getRawOne(), biznesSumQuery.getRawOne()]);

    const bossRasxodSum = Number(bossResult?.total || 0);
    const biznesRasxodSum = Number(biznesResult?.total || 0);

    // Filter bo'yicha ma'lumotlar
    let cashflows = [];
    let totalCount = 0;

    if (filter === 'boss') {
      const [items, count] = await bosRasxodQuery.skip(offset).take(limitNum).getManyAndCount();
      cashflows = items;
      totalCount = count;
    } else if (filter === 'biznes') {
      const [items, count] = await biznesExpensesQuery.skip(offset).take(limitNum).getManyAndCount();
      cashflows = items;
      totalCount = count;
    } else {
      // Agar filter bo'lmasa, ikkisini ham birlashtirish
      const [bossItems, biznesItems] = await Promise.all([
        bosRasxodQuery.skip(0).take(1000).getMany(),
        biznesExpensesQuery.skip(0).take(1000).getMany(),
      ]);

      const allItems = [...bossItems, ...biznesItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      totalCount = allItems.length;
      cashflows = allItems.slice(offset, offset + limitNum);
    }

    // Pagination ma'lumotlari
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return {
      // Summary
      summary: filter === 'boss' ? bossRasxodSum : filter === 'biznes' ? biznesRasxodSum : bossRasxodSum + biznesRasxodSum,

      // Cashflow ro'yxati
      cashflows: cashflows.map((item) => ({
        id: item.id,
        price: Number(item.price),
        date: item.date,
        type: item.type,
        comment: item.comment,
        title: item.cashflow_type?.title,
        categoryType: item.cashflow_type?.slug === 'boss' ? 'boss' : 'biznes',
        createdBy: item.createdBy || null,
        avatar: item.createdBy?.avatar || null,
      })),

      // Pagination
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
      },

      filter: filter || 'all',
    };
  }
}
