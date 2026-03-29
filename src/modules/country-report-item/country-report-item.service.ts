import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { CountryReportItem } from './country-report-item.entity';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { FilterCountryReportDto, FilterMonthlyCountryReportDto } from './dto/filter-country-report.dto';
import * as dayjs from 'dayjs';
import { OrderEnum } from 'src/infra/shared/enum';
import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Country } from '@modules/country/country.entity';
import { ReportService } from '@modules/report/report.service';

export interface CountryGroup {
  country: any;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
  items?: CountryReportItem[];
}

export interface CountryStockGroup {
  country: any;
  totalCount: number;
  totalKv: number;
  totalPrice: number;
}

export interface CountryCombinedResult {
  country: any;
  totalCount: number;
  totalKv: number;
  totalPrice: number;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
}

export interface CountryOverallTotals {
  totalCount: number;
  totalKv: number;
  totalPrice: number;
  totalSellCount: number;
  totalSellKv: number;
  totalSellPrice: number;
}

@Injectable()
export class CountryReportService {
  constructor(
    @InjectRepository(CountryReportItem)
    private readonly reportRepo: Repository<CountryReportItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
  ) {
  }

  async findAllReports(dto: FilterCountryReportDto) {
    const { from, to, filialId, countryId } = dto;
    const { page, limit } = this.validatePagination(dto.page, dto.limit);

    const { fromDate, toDate } = this.getDateRange(from, to);

    try {
      const where = this.buildWhereCondition(fromDate.toDate(), toDate.toDate(), filialId, countryId);

      // Sotuv ma'lumotlarini olish
      const salesData = await this.getSalesData(where);

      // Ombor ma'lumotlarini olish (yil boshidan)
      const yearStart = dayjs().startOf('year').toDate();
      const stockWhere = this.buildWhereCondition(yearStart, toDate.toDate(), filialId, countryId);
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

  async findMonthlyCountryReports(dto: FilterMonthlyCountryReportDto) {
    const { year, month, filialId, countryId } = dto;
    const { page, limit } = this.validatePagination(dto.page, dto.limit);

    const { targetYear, targetMonth, monthStart, monthEnd } = this.validateAndParseMonth(year, month);

    try {
      // Tanlangan oydagi sotuv ma'lumotlari
      const salesWhere = this.buildWhereCondition(monthStart.toDate(), monthEnd.toDate(), filialId, countryId);
      const salesData = await this.getSalesData(salesWhere);

      // Yil boshidan tanlangan oy oxirigacha ombor ma'lumotlari
      const yearStart = dayjs().year(targetYear).startOf('year').toDate();
      const stockWhere = this.buildWhereCondition(yearStart, monthEnd.toDate(), filialId, countryId);
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
      const [filialId, countryId] = key.split('|');
      const reportData = this.calculateReportData(group, targetDate);

      await this.saveOrUpdateReport(reportData, targetDate.toDate(), filialId, countryId);
    }
  }

  async seedHistorical() {
    const allDates = await this.getAllUniqueDates();

    for (const date of allDates) {
      try {
        await this.createDailyReport(date);
      } catch (error) {
        console.error(`❌ Error creating country report for date: ${date}`, error);
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
    countryId?: string,
  ): FindOptionsWhere<CountryReportItem> {
    const where: FindOptionsWhere<CountryReportItem> = {
      date: Between(fromDate, toDate),
    };

    if (filialId) {
      where.filial = { id: filialId };
    }

    if (countryId) {
      where.country = { id: countryId };
    }

    return where;
  }

  private async getSalesData(where: FindOptionsWhere<CountryReportItem>) {
    return this.reportRepo.find({
      where,
      relations: ['filial', 'country'],
      order: { date: 'DESC' },
    });
  }

  private async getStockData(where: FindOptionsWhere<CountryReportItem>) {
    return this.reportRepo.find({
      where,
      relations: ['country'],
      select: {
        totalCount: true,
        totalKv: true,
        totalPrice: true,
        country: {
          id: true,
          title: true,
        },
      },
    });
  }

  private groupSalesData(salesData: CountryReportItem[]): Map<string, CountryGroup> {
    const grouped = new Map<string, CountryGroup>();

    for (const item of salesData) {
      const countryKey = item.country?.id?.toString() || 'unknown';

      if (!grouped.has(countryKey)) {
        grouped.set(countryKey, {
          country: item.country,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          items: [],
        });
      }

      const group = grouped.get(countryKey)!;
      group.totalSellCount += Number(item.totalSellCount || 0);
      group.totalSellKv += Number(item.totalSellKv || 0);
      group.totalSellPrice += Number(item.totalSellPrice || 0);
      group.items!.push(item);
    }

    return grouped;
  }

  private groupStockData(stockData: CountryReportItem[]): Map<string, CountryStockGroup> {
    const grouped = new Map<string, CountryStockGroup>();

    for (const item of stockData) {
      const countryKey = item.country?.id?.toString() || 'unknown';

      if (!grouped.has(countryKey)) {
        grouped.set(countryKey, {
          country: item.country,
          totalCount: 0,
          totalKv: 0,
          totalPrice: 0,
        });
      }

      const group = grouped.get(countryKey)!;
      group.totalCount += Number(item.totalCount || 0);
      group.totalKv += Number(item.totalKv || 0);
      group.totalPrice += Number(item.totalPrice || 0);
    }

    return grouped;
  }

  private combineResults(
    salesGroups: Map<string, CountryGroup>,
    stockGroups: Map<string, CountryStockGroup>,
  ): CountryCombinedResult[] {
    const result: CountryCombinedResult[] = [];
    const allCountryKeys = new Set([...salesGroups.keys(), ...stockGroups.keys()]);

    for (const countryKey of allCountryKeys) {
      const sellGroup = salesGroups.get(countryKey);
      const stockGroup = stockGroups.get(countryKey);

      result.push({
        country: sellGroup?.country || stockGroup?.country,
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

  private paginateResults(results: CountryCombinedResult[], page: number, limit: number): CountryCombinedResult[] {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return results.slice(startIndex, endIndex);
  }

  private calculateOverallTotals(results: CountryCombinedResult[]): CountryOverallTotals {
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
    groupedSales: Map<string, CountryGroup>,
    combinedResult: CountryCombinedResult[],
    overallTotals: CountryOverallTotals,
  ) {
    console.log('📊 Sotuv yig\'indilari:');
    for (const [key, value] of groupedSales.entries()) {
      console.log(`🌍 ${key}: count=${value.totalSellCount}, kv=${value.totalSellKv}, price=${value.totalSellPrice}`);
    }

    console.log('📊 Yakuniy country natijalari:');
    combinedResult.forEach((r) => {
      console.log(
        `🌍 ${r.country?.title}: sotuv ${r.totalSellPrice}, qoldiq ${r.totalPrice}, count ${r.totalSellCount}/${r.totalCount}`,
      );
    });

    console.log('📈 Umumiy yig\'indi:', overallTotals);
  }

  private formatResponse(
    data: CountryCombinedResult[],
    total: number,
    page: number,
    limit: number,
    totals: CountryOverallTotals,
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
    data: CountryCombinedResult[],
    total: number,
    page: number,
    limit: number,
    totals: CountryOverallTotals,
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
        bar_code: { country: true },
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
          country: true,
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
      const countryId = order.bar_code?.country?.id;
      if (!filialId || !countryId) continue;

      const key = `${filialId}|${countryId}`;
      if (!grouped.has(key)) grouped.set(key, { orders: [], products: [] });
      grouped.get(key)!.orders.push(order);
    }

    // Products guruhlash
    for (const product of products) {
      const filialId = product.filial?.id;
      const countryId = product.bar_code?.country?.id;
      if (!filialId || !countryId) continue;

      const key = `${filialId}|${countryId}`;
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

  private async saveOrUpdateReport(reportData: any, date: Date, filialId: string, countryId: string) {
    const existing = await this.reportRepo.findOne({
      where: {
        date,
        filial: { id: filialId },
        country: { id: countryId },
      },
    });

    if (existing) {
      Object.assign(existing, reportData);
      await this.reportRepo.save(existing);
    } else {
      const report = new CountryReportItem();
      Object.assign(report, reportData);
      report.date = date;
      report.filial = { id: filialId } as any;
      report.country = { id: countryId } as any;
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

  async getCountriesReport(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    month?: number | string,
    year?: number | string,
  ) {
    const skip = (page - 1) * limit;

    // ===== Date filter (end of month) =====
    let dateFilter: Date | null = null;
    if (month && year) {
      dateFilter = new Date(+year, +month, 0, 23, 59, 59);
    }

    // IMPORTANT: force numeric at the multiplication step
    // We cast everything that can be float (y, x, priceMeter) to numeric.
    const xExpr = `s.x`;
    const yExpr = `p.y`;
    const countExprBase = `p.count`;

    // isMetric is on qrbase (q)
    const kvItemExpr = `
    CASE
      WHEN q."isMetric" = true THEN (${yExpr})
      ELSE (${countExprBase}) * (${yExpr})
    END * (${xExpr})
  `;

    const cntItemExpr = `
    CASE
      WHEN q."isMetric" = true THEN 1::numeric
      ELSE (${countExprBase})
    END
  `;

    // ===== Latest price subquery (deterministic by date, tie-broken by id) =====
    // DO NOT use MAX(priceMeter) because it changes meaning.
    const latestPriceSubQuery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ON (cp."collectionId") cp."collectionId"', 'collectionId')
      .addSelect('cp."priceMeter"::numeric', 'priceMeter')
      .from('collection-price', 'cp')
      .where(`cp.type = 'filial'`)
      .orderBy('cp."collectionId"')
      .addOrderBy('cp."date"', 'DESC')
      .addOrderBy('cp.id', 'DESC'); // tie-breaker if same date

    // ===== Base WHERE =====
    const baseWhere: string[] = [
      'p.is_deleted = false',
      `f.type != 'dealer'`,
    ];

    if (filialId) baseWhere.push('p."filialId" = :filialId');
    if (dateFilter) baseWhere.push('p.date <= :dateFilter');

    const whereSql = baseWhere.join(' AND ');

    // ===== Main query (by country) =====
    const mainQuery = this.productRepo
      .createQueryBuilder('p')
      .select([
        `json_build_object('id', co.id, 'title', co.title) AS country`,
        `COALESCE(SUM((${kvItemExpr})), 0)::numeric(20, 2) AS "totalKv"`,
        `COALESCE(SUM((${cntItemExpr})), 0)::numeric AS "totalCount"`,
        `
        ROUND(
          COALESCE(
            SUM( (${kvItemExpr}) * COALESCE(lp."priceMeter", 0)::numeric ),
            0
          )::numeric,
          2
        ) AS "totalPrice"
      `,
      ])
      .leftJoin('p.bar_code', 'q')
      .leftJoin('q.size', 's')
      .leftJoin('q.collection', 'c')
      .leftJoin('q.country', 'co')
      .leftJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'lp."collectionId" = c.id')
      .leftJoin('p.filial', 'f')
      .where(whereSql)
      .groupBy('co.id')
      .addGroupBy('co.title')
      .orderBy('co.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        dateFilter,
      });

    // ===== Total countries count =====
    const totalCountQuery = this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.bar_code', 'q')
      .leftJoin('q.country', 'co')
      .leftJoin('p.filial', 'f')
      .where(whereSql)
      .select('COUNT(DISTINCT co.id)', 'total')
      .setParameters({ filialId, dateFilter });

    // ===== Totals (same expressions, same where, same joins) =====
    const totalsQuery = this.productRepo
      .createQueryBuilder('p')
      .select([
        `ROUND(COALESCE(SUM((${kvItemExpr})), 0)::numeric, 2) AS "totalKv"`,
        `COALESCE(SUM((${cntItemExpr})), 0)::numeric AS "totalCount"`,
        `
        ROUND(
          COALESCE(
            SUM( (${kvItemExpr}) * COALESCE(lp."priceMeter", 0)::numeric ),
            0
          )::numeric,
          2
        ) AS "totalPrice"
      `,
      ])
      .leftJoin('p.bar_code', 'q')
      .leftJoin('q.size', 's')
      .leftJoin('q.collection', 'c')
      .leftJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'lp."collectionId" = c.id')
      .leftJoin('p.filial', 'f')
      .where(whereSql)
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        dateFilter,
      });

    const [rows, totalResult, totals] = await Promise.all([
      mainQuery.getRawMany(),
      totalCountQuery.getRawOne(),
      totalsQuery.getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    // IMPORTANT: do NOT toFixed() again in JS (you already rounded in SQL)
    // Keep as Number(...) or even keep as string if you want exactness.
    return {
      data: rows.map((r) => ({
        country: typeof r.country === 'string' ? JSON.parse(r.country) : r.country,
        totalCount: Number(r.totalCount),     // numeric
        totalKv: Number(r.totalKv),           // already rounded
        totalPrice: Number(r.totalPrice),     // already rounded
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
          totalCount: Number(totals?.totalCount || 0),
          totalKv: Number(totals?.totalKv || 0),
          totalPrice: Number(totals?.totalPrice || 0),
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalNetProfitSum: 0,
        },
      },
    };
  }

  async getCountriesOrderReport(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    month?: number | string,
    year?: number | string,
  ) {
    const skip = (page - 1) * limit;

    // === Compute first and last day of given month/year ===
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (month && year) {
      const m = +month;
      const y = +year;
      startDate = new Date(y, m - 1, 1, 0, 0, 0);           // 01.MM.YYYY 00:00:00
      endDate = new Date(y, m, 0, 23, 59, 59);              // Last day 23:59:59
    }

    if (filialId === '#dealers') {
      return await this.reportService.getByPackage({
        mode: 'country',
        page,
        limit,
        month,
        year,
        package_id: null,
        toId: null,
        search: null,
      });
    }

    // === Base conditions ===
    const baseWhere = [`o.status = 'accepted'`];
    if (filialId) baseWhere.push('f.id = :filialId');
    if (startDate && endDate) baseWhere.push('o."date" BETWEEN :startDate AND :endDate');

    // === Main query ===
    const query = this.orderRepo
      .createQueryBuilder('o')
      .select([
        `json_build_object('id', co.id, 'title', co.title) as country`,
        `COALESCE(SUM(o.kv), 0) as "totalKv"`,
        `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
        `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalPrice"`,
        `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
      ])
      .innerJoin('o.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin('q.country', 'co')
      .innerJoin('o.product', 'p')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .groupBy('co.id')
      .addGroupBy('co.title')
      .orderBy('co.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        filialId,
        startDate,
        endDate,
      });

    // === Execute parallel queries: data, total count, and totals ===
    const [rows, totalResult, totals] = await Promise.all([
      query.getRawMany(),

      this.orderRepo
        .createQueryBuilder('o')
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.country', 'co')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .where(baseWhere.join(' AND '))
        .select('COUNT(DISTINCT co.id)', 'total')
        .setParameters({ filialId, startDate, endDate })
        .getRawOne(),

      this.orderRepo
        .createQueryBuilder('o')
        .select([
          `COALESCE(SUM(o.kv), 0) as "totalKv"`,
          `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
          `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
          `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalPrice"`,
        ])
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.collection', 'c')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .where(baseWhere.join(' AND '))
        .setParameters({
          filialId,
          startDate,
          endDate,
        })
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    return {
      data: rows.map((r) => ({
        country: r.country,
        totalKv: +(Number(r.totalKv).toFixed(2)),
        totalCount: +(Number(r.totalCount).toFixed(2)),
        totalPrice: +(Number(r.totalPrice).toFixed(2)),
        totalNetProfitPrice: +(Number(r.totalNetProfitPrice).toFixed(2)),
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
        },
      },
    };
  }
}

