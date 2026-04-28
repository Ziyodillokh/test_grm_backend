import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Raw, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import * as dayjs from 'dayjs';
import { SellerReportItem } from './seller-report-item.entity';
import { QueryReportItemDto } from './dto';
import { Order } from '../order/order.entity';
import { OrderEnum, UserRoleEnum } from 'src/infra/shared/enum';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Filial } from '../filial/filial.entity';
import { SellerReport } from '../seller-report/seller-report.entity';

@Injectable()
export class SellerReportItemService {
  constructor(
    @InjectRepository(SellerReportItem)
    private readonly reportRepo: Repository<SellerReportItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SellerReport)
    private readonly sellerRepository: Repository<SellerReport>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    private readonly connection: DataSource,
  ) {}

  async paginateReports(options: IPaginationOptions): Promise<Pagination<SellerReportItem>> {
    const queryBuilder = this.reportRepo.createQueryBuilder('report').leftJoinAndSelect('report.user', 'user');
    return paginate<SellerReportItem>(queryBuilder, options);
  }

  async getCurrentReport(user: User): Promise<SellerReportItem> {
    const today = dayjs().format('YYYY-MM-DD');

    const existing = await this.reportRepo.findOne({
      where: {
        user: { id: user.id },
        date: today,
      },
      relations: ['user'],
    });

    if (existing) return existing;

    const newReport = this.reportRepo.create({
      date: today,
      totalSellCount: 0,
      totalSellKv: 0,
      totalSellPrice: 0,
      additionalProfitTotalSum: 0,
      totalPlasticSum: 0,
      totalDiscount: 0,
      totalSaleReturnCount: 0,
      totalSaleReturnKv: 0,
      totalSaleReturnPrice: 0,
      workTime: 0,
      user,
    });

    return await this.reportRepo.save(newReport);
  }

  async getReportsFiltered(query: QueryReportItemDto, options: IPaginationOptions): Promise<Pagination<SellerReportItem>> {
    const qb = this.reportRepo.createQueryBuilder('report').leftJoinAndSelect('report.user', 'user');

    if (query.userId) qb.andWhere('user.id = :userId', { userId: query.userId });
    if (query.year) qb.andWhere('report.year = :year', { year: query.year });
    if (query.month) qb.andWhere('report.month = :month', { month: query.month });

    const result = await paginate<SellerReportItem>(qb, options);

    if (result.items.length === 0 && (query.year || query.month)) {
      const initialQb = this.reportRepo
        .createQueryBuilder('report')
        .leftJoinAndSelect('report.user', 'user')
        .orderBy('report.year', 'ASC')
        .addOrderBy('report.month', 'ASC');

      if (query.userId) initialQb.andWhere('user.id = :userId', { userId: query.userId });

      return paginate<SellerReportItem>(initialQb, options);
    }

    return result;
  }

  async getTotalReports(query: QueryReportItemDto): Promise<{
    totalSellCount: number;
    totalSellKv: number;
    totalSellPrice: number;
    additionalProfitTotalSum: number;
    totalPlasticSum: number;
    totalDiscount: number;
    totalSaleReturnCount: number;
    totalSaleReturnKv: number;
    totalSaleReturnPrice: number;
  }> {
    const qb = this.reportRepo.createQueryBuilder('report').leftJoin('report.user', 'user');

    if (query.year) qb.andWhere('report.year = :year', { year: query.year });
    if (query.month) qb.andWhere('report.month = :month', { month: query.month });
    if (query.userId) qb.andWhere('user.id = :userId', { userId: query.userId });

    const result = await qb
      .select('SUM(report.totalSellCount)', 'totalSellCount')
      .addSelect('SUM(report.totalSellKv)', 'totalSellKv')
      .addSelect('SUM(report.totalSellPrice)', 'totalSellPrice')
      .addSelect('SUM(report.additionalProfitTotalSum)', 'additionalProfitTotalSum')
      .addSelect('SUM(report.totalPlasticSum)', 'totalPlasticSum')
      .addSelect('SUM(report.totalDiscount)', 'totalDiscount')
      .addSelect('SUM(report.totalSaleReturnCount)', 'totalSaleReturnCount')
      .addSelect('SUM(report.totalSaleReturnKv)', 'totalSaleReturnKv')
      .addSelect('SUM(report.totalSaleReturnPrice)', 'totalSaleReturnPrice')
      .getRawOne();

    return {
      totalSellCount: parseInt(result?.totalSellCount || '0', 10),
      totalSellKv: parseInt(result?.totalSellKv || '0'),
      totalSellPrice: parseInt(result?.totalSellPrice || '0'),
      additionalProfitTotalSum: parseFloat(result?.additionalProfitTotalSum || '0'),
      totalPlasticSum: parseFloat(result?.totalPlasticSum || '0'),
      totalDiscount: parseFloat(result?.totalDiscount || '0'),
      totalSaleReturnCount: parseFloat(result?.totalSaleReturnCount || '0'),
      totalSaleReturnKv: parseFloat(result?.totalSaleReturnKv || '0'),
      totalSaleReturnPrice: parseFloat(result?.totalSaleReturnPrice || '0'),
    };
  }

  async getSellerOrderStats(sellerId: string, startDate: string, endDate: string) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.report_item', 'report_item')
      .select('COUNT(order.id)', 'orderCount')
      .addSelect('SUM(order.kv)', 'totalKv')
      .addSelect('SUM(order.price)', 'totalPrice')
      .addSelect('SUM(order.discountSum)', 'totalDiscount')
      .addSelect('SUM(order.netProfitSum)', 'totalProfit')
      .addSelect('report_item.workTime', 'workTime')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere('order.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere('order.status = :status', { status: OrderEnum.Accept })
      .groupBy('report_item.workTime')
      .getRawOne();

    return {
      orderCount: Number(result.orderCount || 0),
      totalKv: Number(result.totalKv || 0),
      totalPrice: Number(result.totalPrice || 0),
      totalDiscount: Number(result.totalDiscount || 0),
      totalProfit: Number(result.totalProfit || 0),
      workTime: result.workTime || null,
    };
  }

  async generateDailyReportsForAllSellers(): Promise<void> {
    const date = dayjs().format('YYYY-MM-DD');

    const allFilials = await this.filialRepository.find();

    for (const filial of allFilials) {
      const sellers = await this.userRepository.find({
        where: {
          filial: { id: filial.id },
          position: { role: UserRoleEnum.SELLER },
        },
        relations: ['filial', 'position'],
      });

      for (const seller of sellers) {
        const existing = await this.reportRepo.findOne({
          where: {
            user: { id: seller.id },
            date,
          },
          relations: ['user'],
        });

        if (!existing) {
          const report = this.reportRepo.create({
            user: seller,
            date,
          });

          await this.reportRepo.save(report);
        }
      }
    }
  }

  async getOrdersByDateRange(
    reportId: string,
    options: IPaginationOptions,
    startDay?: number,
    endDay?: number,
  ): Promise<Pagination<Order>> {
    // Hisobotni topish
    const report = await this.sellerRepository.findOne({
      where: { id: reportId },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const { user, year, month } = report;
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month');
    const monthEnd = dayjs(monthStart).endOf('month');
    const daysInMonth = monthEnd.date();

    let filterStartDay = 1;
    let filterEndDay: number;

    // Tugash kunini tekshirish
    if (endDay) {
      if (endDay < 1 || endDay > daysInMonth) {
        throw new BadRequestException(
          `End day must be between 1 and ${daysInMonth} for ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      filterEndDay = endDay;
    } else {
      const currentMonth = dayjs().month() + 1;
      const currentYear = dayjs().year();
      filterEndDay = year === currentYear && month === currentMonth ? dayjs().date() : daysInMonth;
    }

    // Boshlanish kunini tekshirish
    if (startDay) {
      if (startDay < 1 || startDay > daysInMonth) {
        throw new BadRequestException(
          `Start day must be between 1 and ${daysInMonth} for ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      filterStartDay = startDay;
    }

    if (filterStartDay > filterEndDay) {
      throw new BadRequestException('Start day cannot be greater than end day');
    }

    // Sana oralig'ini yaratish
    const startDate = `${year}-${String(month).padStart(2, '0')}-${String(filterStartDay).padStart(2, '0')}`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(filterEndDay).padStart(2, '0')}`;
    const startDateTime = dayjs(startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const endDateTime = dayjs(endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss');

    // Query builder yaratish
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.size', 'size')
      .where('seller.id = :sellerId', { sellerId: user.id })
      .andWhere('order.status = :status', { status: OrderEnum.Accept })
      .andWhere('order.date >= :startDateTime', { startDateTime })
      .andWhere('order.date <= :endDateTime', { endDateTime });

    return paginate<Order>(queryBuilder, options);
  }

  async linkAllItemsToMonthlyReports() {
    const items = await this.reportRepo.find({
      relations: ['user'],
    });

    let linked = 0;

    for (const item of items) {
      const year = dayjs(item.date).year();
      const month = dayjs(item.date).month() + 1;

      let report = await this.sellerRepository.findOne({
        where: {
          user: { id: item.user.id },
          year,
          month,
        },
      });

      // Agar oylik report topilmasa, yangisini yaratamiz
      if (!report) {
        report = this.sellerRepository.create({
          user: item.user,
          year,
          month,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalDiscount: 0,
          totalPlasticSum: 0,
          additionalProfitTotalSum: 0,
          totalSaleReturnPrice: 0,
        });
        report = await this.sellerRepository.save(report);
      }

      item.report = report;
      await this.reportRepo.save(item);
      linked++;
    }

    return {
      message: 'SellerReportItem lar tegishli oylik reportlarga bog‘landi (kerak bo‘lsa yaratildi ham)',
      linkedItemsCount: linked,
    };
  }

  async recalculateAllSellerReportItems(): Promise<{
    message: string;
    processedOrders: number;
    updatedReportItems: number;
  }> {
    await this.reportRepo.update(
      {},
      {
        totalSellCount: 0,
        totalSellKv: 0,
        totalSellPrice: 0,
        additionalProfitTotalSum: 0,
        totalPlasticSum: 0,
        totalDiscount: 0,
        totalSaleReturnCount: 0,
        totalSaleReturnKv: 0,
        totalSaleReturnPrice: 0,
        workTime: 0,
      },
    );

    const allOrders = await this.orderRepository.find({
      where: [{ status: OrderEnum.Accept }, { status: OrderEnum.Reject }, { status: OrderEnum.Return }],
      relations: ['product', 'product.bar_code', 'seller'],
    });

    const updatedReportItems = new Set<string>();
    let processedOrders = 0;

    for (const order of allOrders) {
      if (!order.seller?.id) continue;

      const orderDate = dayjs(order.date).format('YYYY-MM-DD');

      let reportItem = await this.reportRepo.findOne({
        where: {
          user: { id: order.seller.id },
          date: orderDate,
        },
        relations: ['user'],
      });

      if (!reportItem) {
        const user = await this.userRepository.findOne({
          where: { id: order.seller.id },
        });

        if (user) {
          reportItem = this.reportRepo.create({
            user,
            date: orderDate,
            totalSellCount: 0,
            totalSellKv: 0,
            totalSellPrice: 0,
            additionalProfitTotalSum: 0,
            totalPlasticSum: 0,
            totalDiscount: 0,
            totalSaleReturnCount: 0,
            totalSaleReturnKv: 0,
            totalSaleReturnPrice: 0,
            workTime: 0,
          });
          reportItem = await this.reportRepo.save(reportItem);
        } else {
          continue;
        }
      }

      if (order.status === OrderEnum.Accept) {
        let countToAdd = 0;
        if (!order.bar_code && !order.product) {
          countToAdd = 1;
        } else {
          countToAdd = order.product.bar_code?.isMetric ? 1 : order.x || 0;
        }

        reportItem.totalSellCount += countToAdd;
        reportItem.totalSellKv += order.kv || 0;
        reportItem.totalSellPrice += order.price || 0;
        reportItem.additionalProfitTotalSum += order.netProfitSum || 0;
        reportItem.totalPlasticSum += order.plasticSum || 0;
        reportItem.totalDiscount += order.discountSum || 0;
      } else if (order.status === OrderEnum.Reject || order.status === OrderEnum.Return) {
        let returnCountToAdd = 0;
        if (!order.bar_code && !order.product) {
          returnCountToAdd = 1;
        } else {
          returnCountToAdd = order.product.bar_code?.isMetric ? 1 : order.x || 0;
        }

        reportItem.totalSaleReturnCount += returnCountToAdd;
        reportItem.totalSaleReturnKv += order.kv || 0;
        reportItem.totalSaleReturnPrice += order.price || 0;
      }

      order.report_item = reportItem;

      await this.reportRepo.save(reportItem);
      await this.orderRepository.save(order);

      updatedReportItems.add(reportItem.id);
      processedOrders++;
    }

    return {
      message: "Barcha orderlar kunlik seller report itemlarga bog'landi va hisoblandi",
      processedOrders,
      updatedReportItems: updatedReportItems.size,
    };
  }
}
