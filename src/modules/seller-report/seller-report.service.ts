import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SellerReport } from './seller-report.entity';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { QueryReportDto } from './dto';
import * as dayjs from 'dayjs';
import { UserRoleEnum } from 'src/infra/shared/enum';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';

@Injectable()
export class SellerReportService {
  constructor(
    @InjectRepository(SellerReport)
    private readonly sellerReportRepository: Repository<SellerReport>,
    @InjectRepository(SellerReportItem)
    private readonly sellerReportItemRepository: Repository<SellerReportItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async paginateReports(options: IPaginationOptions): Promise<Pagination<SellerReport>> {
    const queryBuilder = this.sellerReportRepository.createQueryBuilder('report').leftJoinAndSelect('report.user', 'user');
    return paginate<SellerReport>(queryBuilder, options);
  }

  async getCurrentReport(user: User): Promise<SellerReport> {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;

    let report = await this.sellerReportRepository.findOne({
      where: {
        user: { id: user.id },
        year,
        month,
      },
      relations: ['user'],
    });

    if (report) return report;
    report = this.sellerReportRepository.create({
      user,
      year,
      month,
      totalSellCount: 0,
      totalSellKv: 0,
      totalSellPrice: 0,
      totalDiscount: 0,
      totalPlasticSum: 0,
      additionalProfitTotalSum: 0,
      totalSaleReturnCount: 0,
      totalSaleReturnKv: 0,
      totalSaleReturnPrice: 0,
    });

    return await this.sellerReportRepository.save(report);
  }

  async getReportsFiltered(query: QueryReportDto): Promise<Pagination<SellerReport>> {
    const { userId, year, month, filialId, page = 1, limit = 10 } = query;

    const qb = this.sellerReportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.user', 'user')
      .leftJoinAndSelect('user.avatar', 'avatar') // Avatarni olib kelish
      .leftJoinAndSelect('user.filial', 'filial'); // Filialni join qilish

    if (userId) {
      qb.andWhere('user.id = :userId', { userId });
    }

    if (filialId) {
      qb.andWhere('filial.id = :filialId', { filialId });
    }

    if (year) {
      qb.andWhere('report.year = :year', { year });
    }

    if (month) {
      qb.andWhere('report.month = :month', { month });
    }

    qb.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');

    const result = await paginate<SellerReport>(qb, {
      page,
      limit,
      route: '/seller-reports',
    });

    // Fallback: agar reportlar bo‘sh va userId berilgan bo‘lsa
    if (result.items.length === 0 && userId) {
      const fallbackQb = this.sellerReportRepository
        .createQueryBuilder('report')
        .leftJoinAndSelect('report.user', 'user')
        .leftJoinAndSelect('user.avatar', 'avatar')
        .leftJoinAndSelect('user.filial', 'filial')
        .where('user.id = :userId', { userId })
        .orderBy('report.year', 'ASC')
        .addOrderBy('report.month', 'ASC');

      return paginate<SellerReport>(fallbackQb, { page, limit, route: '/seller-reports' });
    }

    return result;
  }

  async findByUserAndPeriod(userId: string, month: number, year: number): Promise<SellerReport | null> {
    try {
      // Repository orqali qidiruv
      const sellerReport = await this.sellerReportRepository.findOne({
        where: {
          user: { id: userId },
          month: month,
          year: year,
        },
        relations: ['user'],
      });

      return sellerReport || null;
    } catch (error) {
      console.error(`SellerReport topishda xatolik: userId=${userId}, month=${month}, year=${year}`, error);
      return null;
    }
  }

  async findOne(userId: string): Promise<SellerReport> {
    const report = await this.sellerReportRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException(`Seller report with id ${userId} not found`);
    }

    return report;
  }

  async getTotalReports(query: QueryReportDto): Promise<{
    totalSellCount: number;
    totalSellKv: number;
    totalSellPrice: number;
    totalDiscount: number;
    totalPlasticSum: number;
    additionalProfitTotalSum: number;
    totalSaleReturnCount: number;
    totalSaleReturnKv: number;
    totalSaleReturnPrice: number;
  }> {
    const qb = this.sellerReportRepository
      .createQueryBuilder('report')
      .select('SUM(report.totalSellCount)', 'totalSellCount')
      .addSelect('SUM(report.totalSellKv)', 'totalSellKv')
      .addSelect('SUM(report.totalSellPrice)', 'totalSellPrice')
      .addSelect('SUM(report.totalDiscount)', 'totalDiscount')
      .addSelect('SUM(report.totalPlasticSum)', 'totalPlasticSum')
      .addSelect('SUM(report.additionalProfitTotalSum)', 'additionalProfitTotalSum')
      .addSelect('SUM(report.totalSaleReturnCount)', 'totalSaleReturnCount')
      .addSelect('SUM(report.totalSaleReturnKv)', 'totalSaleReturnKv')
      .addSelect('SUM(report.totalSaleReturnPrice)', 'totalSaleReturnPrice')
      .leftJoin('report.user', 'user');

    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
    }

    if (query.month) {
      qb.andWhere('report.month = :month', { month: query.month });
    }

    if (query.userId) {
      qb.andWhere('user.id = :userId', { userId: query.userId });
    }

    const result = await qb.getRawOne();

    return {
      totalSellCount: parseInt(result.totalSellCount || '0', 10),
      totalSellKv: parseFloat(result.totalSellKv || '0'),
      totalSellPrice: parseFloat(result.totalSellPrice || '0'),
      totalDiscount: parseFloat(result.totalDiscount || '0'),
      totalPlasticSum: parseFloat(result.totalPlasticSum || '0'),
      additionalProfitTotalSum: parseFloat(result.additionalProfitTotalSum || '0'),
      totalSaleReturnCount: parseFloat(result.totalSaleReturnCount || '0'),
      totalSaleReturnKv: parseFloat(result.totalSaleReturnKv || '0'),
      totalSaleReturnPrice: parseFloat(result.totalSaleReturnPrice || '0'),
    };
  }

  async changeValueReport(
    type: 'income' | 'expense',
    body: {
      totalSellCount: number;
      totalSellKv: number;
      totalSellPrice: number;
      totalDiscount: number;
      totalPlasticSum: number;
      additionalProfitTotalSum: number;
      totalSaleReturnCount: number;
      totalSaleReturnKv: number;
      totalSaleReturnPrice: number;
      user: User;
    },
  ) {
    const currentReport = await this.getCurrentReport(body.user);
    if (type === 'income') {
      currentReport.totalSellCount += body.totalSellCount;
      currentReport.totalSellKv += body.totalSellKv;
      currentReport.totalSellPrice += body.totalSellPrice;
      currentReport.totalDiscount += body.totalDiscount;
      currentReport.totalPlasticSum += body.totalPlasticSum;
      currentReport.additionalProfitTotalSum += body.additionalProfitTotalSum;
      currentReport.totalSaleReturnCount += body.totalSaleReturnCount;
      currentReport.totalSaleReturnKv += body.totalSaleReturnKv;
      currentReport.totalSaleReturnPrice += body.totalSaleReturnPrice;
    } else {
      currentReport.totalSellCount -= body.totalSellCount;
      currentReport.totalSellKv -= body.totalSellKv;
      currentReport.totalSellPrice -= body.totalSellPrice;
      currentReport.totalDiscount -= body.totalDiscount;
      currentReport.totalPlasticSum -= body.totalPlasticSum;
      currentReport.additionalProfitTotalSum -= body.additionalProfitTotalSum;
      currentReport.totalSaleReturnCount -= body.totalSaleReturnCount;
      currentReport.totalSaleReturnKv -= body.totalSaleReturnKv;
      currentReport.totalSaleReturnPrice -= body.totalSaleReturnPrice;
    }
    return await this.sellerReportRepository.save(currentReport);
  }

  async generateMonthlyReport(year?: number, month?: number) {
    const now = dayjs();
    const targetYear = year || now.year();
    const targetMonth = month || now.month() + 1;

    const sellers = await this.userRepo.find({
      where: { position: { role: UserRoleEnum.SELLER } },
      relations: ['position'],
    });

    for (const seller of sellers) {
      const exists = await this.sellerReportRepository.findOne({
        where: { user: { id: seller.id }, year: targetYear, month: targetMonth },
      });

      if (exists) continue;

      const monthlyReport = this.sellerReportRepository.create({
        user: seller,
        year: targetYear,
        month: targetMonth,
        totalSellCount: 0,
        totalSellKv: 0,
        totalSellPrice: 0,
        totalDiscount: 0,
        totalPlasticSum: 0,
        additionalProfitTotalSum: 0,
        totalSaleReturnKv: 0,
        totalSaleReturnCount: 0,
        totalSaleReturnPrice: 0,
      });

      await this.sellerReportRepository.save(monthlyReport);
    }

    return {
      success: true,
      message: `Seller monthly reports created for ${targetYear}-${String(targetMonth).padStart(2, '0')}`,
    };
  }

  async aggregateSellerReportValues() {
    const reports = await this.sellerReportRepository.find({
      relations: ['reportItems', 'user'],
    });

    for (const report of reports) {
      report.totalSellCount = 0;
      report.totalSellKv = 0;
      report.totalSellPrice = 0;
      report.totalDiscount = 0;
      report.totalPlasticSum = 0;
      report.additionalProfitTotalSum = 0;
      report.totalSaleReturnCount = 0;
      report.totalSaleReturnKv = 0;
      report.totalSaleReturnPrice = 0;

      for (const item of report.reportItems) {
        report.totalSellCount += item.totalSellCount || 0;
        report.totalSellKv += item.totalSellKv || 0;
        report.totalSellPrice += item.totalSellPrice || 0;
        report.totalDiscount += item.totalDiscount || 0;
        report.totalPlasticSum += item.totalPlasticSum || 0;
        report.additionalProfitTotalSum += item.additionalProfitTotalSum || 0;
        report.totalSaleReturnCount += item.totalSaleReturnCount || 0;
        report.totalSaleReturnKv += item.totalSaleReturnKv || 0;
        report.totalSaleReturnPrice += item.totalSaleReturnPrice || 0;
      }

      await this.sellerReportRepository.save(report);
    }

    return {
      updatedReports: reports.length,
      message: 'All seller reports aggregated successfully',
    };
  }

  async getItemsByMonthlyReport(
    reportId: string,
    startDay?: number,
    endDay?: number,
  ): Promise<{
    startDate: string;
    endDate: string;
    totalWorkTime: number;
    totalCount: number;
    totalKv: number;
    totalPrice: number;
    totalDiscountSum: number;
    additionalProfitTotalSum: number;
  }> {
    const report = await this.sellerReportRepository.findOne({
      where: { id: reportId },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException('Monthly report not found');
    }

    const { user, year, month } = report;

    // Oyning birinchi va oxirgi kunlari
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month');
    const monthEnd = dayjs(monthStart).endOf('month');
    const daysInMonth = monthEnd.date();

    let filterStartDay = 1;
    let filterEndDay: number;

    // Agar endDay berilgan bo'lsa
    if (endDay) {
      // endDay oyning chegaralarida ekanligini tekshirish
      if (endDay < 1 || endDay > daysInMonth) {
        throw new BadRequestException(
          `End day must be between 1 and ${daysInMonth} for ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      filterEndDay = endDay;
    } else {
      // Agar endDay berilmagan bo'lsa
      const currentMonth = dayjs().month() + 1; // dayjs 0-indexed
      const currentYear = dayjs().year();

      // Agar report joriy oyga tegishli bo'lsa - bugungi kun
      if (year === currentYear && month === currentMonth) {
        filterEndDay = dayjs().date();
      } else {
        // Agar o'tgan oyga tegishli bo'lsa - o'sha oyning oxiri
        filterEndDay = daysInMonth;
      }
    }

    // Agar startDay berilgan bo'lsa
    if (startDay) {
      // startDay oyning chegaralarida ekanligini tekshirish
      if (startDay < 1 || startDay > daysInMonth) {
        throw new BadRequestException(
          `Start day must be between 1 and ${daysInMonth} for ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      filterStartDay = startDay;
    }

    // startDay endDay dan katta bo'lmasligi kerak
    if (filterStartDay > filterEndDay) {
      throw new BadRequestException('Start day cannot be greater than end day');
    }

    // To'liq sanalarni yaratish
    const startDate = `${year}-${String(month).padStart(2, '0')}-${String(filterStartDay).padStart(2, '0')}`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(filterEndDay).padStart(2, '0')}`;

    // Kunlik reportlarni olish
    const reportItems = await this.sellerReportItemRepository.find({
      where: {
        user: { id: user.id },
        date: Between(startDate, endDate),
      },
      order: {
        date: 'DESC',
      },
    });

    // Umumiy statistikani hisoblash
    const summary = reportItems.reduce(
      (acc, item) => {
        acc.totalWorkTime += item.workTime || 0;
        acc.totalCount += item.totalSellCount || 0;
        acc.totalKv += item.totalSellKv || 0;
        acc.totalPrice += item.totalSellPrice || 0;
        acc.totalDiscountSum += item.totalDiscount || 0;
        acc.additionalProfitTotalSum += item.additionalProfitTotalSum || 0;
        return acc;
      },
      {
        totalWorkTime: 0,
        totalCount: 0,
        totalKv: 0,
        totalPrice: 0,
        totalDiscountSum: 0,
        additionalProfitTotalSum: 0,
      },
    );

    return {
      startDate,
      endDate,
      ...summary,
    };
  }
}
