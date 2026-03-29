import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { FactoryReportItem } from './factory-report-item.entity';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { FilterFactoryReportDto, FilterMonthlyFactoryReportDto } from './dto/filter-factory-report.dto';
import * as dayjs from 'dayjs';
import { OrderEnum } from 'src/infra/shared/enum';
import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Factory } from '@modules/factory/factory.entity';
import { ReportService } from '@modules/report/report.service';

export interface FactoryGroup {
  factory: any;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
  items?: FactoryReportItem[];
}

export interface FactoryStockGroup {
  factory: any;
  totalCount: number;
  totalKv: number;
  totalPrice: number;
}

export interface FactoryCombinedResult {
  factory: any;
  totalCount: number;
  totalKv: number;
  totalPrice: number;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
}

export interface FactoryOverallTotals {
  totalCount: number;
  totalKv: number;
  totalPrice: number;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
}

@Injectable()
export class FactoryReportService {
  constructor(
    @InjectRepository(FactoryReportItem)
    private readonly reportRepo: Repository<FactoryReportItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Factory)
    private readonly factoryRepository: Repository<Factory>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {
  }

  async findAllReports(dto: FilterFactoryReportDto) {
    const { from, to, filialId, factoryId } = dto;
    const { page, limit } = this.validatePagination(dto.page, dto.limit);

    const { fromDate, toDate } = this.getDateRange(from, to);

    try {
      const where = this.buildWhereCondition(fromDate.toDate(), toDate.toDate(), filialId, factoryId);

      // Sotuv ma'lumotlarini olish
      const salesData = await this.getSalesData(where);

      // Ombor ma'lumotlarini olish (yil boshidan)
      const yearStart = dayjs().startOf('year').toDate();
      const stockWhere = this.buildWhereCondition(yearStart, toDate.toDate(), filialId, factoryId);
      const stockData = await this.getStockData(stockWhere);

      // Ma'lumotlarni guruhlash va birlashtirish
      const groupedSales = this.groupSalesData(salesData);
      const groupedStock = this.groupStockData(stockData);
      const combinedResult = this.combineResults(groupedSales, groupedStock);

      // Pagination va umumiy hisoblar
      const paginatedData = this.paginateResults(combinedResult, page, limit);
      const overallTotals = this.calculateOverallTotals(combinedResult);

      this.logResults(groupedSales, combinedResult, overallTotals);

      return this.formatResponse(paginatedData, combinedResult.length, page, limit, overallTotals);
    } catch (error) {
      console.error('❌ Xatolik:', error.message);
      throw new InternalServerErrorException('Ma\'lumotlarni olishda xatolik yuz berdi', error.message);
    }
  }

  async findMonthlyFactoryReports(dto: FilterMonthlyFactoryReportDto) {
    const { year, month, filialId, factoryId, country } = dto;
    const { page, limit } = this.validatePagination(dto.page, dto.limit);

    const { targetYear, targetMonth, monthStart, monthEnd } = this.validateAndParseMonth(year, month);

    try {
      // Tanlangan oydagi sotuv ma'lumotlari
      const salesWhere = this.buildWhereCondition(monthStart.toDate(), monthEnd.toDate(), filialId, factoryId, country);
      const salesData = await this.getSalesData(salesWhere);

      // Yil boshidan tanlangan oy oxirigacha ombor ma'lumotlari
      const yearStart = dayjs().year(targetYear).startOf('year').toDate();
      const stockWhere = this.buildWhereCondition(yearStart, monthEnd.toDate(), filialId, factoryId, country);
      const stockData = await this.getStockData(stockWhere);

      // Ma'lumotlarni guruhlash va birlashtirish
      const groupedSales = this.groupSalesData(salesData);
      const groupedStock = this.groupStockData(stockData);
      const combinedResult = this.combineResults(groupedSales, groupedStock);

      // Pagination va umumiy hisoblar
      const paginatedData = this.paginateResults(combinedResult, page, limit);
      const overallTotals = this.calculateOverallTotals(combinedResult);

      return this.formatMonthlyResponse(
        paginatedData,
        combinedResult.length,
        page,
        limit,
        overallTotals,
        targetYear,
        targetMonth,
        monthStart,
        monthEnd,
      );
    } catch (error) {
      throw new InternalServerErrorException('Ma\'lumotlarni olishda xatolik yuz berdi', error.message);
    }
  }

  async createDailyReport(date: string = dayjs().format('YYYY-MM-DD')) {
    const targetDate = dayjs(date);
    const startOfDay = targetDate.startOf('day').toDate();
    const endOfDay = targetDate.endOf('day').toDate();

    const orders = await this.getOrdersForDate(startOfDay, endOfDay);
    const products = await this.getProductsForDate(startOfDay, endOfDay);

    const grouped = this.groupOrdersAndProducts(orders, products);

    for (const [key, group] of grouped.entries()) {
      const [filialId, factoryId] = key.split('|');
      const reportData = this.calculateReportData(group, targetDate);

      await this.saveOrUpdateReport(reportData, targetDate.toDate(), filialId, factoryId);
    }
  }

  async seedHistorical() {
    const allDates = await this.getAllUniqueDates();

    for (const date of allDates) {
      try {
        await this.createDailyReport(date);
      } catch (error) {
        console.error(`❌ Error creating factory report for date: ${date}`, error);
      }
    }
  }

  // Private helper methods

  private validatePagination(page?: number | string, limit?: number | string) {
    const parsedPage = typeof page === 'string' ? parseInt(page) : page || 1;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : limit || 10;

    return {
      page: parsedPage < 1 ? 1 : parsedPage,
      limit: parsedLimit < 1 ? 10 : parsedLimit,
    };
  }

  private getDateRange(from?: string | Date, to?: string | Date) {
    const today = dayjs();

    if (!from || !to) {
      return {
        fromDate: today.startOf('month'),
        toDate: today,
      };
    }

    const fromDate = dayjs(from);
    const toDate = dayjs(to);

    if (!fromDate.isValid() || !toDate.isValid()) {
      throw new BadRequestException('Noto\'g\'ri sana formati');
    }

    if (fromDate.isAfter(toDate)) {
      throw new BadRequestException('Boshlanish sanasi tugash sanasidan katta bo\'lmasligi kerak');
    }

    return { fromDate, toDate };
  }

  private validateAndParseMonth(year?: number | string, month?: number | string) {
    const today = dayjs();
    const parsedYear = year ? (typeof year === 'string' ? parseInt(year) : year) : today.year();
    const parsedMonth = month ? (typeof month === 'string' ? parseInt(month) : month) : today.month() + 1;

    if (parsedYear < 2000 || parsedYear > today.year() + 10) {
      throw new BadRequestException('Noto\'g\'ri yil formati');
    }

    if (parsedMonth < 1 || parsedMonth > 12) {
      throw new BadRequestException('Noto\'g\'ri oy formati (1-12 oralig\'ida bo\'lishi kerak)');
    }

    const monthStart = dayjs()
      .year(parsedYear)
      .month(parsedMonth - 1)
      .startOf('month');
    const monthEnd = dayjs()
      .year(parsedYear)
      .month(parsedMonth - 1)
      .endOf('month');

    return {
      targetYear: parsedYear,
      targetMonth: parsedMonth,
      monthStart,
      monthEnd,
    };
  }

  private buildWhereCondition(
    fromDate: Date,
    toDate: Date,
    filialId?: string,
    factoryId?: string,
    country?: string,
  ): FindOptionsWhere<FactoryReportItem> {
    const where: FindOptionsWhere<FactoryReportItem> = {
      date: Between(fromDate, toDate),
    };

    if (filialId) {
      where.filial = { id: filialId };
    }

    if (factoryId) {
      where.factory = { id: factoryId };
    }

    if (country) {
      where.factory = { ...(factoryId && { id: factoryId }), country: { id: country } };
    }

    return where;
  }

  private async getSalesData(where: FindOptionsWhere<FactoryReportItem>) {
    return this.reportRepo.find({
      where,
      relations: ['filial', 'factory'],
      order: { date: 'DESC' },
    });
  }

  private async getStockData(where: FindOptionsWhere<FactoryReportItem>) {
    return this.reportRepo.find({
      where,
      relations: ['factory'],
      select: {
        totalCount: true,
        totalKv: true,
        totalPrice: true,
        factory: {
          id: true,
          title: true,
        },
      },
    });
  }

  private groupSalesData(salesData: FactoryReportItem[]): Map<string, FactoryGroup> {
    const grouped = new Map<string, FactoryGroup>();

    for (const item of salesData) {
      const factoryKey = item.factory?.id?.toString() || 'unknown';

      if (!grouped.has(factoryKey)) {
        grouped.set(factoryKey, {
          factory: item.factory,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          items: [],
        });
      }

      const group = grouped.get(factoryKey)!;
      group.totalSellCount += Number(item.totalSellCount || 0);
      group.totalSellKv += Number(item.totalSellKv || 0);
      group.totalSellPrice += Number(item.totalSellPrice || 0);
      group.items!.push(item);
    }

    return grouped;
  }

  private groupStockData(stockData: FactoryReportItem[]): Map<string, FactoryStockGroup> {
    const grouped = new Map<string, FactoryStockGroup>();

    for (const item of stockData) {
      const factoryKey = item.factory?.id?.toString() || 'unknown';

      if (!grouped.has(factoryKey)) {
        grouped.set(factoryKey, {
          factory: item.factory,
          totalCount: 0,
          totalKv: 0,
          totalPrice: 0,
        });
      }

      const group = grouped.get(factoryKey)!;
      group.totalCount += Number(item.totalCount || 0);
      group.totalKv += Number(item.totalKv || 0);
      group.totalPrice += Number(item.totalPrice || 0);
    }

    return grouped;
  }

  private combineResults(
    salesGroups: Map<string, FactoryGroup>,
    stockGroups: Map<string, FactoryStockGroup>,
  ): FactoryCombinedResult[] {
    const result: FactoryCombinedResult[] = [];
    const allFactoryKeys = new Set([...salesGroups.keys(), ...stockGroups.keys()]);

    for (const factoryKey of allFactoryKeys) {
      const sellGroup = salesGroups.get(factoryKey);
      const stockGroup = stockGroups.get(factoryKey);

      result.push({
        factory: sellGroup?.factory || stockGroup?.factory,
        totalCount: stockGroup?.totalCount || 0,
        totalKv: stockGroup?.totalKv || 0,
        totalPrice: stockGroup?.totalPrice || 0,
        totalSellCount: sellGroup?.totalSellCount || 0,
        totalSellKv: sellGroup?.totalSellKv || 0,
        totalSellPrice: sellGroup?.totalSellPrice || 0,
      });
    }

    return result;
  }

  private paginateResults(results: FactoryCombinedResult[], page: number, limit: number): FactoryCombinedResult[] {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return results.slice(startIndex, endIndex);
  }

  private calculateOverallTotals(results: FactoryCombinedResult[]): FactoryOverallTotals {
    return results.reduce(
      (acc, item) => {
        acc.totalCount += Number(item.totalCount || 0);
        acc.totalKv += Number(item.totalKv || 0);
        acc.totalPrice += Number(item.totalPrice || 0);
        acc.totalSellCount += Number(item.totalSellCount || 0);
        acc.totalSellKv += Number(item.totalSellKv || 0);
        acc.totalSellPrice += Number(item.totalSellPrice || 0);
        return acc;
      },
      {
        totalCount: 0,
        totalKv: 0,
        totalPrice: 0,
        totalSellCount: 0,
        totalSellKv: 0,
        totalSellPrice: 0,
      },
    );
  }

  private logResults(
    groupedSales: Map<string, FactoryGroup>,
    combinedResult: FactoryCombinedResult[],
    overallTotals: FactoryOverallTotals,
  ) {
    for (const [key, value] of groupedSales.entries()) {
      console.log(`🏭 ${key}: count=${value.totalSellCount}, kv=${value.totalSellKv}, price=${value.totalSellPrice}`);
    }

    console.log('📊 Yakuniy factory natijalari:');
    combinedResult.forEach((r) => {
      console.log(
        `🏭 ${r.factory?.title}: sotuv ${r.totalSellPrice}, qoldiq ${r.totalPrice}, count ${r.totalSellCount}/${r.totalCount}`,
      );
    });

    console.log('📈 Umumiy yig\'indi:', overallTotals);
  }

  private formatResponse(
    data: FactoryCombinedResult[],
    total: number,
    page: number,
    limit: number,
    totals: FactoryOverallTotals,
  ) {
    return {
      data,
      meta: {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        totals,
      },
    };
  }

  private formatMonthlyResponse(
    data: FactoryCombinedResult[],
    total: number,
    page: number,
    limit: number,
    totals: FactoryOverallTotals,
    year: number,
    month: number,
    monthStart: dayjs.Dayjs,
    monthEnd: dayjs.Dayjs,
  ) {
    return {
      data,
      meta: {
        period: {
          year,
          month,
          fromDate: monthStart.format('YYYY-MM-DD'),
          toDate: monthEnd.format('YYYY-MM-DD'),
          description: `Astatka: ${year} yil boshidan ${month}-oy oxirigacha. Prodaja: faqat ${month}-oyda sotilgan`,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        totals,
      },
    };
  }

  private async getOrdersForDate(startOfDay: Date, endOfDay: Date) {
    // Order entity still uses string dates, so convert to string format
    const startStr = dayjs(startOfDay).format('YYYY-MM-DD HH:mm:ss');
    const endStr = dayjs(endOfDay).format('YYYY-MM-DD HH:mm:ss');

    return this.orderRepo.find({
      where: {
        date: Between(startStr, endStr),
        status: OrderEnum.Accept,
      },
      relations: {
        kassa: { filial: true },
        bar_code: { factory: true },
      },
    });
  }

  private async getProductsForDate(startOfDay: Date, endOfDay: Date) {
    // Product entity still uses string dates, so convert to string format
    const startStr = dayjs(startOfDay).format('YYYY-MM-DD HH:mm:ss');
    const endStr = dayjs(endOfDay).format('YYYY-MM-DD HH:mm:ss');

    return this.productRepo.find({
      where: {
        date: Between(startStr, endStr),
      },
      relations: {
        filial: true,
        bar_code: {
          factory: true,
          size: true,
          collection: {
            collection_prices: true,
          },
        },
      },
    });
  }

  private groupOrdersAndProducts(orders: Order[], products: Product[]) {
    const grouped = new Map<string, { orders: Order[]; products: Product[] }>();

    // Orders guruhlash
    for (const order of orders) {
      const filialId = order.kassa?.filial?.id;
      const factoryId = order.bar_code?.factory?.id;
      if (!filialId || !factoryId) continue;

      const key = `${filialId}|${factoryId}`;
      if (!grouped.has(key)) grouped.set(key, { orders: [], products: [] });
      grouped.get(key)!.orders.push(order);
    }

    // Products guruhlash
    for (const product of products) {
      const filialId = product.filial?.id;
      const factoryId = product.bar_code?.factory?.id;
      if (!filialId || !factoryId) continue;

      const key = `${filialId}|${factoryId}`;
      if (!grouped.has(key)) grouped.set(key, { orders: [], products: [] });
      grouped.get(key)!.products.push(product);
    }

    return grouped;
  }

  private calculateReportData(group: { orders: Order[]; products: Product[] }, targetDate: dayjs.Dayjs) {
    const { orders, products } = group;

    // Sotuv hisoblamalari
    const totalSellCount = orders.reduce((sum, o) => {
      const count = o.bar_code?.isMetric ? 1 : Number(o.x ?? 0);
      return sum + count;
    }, 0);

    const totalSellKv = orders.reduce((sum, o) => sum + Number(o.kv ?? 0), 0);
    const totalSellPrice = orders.reduce((sum, o) => sum + Number(o.price ?? 0), 0);

    // Ombor hisoblamalari
    const totalCount = products.reduce((sum, p) => {
      const count = p.bar_code?.isMetric ? 1 : Number(p.count ?? 0);
      return sum + count;
    }, 0);

    const totalKv = products.reduce((sum, p) => {
      return sum + Number(p.bar_code?.size?.x ?? 0) * Number(p.y ?? 0) * Number(p.count ?? 0);
    }, 0);

    const totalPrice = products.reduce((sum, p) => {
      const priceMeter = p.bar_code?.collection?.collection_prices?.[0]?.priceMeter ?? 0;
      return sum + Number(p.bar_code?.size?.x ?? 0) * Number(p.y ?? 0) * Number(priceMeter);
    }, 0);

    return {
      year: targetDate.year(),
      month: targetDate.month() + 1,
      day: targetDate.date(),
      totalSellCount,
      totalSellKv,
      totalSellPrice,
      totalCount,
      totalKv,
      totalPrice,
    };
  }

  private async saveOrUpdateReport(reportData: any, date: Date, filialId: string, factoryId: string) {
    const existing = await this.reportRepo.findOne({
      where: {
        date,
        filial: { id: filialId },
        factory: { id: factoryId },
      },
    });

    if (existing) {
      Object.assign(existing, reportData);
      await this.reportRepo.save(existing);
    } else {
      const report = new FactoryReportItem();
      Object.assign(report, reportData);
      report.date = date;
      report.filial = { id: filialId } as any;
      report.factory = { id: factoryId } as any;
      await this.reportRepo.save(report);
    }
  }

  private async getAllUniqueDates(): Promise<string[]> {
    const orderDates = await this.orderRepo
      .createQueryBuilder('o')
      .select('DATE_TRUNC(\'day\', o.date)', 'date')
      .groupBy('date')
      .getRawMany();

    const productDates = await this.productRepo
      .createQueryBuilder('product')
      .select('DATE_TRUNC(\'day\', product.date)', 'date')
      .groupBy('date')
      .getRawMany();

    const allDatesSet = new Set<string>();

    [...orderDates, ...productDates].forEach((d) => {
      allDatesSet.add(dayjs(d.date).format('YYYY-MM-DD'));
    });

    return Array.from(allDatesSet);
  }

  async getFactoriesReport(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    country?: string,
    month?: number | string,
    year?: number | string,
  ) {
    const skip = (page - 1) * limit;

    // === Compute last day of given month/year ===
    let dateFilter: Date | null = null;
    if (month && year) {
      // Example: month=2, year=2025 -> Feb 28, 2025 23:59:59
      dateFilter = new Date(+year, +month, 0, 23, 59, 59);
    }

    // === Dynamic WHERE builder ===
    const conditions: string[] = [
      'p.count > 0',
      'p.y > 0.1',
      'p.is_deleted = false',
      `f.type != 'dealer'`,
    ];

    const params: any[] = [];

    if (filialId) {
      params.push(filialId);
      conditions.push(`p."filialId" = $${params.length}`);
    }

    if (country) {
      params.push(country);
      conditions.push(`q."countryId" = $${params.length}`);
    }

    if (dateFilter) {
      params.push(dateFilter);
      conditions.push(`p.date <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // === Main Query (paginated) ===
    const mainQuery = `
    WITH latest_price AS (
      SELECT DISTINCT ON (cp."collectionId") 
        cp."collectionId", 
        cp."priceMeter"
      FROM "collection-price" cp
      WHERE cp.type = 'filial'
      ORDER BY cp."collectionId", cp."date" DESC
    )
    SELECT 
      json_build_object('id', fa.id, 'title', fa.title) AS factory,
      COALESCE(SUM(s.x * p.y * p.count), 0) AS "totalKv",
      COALESCE(SUM(p.count), 0) AS "totalCount",
      COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) AS "totalPrice"
    FROM product p
      INNER JOIN qrbase q ON p."barCodeId" = q.id
      INNER JOIN size s ON q."sizeId" = s.id
      INNER JOIN collection c ON q."collectionId" = c.id
      INNER JOIN latest_price lp ON c.id = lp."collectionId"
      INNER JOIN factory fa ON q."factoryId" = fa.id
      INNER JOIN filial f ON p."filialId" = f.id
    WHERE ${whereClause}
    GROUP BY fa.id, fa.title
    ORDER BY fa.title ASC
    OFFSET ${skip}
    LIMIT ${limit};
  `;

    // === Totals + total factories ===
    const totalsQuery = `
    WITH latest_price AS (
      SELECT DISTINCT ON (cp."collectionId") 
        cp."collectionId", 
        cp."priceMeter"
      FROM "collection-price" cp
      WHERE cp.type = 'filial'
      ORDER BY cp."collectionId", cp."date" DESC
    )
    SELECT 
      COUNT(DISTINCT fa.id) AS "totalFactories",
      COALESCE(SUM(s.x * p.y * p.count), 0) AS "totalKv",
      COALESCE(SUM(p.count), 0) AS "totalCount",
      COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) AS "totalPrice"
    FROM product p
      INNER JOIN qrbase q ON p."barCodeId" = q.id
      INNER JOIN size s ON q."sizeId" = s.id
      INNER JOIN collection c ON q."collectionId" = c.id
      INNER JOIN latest_price lp ON c.id = lp."collectionId"
      INNER JOIN factory fa ON q."factoryId" = fa.id
      INNER JOIN filial f ON p."filialId" = f.id
    WHERE ${whereClause};
  `;

    // === Execute both queries in parallel ===
    const [rows, totals] = await Promise.all([
      this.dataSource.query(mainQuery, params),
      this.dataSource.query(totalsQuery, params),
    ]);

    // === Format results ===
    const total = Number(totals?.[0]?.totalFactories || 0);
    const totalsRow = totals?.[0] || {};

    return {
      data: rows.map((r) => ({
        factory: r.factory,
        totalCount: +(Number(r.totalCount || 0).toFixed(2)),
        totalKv: +(Number(r.totalKv || 0).toFixed(2)),
        totalPrice: +(Number(r.totalPrice || 0).toFixed(2)),
        totalSellCount: 0,
        totalSellKv: 0,
        totalSellPrice: 0,
        totalNetProfitSum: 0,
      })),
      meta: {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        totals: {
          totalCount: +(Number(totalsRow.totalCount || 0).toFixed(2)),
          totalKv: +(Number(totalsRow.totalKv || 0).toFixed(2)),
          totalPrice: +(Number(totalsRow.totalPrice || 0).toFixed(2)),
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalNetProfitSum: 0,
        },
      },
    };
  }

  async getFactoriesOrderReport(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    countryId?: string,
    month?: number | string,
    year?: number | string,
  ) {
    const skip = (page - 1) * limit;

    // === Compute date range for month/year filter ===
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (month && year) {
      dateFrom = new Date(+year, +month - 1, 1, 0, 0, 0);       // first day
      dateTo = new Date(+year, +month, 0, 23, 59, 59);          // last day
    }

    if (filialId === '#dealers') {
      console.log('dealers');
      return await this.reportService.getByPackage({
        mode: 'factory',
        page,
        limit,
        search: null,
        toId: null,
        month,
        year,
        package_id: null,
      });
    }

    // === Subquery: latest collection price ===
    const latestPriceSubQuery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ON (cp."collectionId") cp."collectionId"', 'collectionId')
      .addSelect('cp."priceMeter"', 'priceMeter')
      .from('collection-price', 'cp')
      .where(`cp.type = 'filial'`)
      .orderBy('cp."collectionId"')
      .addOrderBy('cp."date"', 'DESC');

    // === Base WHERE conditions ===
    const baseWhere = [`o.status = 'accepted'`];
    if (filialId) baseWhere.push('f.id = :filialId');
    if (countryId) baseWhere.push('co.id = :countryId');
    if (dateFrom && dateTo) {
      baseWhere.push('o."date" BETWEEN :dateFrom AND :dateTo');
    }

    const params = {
      ...latestPriceSubQuery.getParameters(),
      filialId,
      countryId,
      dateFrom,
      dateTo,
    };

    // === Main Query (Paginated) ===
    const query = this.orderRepo
      .createQueryBuilder('o')
      .select([
        `json_build_object('id', fa.id, 'title', fa.title) as factory`,
        `COALESCE(SUM(o.kv), 0) as "totalKv"`,
        `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
        `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalPrice"`,
        `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
      ])
      .innerJoin('o.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin('q.country', 'co')
      .innerJoin('q.factory', 'fa')
      .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
      .innerJoin('o.product', 'p')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .groupBy('fa.id')
      .addGroupBy('fa.title')
      .orderBy('fa.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters(params);

    // === Totals & Total factories count ===
    const [rows, totalResult, totals] = await Promise.all([
      query.getRawMany(),

      // Count total factories
      this.orderRepo
        .createQueryBuilder('o')
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.factory', 'fa')
        .innerJoin('q.country', 'co')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .where(baseWhere.join(' AND '))
        .select('COUNT(DISTINCT fa.id)', 'total')
        .setParameters(params)
        .getRawOne(),

      // Totals (sum)
      this.orderRepo
        .createQueryBuilder('o')
        .select([
          `COALESCE(SUM(o.kv), 0) as "totalKv"`,
          `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
          `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalPrice"`,
          `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
        ])
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.collection', 'c')
        .innerJoin('q.factory', 'fa')
        .innerJoin('q.country', 'co')
        .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .where(baseWhere.join(' AND '))
        .setParameters(params)
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    // === Final Response ===
    return {
      data: rows.map((r) => ({
        factory: r.factory,
        totalKv: +(Number(r.totalKv).toFixed(2)),
        totalCount: +(Number(r.totalCount).toFixed(2)),
        totalPrice: +(Number(r.totalPrice).toFixed(2)),
        totalNetProfitPrice: +(Number(r.totalNetProfitPrice).toFixed(2)),
        totalSellCount: 0,
        totalSellKv: 0,
        totalSellPrice: 0,
        totalNetProfitSum: 0,
      })),
      meta: {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        totals: {
          totalKv: +(Number(totals?.totalKv || 0).toFixed(2)),
          totalCount: +(Number(totals?.totalCount || 0).toFixed(2)),
          totalPrice: +(Number(totals?.totalPrice || 0).toFixed(2)),
          totalNetProfitPrice: +(Number(totals?.totalNetProfitPrice || 0).toFixed(2)),
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalNetProfitSum: 0,
        },
      },
    };
  }
}
