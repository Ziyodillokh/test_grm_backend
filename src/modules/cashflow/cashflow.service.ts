import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateCashflowDto } from './dto';
import { Cashflow } from './cashflow.entity';
import { KassaService } from '../kassa/kassa.service';
import { Between, DataSource, EntityManager, In, IsNull, LessThanOrEqual, MoreThanOrEqual, QueryRunner, Repository } from 'typeorm';
import { ActionService } from '../action/action.service';
import { GRMGateway } from '../web-socket/web-socket.gateway';
import { PaginatedFilterCashflowDto } from './dto/paginated-filter-cashflow.dto';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { DebtService } from '../debt/debt.service';
import { CashFlowEnum, CashflowStatusEnum, FilialTypeEnum, KassaProgresEnum, OrderEnum, UserRoleEnum } from '../../infra/shared/enum';
import { Order } from '../order/order.entity';
import { ReportService } from '../report/report.service';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import * as dayjs from 'dayjs';
import { User } from '../user/user.entity';
import { PlanYear } from '../plan-year/plan-year.entity';
import { Kassa } from '../kassa/kassa.entity';
import PlanYearType from 'src/infra/shared/enum/plan-year.enum';
import { CollectionReportItem } from '../collection-report-item/collection-report-item.entity';
import KassaReportProgresEnum from 'src/infra/shared/enum/kassa-report-progres.enum';
import { FilterCashflowByMonthDto } from './dto/for-boss-filter.dto';
import { Filial } from '../filial/filial.entity';
import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { Discount } from '../discount/discount.entity';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import * as XLSX from 'xlsx';
import FilialType from '@infra/shared/enum/filial-type.enum';
import { OrderService } from '@modules/order/order.service';
import { Report } from '@modules/report/report.entity';

@Injectable()
export class CashflowService {
  constructor(
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
    @InjectRepository(SellerReportItem)
    private readonly sellerItemRepository: Repository<SellerReportItem>,
    @InjectRepository(SellerReport)
    private readonly sellerReportRepository: Repository<SellerReport>,
    @InjectRepository(CollectionReportItem)
    private readonly collectionItemRepository: Repository<CollectionReportItem>,
    @InjectRepository(FactoryReportItem)
    private readonly factoryItemRepository: Repository<FactoryReportItem>,
    @InjectRepository(CountryReportItem)
    private readonly countryItemRepository: Repository<CountryReportItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @Inject(forwardRef(() => GRMGateway))
    private readonly grmGateway: GRMGateway,
    @Inject(forwardRef(() => KassaService))
    private readonly kassaService: KassaService,
    private readonly connection: DataSource,
    private readonly actionService: ActionService,
    @Inject(forwardRef(() => DebtService))
    private readonly debtService: DebtService,
    private readonly entityManager: EntityManager,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {
  }

  async getAll(
    options: IPaginationOptions,
    filter: PaginatedFilterCashflowDto,
  ): Promise<Pagination<Cashflow> & { totals: any }> {

    /**
     * =========================
     * BASE QUERY
     * =========================
     */
    const baseQb = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.casher', 'casher')
      .leftJoinAndSelect('casher.avatar', 'avatar')
      .leftJoinAndSelect('cashflow.seller', 'c_seller')
      .leftJoinAndSelect('c_seller.avatar', 'seller_avatar')
      .leftJoinAndSelect('cashflow.debt', 'debt')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.filial', 'filial')
      .leftJoinAndSelect('cashflow.order', 'ord') // ✅ FIXED
      .leftJoinAndSelect('ord.seller', 'seller')
      .leftJoinAndSelect('seller.avatar', 'avatar_s')
      .leftJoinAndSelect('ord.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.factory', 'factory')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.style', 'style')
      .orderBy('cashflow.date', 'DESC');

    /**
     * =========================
     * SPECIAL TIP FILTERS
     * =========================
     */
    if (filter.tip === 'Скидка') {
      baseQb.andWhere('ord.discountSum > 0');
      delete filter.tip;
    }

    if (filter.tip === 'Терминал') {
      baseQb.andWhere('ord.plasticSum > 0');
      delete filter.tip;
    }

    if (filter.tip === 'Навар') {
      baseQb.andWhere('ord.additionalProfitSum > 0');
      delete filter.tip;
    }

    /**
     * =========================
     * STANDARD FILTERS
     * =========================
     */
    if (filter.type)
      baseQb.andWhere('cashflow.type = :type', { type: filter.type });

    if (filter.cashflowSlug)
      baseQb.andWhere('cashflow_type.slug = :cashflowSlug', {
        cashflowSlug: filter.cashflowSlug,
      });

    if (filter.tip)
      baseQb.andWhere('cashflow.tip = :tip', { tip: filter.tip });

    if (filter.filialId)
      baseQb.andWhere('cashflow.filialId = :filialId', {
        filialId: filter.filialId,
      });

    if (filter.kassaReport)
      baseQb.andWhere('cashflow.kassaId = :kassaReport', {
        kassaReport: filter.kassaReport,
      });

    if (filter.report)
      baseQb.andWhere('cashflow.reportId = :report', {
        report: filter.report,
      });

    if (filter.debt)
      baseQb.andWhere('cashflow.debtId = :debt', { debt: filter.debt });

    if (filter.kassaId)
      baseQb.andWhere('cashflow.kassaId = :kassaId', {
        kassaId: filter.kassaId,
      });

    if (filter.casherId)
      baseQb.andWhere('cashflow.casherId = :casherId', {
        casherId: filter.casherId,
      });

    if (filter.orderId)
      baseQb.andWhere('cashflow.orderId = :orderId', {
        orderId: filter.orderId,
      });

    if (filter.sellerId)
      baseQb.andWhere('seller.id = :sellerId', {
        sellerId: filter.sellerId,
      });

    if (filter.is_online !== undefined)
      baseQb.andWhere('cashflow.is_online = :is_online', {
        is_online: filter.is_online,
      });

    if (filter.fromDate)
      baseQb.andWhere('cashflow.date >= :fromDate', {
        fromDate: filter.fromDate,
      });

    if (filter.toDate)
      baseQb.andWhere('cashflow.date <= :toDate', {
        toDate: filter.toDate,
      });

    /**
     * =========================
     * MONTH FILTER
     * =========================
     */
    if (filter.month) {
      const year = +(filter.year ?? new Date().getFullYear());
      const month = +filter.month;

      const fromDate = new Date(year, month - 1, 1);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(year, month, 1);
      toDate.setHours(0, 0, 0, 0);

      baseQb.andWhere('cashflow.date >= :fromDate', { fromDate });
      baseQb.andWhere('cashflow.date < :toDate', { toDate });
    }

    /**
     * =========================
     * SEARCH
     * =========================
     */
    if (filter.search) {
      baseQb.andWhere(
        `
      (SELECT COUNT(*)
       FROM (SELECT DISTINCT LOWER(word) AS word
             FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) w) uw
       WHERE CONCAT_WS(
         ' ',
         collection.title,
         model.title,
         size.title,
         country.title,
         shape.title,
         style.title,
         color.title,
         bar_code.code
       ) ILIKE '%' || uw.word || '%'
      ) =
      (SELECT COUNT(*)
       FROM (SELECT LOWER(word) AS word
             FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) w2) uw2
      )
      `,
        { text: filter.search },
      );
    }

    /**
     * =========================
     * PAGINATION
     * =========================
     */
    const pagination = await paginate<Cashflow>(baseQb.clone(), options);

    /**
     * =========================
     * TOTALS
     * =========================
     */
    const totalsRaw = await baseQb
      .clone()
      .orderBy() // 🔥 clears ORDER BY cashflow.date
      .select([
        'COALESCE(SUM(cashflow.price), 0) AS "totalSum"',
        'COALESCE(SUM(ord.plasticSum), 0) AS "plasticSum"',
        'COALESCE(SUM(ord.price), 0) AS "totalOrderPrice"',
        `COALESCE(SUM(CASE WHEN cashflow.type = 'Расход' THEN cashflow.price ELSE 0 END), 0) AS "totalExpense"`,
        `COALESCE(SUM(CASE WHEN ord.status = 'canceled' THEN ord.plasticSum + ord.price ELSE 0 END), 0) AS "totalReturnSale"`,
        'COALESCE(SUM(ord.discountSum), 0) AS "totalDiscount"',
        'COUNT(DISTINCT ord.id) AS "count"',
        'COALESCE(SUM(ord.kv), 0) AS "kv"',
      ])
      .getRawOne();

    /**
     * =========================
     * RESPONSE
     * =========================
     */
    return {
      ...pagination,
      totals: {
        totalSum: Number(totalsRaw?.totalSum) || 0,
        plasticSum: Number(totalsRaw?.plasticSum) || 0,
        totalPrice: Number(totalsRaw?.totalOrderPrice) || 0,
        totalExpense: Number(totalsRaw?.totalExpense) || 0,
        totalReturnSale: Number(totalsRaw?.totalReturnSale) || 0,
        totalDiscount: Number(totalsRaw?.totalDiscount) || 0,
        count: Number(totalsRaw?.count) || 0,
        kv: Number(totalsRaw?.kv) || 0,
        year: filter.year || new Date().getFullYear(),
      },
    };
  }

  async getByKassa(kassaId) {
    return this.cashflowRepository.find({ where: { kassa: kassaId } });
  }

  async getOne(id: string) {
    return await this.cashflowRepository
      .findOne({
        where: { id },
        relations: { casher: true },
      })
      .catch(() => {
        throw new NotFoundException('Cashflow not found');
      });
  }

  private async updateReportItems(
    queryRunner: any,
    order: any,
    isIncome: boolean,
    kassa?: Kassa,
    report?: any,
  ) {
    const currentMonth = dayjs().month() + 1;
    const currentDay = dayjs().date();
    const year = dayjs().year();

    if (!order) {
      console.warn('⚠️ [updateReportItems] Order not found. Exiting.');
      return;
    }

    let filialId: string | undefined = undefined;
    if (kassa?.filial?.id) filialId = kassa.filial.id;
    else if (report?.filial?.id) filialId = report.filial.id;

    if (!filialId) throw new BadRequestException('Filial not found');

    const filialObj = await queryRunner.manager.findOne(Filial, { where: { id: filialId } });
    if (!filialObj) throw new BadRequestException('Filial not found');

    const multiplier = isIncome ? 1 : -1;

    // -------------------- COLLECTION --------------------
    if (order?.product?.bar_code?.collection?.id) {
      let collectionReportItem = await queryRunner.manager.findOne(CollectionReportItem, {
        where: {
          year,
          month: currentMonth,
          day: currentDay,
          collection: { id: order.product.bar_code.collection.id },
          filial: { id: filialId },
        },
        relations: ['collection', 'filial'],
      });

      if (!collectionReportItem) {
        collectionReportItem = this.collectionItemRepository.create({
          month: currentMonth,
          year,
          day: currentDay,
          collection: order.product.bar_code.collection,
          filial: filialObj,
          totalCount: 0,
          totalKv: 0,
          totalPrice: 0,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalSaleReturnCount: 0,
          totalSaleReturnPrice: 0,
          totalSaleReturnKv: 0,
        });
      }

      let orderCount;
      if (order.product?.bar_code?.isMetric === true) {
        orderCount = 1;
      } else {
        orderCount = order.x;
      }

      collectionReportItem.totalSellCount += multiplier * orderCount;
      collectionReportItem.totalSellKv += multiplier * (order.kv || 0);
      collectionReportItem.totalSellPrice += multiplier * (order.price || 0);

      if (!isIncome) {
        collectionReportItem.totalCount += orderCount;
        collectionReportItem.totalKv += order.kv || 0;
        collectionReportItem.totalPrice +=
          (order.product?.bar_code?.size?.x ?? 0) * (order.product?.y ?? 0) * (order.product?.priceMeter ?? 0);
        collectionReportItem.totalSaleReturnCount += orderCount;
        collectionReportItem.totalSaleReturnKv += order.kv || 0;
        collectionReportItem.totalSaleReturnPrice += order.price || 0;
      } else {
        collectionReportItem.totalCount -= orderCount;
        collectionReportItem.totalKv -= order.kv || 0;

        collectionReportItem.totalPrice =
          collectionReportItem.totalPrice -
          (order.product?.bar_code?.size?.x ?? 0) *
          (order.x / 100) *
          (order.product?.bar_code?.collection?.collection_prices?.[0]?.priceMeter ?? 0);
      }

      await queryRunner.manager.save(collectionReportItem);
    }

    // -------------------- FACTORY --------------------
    if (order?.product?.bar_code?.factory?.id) {
      let factoryReportItem = await queryRunner.manager.findOne(FactoryReportItem, {
        where: {
          year,
          month: currentMonth,
          day: currentDay,
          factory: { id: order.product.bar_code.factory.id },
          filial: { id: filialId },
        },
        relations: ['factory', 'filial'],
      });

      if (!factoryReportItem) {
        factoryReportItem = this.factoryItemRepository.create({
          year,
          month: currentMonth,
          day: currentDay,
          factory: order.product.bar_code.factory,
          filial: filialObj,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalCount: 0,
          totalKv: 0,
          totalPrice: 0,
          totalSaleReturnCount: 0,
          totalSaleReturnPrice: 0,
          totalSaleReturnKv: 0,
        });
      }

      let orderCount;
      if (order.product?.bar_code?.isMetric === true) {
        orderCount = 1;
      } else {
        orderCount = order.x;
      }

      factoryReportItem.totalSellCount += multiplier * orderCount;
      factoryReportItem.totalSellKv += multiplier * (order.kv || 0);
      factoryReportItem.totalSellPrice += multiplier * (order.price || 0);

      if (!isIncome) {
        factoryReportItem.totalCount += orderCount;
        factoryReportItem.totalKv += order.kv || 0;
        factoryReportItem.totalPrice +=
          (order.product?.bar_code?.size?.x ?? 0) *
          (order.product?.y ?? 0) *
          (order.product?.bar_code?.collection?.collection_prices?.[0]?.priceMeter ?? 0);
        factoryReportItem.totalSaleReturnCount += orderCount;
        factoryReportItem.totalSaleReturnKv += order.kv || 0;
        factoryReportItem.totalSaleReturnPrice += order.price || 0;
      } else {
        factoryReportItem.totalCount = factoryReportItem.totalCount - orderCount;
        factoryReportItem.totalKv = factoryReportItem.totalKv - order.kv || 0;
        factoryReportItem.totalPrice =
          factoryReportItem.totalPrice -
          (order.product?.bar_code?.size?.x ?? 0) *
          (order.x / 100) *
          (order.product?.bar_code?.collection?.collection_prices?.[0]?.priceMeter ?? 0);
      }

      await queryRunner.manager.save(factoryReportItem);
    }

    // -------------------- COUNTRY --------------------
    if (order?.product?.bar_code?.country?.id) {
      let countryReportItem = await queryRunner.manager.findOne(CountryReportItem, {
        where: {
          year,
          month: currentMonth,
          day: currentDay,
          country: { id: order.product.bar_code.country.id },
          filial: { id: filialId },
        },
        relations: ['country', 'filial'],
      });

      if (!countryReportItem) {
        countryReportItem = this.countryItemRepository.create({
          year,
          month: currentMonth,
          day: currentDay,
          country: order.product.bar_code.country,
          filial: filialObj,
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalCount: 0,
          totalKv: 0,
          totalPrice: 0,
          totalSaleReturnCount: 0,
          totalSaleReturnPrice: 0,
          totalSaleReturnKv: 0,
        });
      }

      let orderCount;
      if (order.product?.bar_code?.isMetric === true) {
        orderCount = 1;
      } else {
        orderCount = order.x;
      }

      countryReportItem.totalSellCount += multiplier * orderCount;
      countryReportItem.totalSellKv += multiplier * (order.kv || 0);
      countryReportItem.totalSellPrice += multiplier * (order.price || 0);

      if (!isIncome) {
        countryReportItem.totalCount += orderCount;
        countryReportItem.totalKv += order.kv || 0;
        countryReportItem.totalPrice +=
          (order.product?.bar_code?.size?.x ?? 0) * (order.product?.y ?? 0) * (order.product?.priceMeter ?? 0);
        countryReportItem.totalSaleReturnCount += orderCount;
        countryReportItem.totalSaleReturnKv += order.kv || 0;
        countryReportItem.totalSaleReturnPrice += order.price || 0;
      } else {
        countryReportItem.totalCount = countryReportItem.totalCount - orderCount;
        countryReportItem.totalKv = countryReportItem.totalKv - order.kv || 0;

        countryReportItem.totalPrice =
          countryReportItem.totalPrice -
          (order.product?.bar_code?.size?.x ?? 0) *
          (order.x / 100) *
          (order.product?.bar_code?.collection?.collection_prices?.[0]?.priceMeter ?? 0);
      }

      await queryRunner.manager.save(countryReportItem);
    }
  }

  private async processManagerDiscount(
    queryRunner: QueryRunner,
    order: any,
    isIncome: boolean, // true - Приход, false - Расход
  ): Promise<number> {
    let totalManagerDiscount = 0;

    if (order.product?.bar_code?.collection?.collection_prices?.length > 0) {
      for (const collectionPrice of order.product.bar_code.collection.collection_prices) {
        if (collectionPrice.discounts?.length > 0 && collectionPrice.priceMeter) {
          const discount = collectionPrice.discounts[0];

          if (discount.discountPercentage) {
            const currentPriceMeter = collectionPrice.priceMeter;
            const originalPriceMeter = (currentPriceMeter * 100) / (100 - discount.discountPercentage);
            const discountAmount = originalPriceMeter - currentPriceMeter;

            const discountOne = await this.discountRepository.findOne({
              where: { id: discount.id },
            });

            if (discountOne && discount.isAdd) {
              const multiplier = isIncome ? 1 : -1;
              discountOne.discountSum = (discountOne.discountSum || 0) + discountAmount * multiplier;
              await this.discountRepository.save(discountOne);
            }

            totalManagerDiscount += discountAmount;
          }
        }
      }
    }

    if (totalManagerDiscount > 0) {
      const multiplier = isIncome ? 1 : -1;
      order.managerDiscountSum = (order.managerDiscountSum || 0) + totalManagerDiscount * multiplier;
      await queryRunner.manager.save(order);
    }

    return totalManagerDiscount;
  }

  async create(value: CreateCashflowDto, userId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sources = [value.kassa, value.report].filter(Boolean);
      if (sources.length !== 1) {
        throw new BadRequestException('Only one of kassa or report must be provided.');
      }

      let kassa = null;
      let report = null;
      const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['position'] });
      if (user.position.role === UserRoleEnum.ACCOUNTANT) value.is_online = true;

      const price = Math.abs(value.price);

      if (value.kassa) {
        kassa = await this.kassaService.getById(value.kassa);
      }

      if (value.report) {
        report = await this.reportService.findOneByFilialTypes(value.report);
      }

      const cashflowData = {
        ...value,
        casher: userId,
        price,
        debt: value.debtId,
        ...(kassa?.filial?.id && { filial: kassa.filial.id }),
        ...(kassa?.id && { kassa: kassa.id }),
        ...(report?.filial?.id && { filial: report.filial.id }),
        ...(report?.id && { report: report.id }),
        ...(kassa?.status === KassaProgresEnum.WARNING && { date: kassa.endDate }),
      };

      const insertResult = await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(Cashflow)
        .values(cashflowData as unknown as Cashflow)
        .returning('id')
        .execute();

      const newCashflowId = insertResult.raw[0].id;
      const cashflow = await queryRunner.manager.findOne(Cashflow, {
        where: { id: newCashflowId },
        relations: {
          order: {
            product: {
              bar_code: {
                size: true,
                collection: { collection_prices: { discounts: true } },
                factory: true,
                country: true,
              },
            },
            seller: true,
          },
          cashflow_type: true,
          kassa: true,
        },
      });

      if (!cashflow) throw new BadRequestException('Cashflow not found');
      cashflow.title = cashflow?.cashflow_type?.title || '';

      const order = cashflow.order;
      const isOrder = value.tip === 'order';

      // Report logikasi
      if (report) {
        const isDebtFlow = ['dolg', 'Кент'].includes(cashflow.cashflow_type.slug) && value.debtId;

        if (value.type === 'Приход') {
          if (isDebtFlow) {
            const debt = await this.debtService.findOne(value.debtId);
            if (!debt) throw new BadRequestException('Debt not found');
            debt.given += price;
            debt.totalDebt = debt.given - debt.owed;
            await queryRunner.manager.save(debt);
          }
          if (user?.position?.role === UserRoleEnum.ACCOUNTANT) {
            report.accountantSum += price;
          } else {
            report.managerSum += price;
          }
          report.totalIncome += price;
        } else if (value.type === 'Расход') {
          if (isDebtFlow) {
            const debt = await this.debtService.findOne(value.debtId);
            if (!debt) throw new BadRequestException('Debt not found');
            debt.owed += price;
            debt.totalDebt = debt.given - debt.owed;
            await queryRunner.manager.save(debt);
          }

          if (user?.position?.role === UserRoleEnum.ACCOUNTANT) {
            if (report.accountantSum < price) {
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            } else {
              report.accountantSum -= price;
            }
            report.totalExpense += price;
          } else {
            if (report.managerSum < price) {
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            }
            report.managerSum -= price;
          }
        }

        await queryRunner.manager.save(report);
      }

      const today = dayjs().format('YYYY-MM-DD');

      if (value.type === 'Приход' && kassa?.id) {
        if (!isOrder) {
          kassa.income += price;
          if (value?.is_online) {
            kassa.plasticSum += price;
          }
        }
        if (cashflow.cashflow_type.slug === 'Перечисление') {
          kassa.plasticSum += price;
          kassa.income += price;
        }
        // Order cashflow: kassa totallariga qo'shilmaydi — PENDING holatda yaratiladi.
        // approveCashflow() da F_MANAGER tasdiqlagan vaqtda kassa ga qo'shiladi.
        if (isOrder && order) {
          // Faqat order statusini "kutilmoqda" deb belgilaymiz
          // Kassa totallari approveCashflow() da yangilanadi
        }
      }
      else if (value.type === 'Расход' && kassa?.id) {
        kassa.in_hand -= price;

        // Find the report associated with this kassa
        const kassaWithReport = await queryRunner.manager.findOne(Kassa, {
          where: { id: kassa.id },
          relations: { report: true },
        });

        const oneReport = kassaWithReport?.report;

        if (cashflow.cashflow_type.slug === 'Инкассация') {
          kassa.cash_collection += price;

          if (oneReport) {
            oneReport.totalCashCollection += price;
            oneReport.accountantSum += price;
            await this.reportService.save(oneReport);
          }
        }

        kassa.expense += price;

        if (value?.is_online) {
          if (kassa.plasticSum < price) {
            throw new BadRequestException('Plastic amount is insufficient for this expense!');
          }
          kassa.plasticSum -= price;
        }

        if (isOrder && order) {
          await this.processManagerDiscount(queryRunner, order, false);

          kassa.expense -= price;
          kassa.return_sale += price;

          await this.updateSellerReportItem(queryRunner, order, today, false);
          await this.updateReportItems(queryRunner, order, false, kassa, report);

          kassa.totalSaleReturn += price;
          kassa.in_hand -= order.price;
          await queryRunner.manager.save(kassa);

          if (oneReport) {
            oneReport.totalSaleReturn += price;
            await this.reportService.save(oneReport);
          }
        }

        const cashflowType = await queryRunner.manager.findOne(CashflowType, {
          where: { id: value.cashflow_type },
        });

        if (
          cashflowType &&
          (cashflowType.slug === 'manager' || cashflowType.slug === 'bugalter' || cashflowType.slug === 'Инкассация') &&
          kassa
        ) {
          let targetUser = null;
          if (cashflowType.slug === 'manager') {
            targetUser = await this.userRepo.findOne({
              where: { position: { role: UserRoleEnum.M_MANAGER } },
            });
          } else if (cashflowType.slug === 'bugalter' || cashflowType.slug === 'Инкассация') {
            targetUser = await this.userRepo.findOne({
              where: { position: { role: UserRoleEnum.ACCOUNTANT } },
            });
          }

          if (!targetUser) {
            throw new BadRequestException(`${cashflowType.slug === 'manager' ? 'Manager' : 'Bugalter'} topilmadi`);
          }

          const reports = oneReport;
          const cashflow_type_kassa = await this.getOneBySlug(cashflowType.slug === 'Инкассация' ? 'Инкассация' : 'kassa');

          let comment = `${kassa?.filial?.title} filialidan kassa qabul qilindi - ${value.comment || ''}`;

          if (cashflowType.slug === 'Инкассация') {
            comment = `${kassa?.filial?.title} filialini kassasidan "Инкассация" qabul qilindi - ${value.comment || ''}`;
          }

          const reportCashflowData = {
            casher: targetUser.id,
            price,
            debt: value.debtId,
            filial: kassa.filial.id,
            report: reports?.id,
            type: CashFlowEnum.InCome,
            tip: CashflowTipEnum.CASHFLOW,
            comment,
            cashflow_type: cashflow_type_kassa.id,
            date: new Date(),
            is_online: value.is_online || cashflowType.slug === 'Инкассация',
            is_static: false,
            parent: cashflow.id,
          };

          const reportIncomeResult = await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into(Cashflow)
            .values(reportCashflowData as unknown as Cashflow)
            .returning('id')
            .execute();

          if (reports) {
            if (cashflowType.slug === 'bugalter' || cashflowType.slug === 'Инкассация') {
              reports.accountantSum += price;
            } else {
              reports.managerSum += price;
            }
            reports.totalIncome += price;
            await queryRunner.manager.save(reports);
          }

          await queryRunner.manager.save(kassa);
          if (report) cashflow.report = report;
          cashflow.kassa = kassa;
          await queryRunner.manager.save(cashflow);

          await queryRunner.commitTransaction();
          return [await this.getOne(newCashflowId), await this.getOne(reportIncomeResult.raw[0].id)];
        }
      }

      if (kassa) await queryRunner.manager.save(kassa);
      if (kassa) cashflow.kassa = kassa;
      if (report) cashflow.report = report;

      await queryRunner.manager.save(cashflow);
      await queryRunner.commitTransaction();
      await this.grmGateway.Action(newCashflowId);
      return this.getOne(newCashflowId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  // Helper method for updating seller report item
  private async updateSellerReportItem(queryRunner: any, order: any, today: string, isIncome: boolean) {
    let reportItem = await queryRunner.manager.findOne(SellerReportItem, {
      where: { user: { id: order.seller.id }, date: today },
      relations: ['user', 'user.filial'],
    });

    if (!reportItem) {
      const seller = await this.userRepo.findOne({
        where: { id: order.seller.id },
        relations: ['filial'],
      });
      if (!seller) throw new BadRequestException('Seller not found');

      reportItem = this.sellerItemRepository.create({
        user: seller,
        date: today,
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
    }

    const multiplier = isIncome ? 1 : -1;
    const orderCount = order.product?.bar_code?.isMetric ? 1 : order.x;

    reportItem.totalSellCount += multiplier * orderCount;
    reportItem.totalSellKv += multiplier * (order.kv || 0);
    reportItem.totalSellPrice += multiplier * (order.price || 0);
    reportItem.totalDiscount += multiplier * (order.discountSum || 0);
    reportItem.additionalProfitTotalSum += multiplier * (order.additionalProfitSum || 0);
    reportItem.totalPlasticSum += multiplier * (order.plasticSum || 0);

    if (!isIncome) {
      reportItem.totalSaleReturnCount += orderCount;
      reportItem.totalSaleReturnKv += order.kv || 0;
      reportItem.totalSaleReturnPrice += order.price || 0;
    }

    await queryRunner.manager.save(reportItem);

    const year = dayjs(today).year();
    const month = dayjs(today).month() + 1;
    const sellerId = order.seller.id;

    let monthlyReport = await queryRunner.manager.findOne(SellerReport, {
      where: { user: { id: sellerId }, year, month },
      relations: ['user'],
    });

    if (!monthlyReport) {
      const seller = await this.userRepo.findOne({ where: { id: sellerId } });
      monthlyReport = this.sellerReportRepository.create({
        user: seller,
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
    }

    const multipliers = isIncome ? 1 : -1;
    const orderCounts = order.product?.bar_code?.isMetric ? 1 : order.x;

    monthlyReport.totalSellCount += multipliers * orderCounts;
    monthlyReport.totalSellKv += multipliers * (order.kv || 0);
    monthlyReport.totalSellPrice += multipliers * (order.price || 0);
    monthlyReport.totalDiscount += multipliers * (order.discountSum || 0);
    monthlyReport.additionalProfitTotalSum += multipliers * (order.additionalProfitSum || 0);
    monthlyReport.totalPlasticSum += multipliers * (order.plasticSum || 0);

    if (!isIncome) {
      monthlyReport.totalSaleReturnCount += orderCounts;
      monthlyReport.totalSaleReturnKv += order.kv || 0;
      monthlyReport.totalSaleReturnPrice += order.price || 0;
    }

    await queryRunner.manager.save(monthlyReport);

    const delta = isIncome ? order.price || 0 : -(order.price || 0);
    const currentYear = dayjs(today).year();

    if (delta !== 0) {
      const sellerPlan = await queryRunner.manager.findOne(PlanYear, {
        where: {
          year: currentYear,
          type: PlanYearType.USER,
          user: { id: sellerId },
        },
        relations: ['user'],
      });

      if (sellerPlan) {
        sellerPlan.collectedAmount += delta;
        if (sellerPlan.collectedAmount < 0) sellerPlan.collectedAmount = 0;
        await queryRunner.manager.save(sellerPlan);
      }

      const filialId = reportItem.user?.filial?.id;
      if (filialId) {
        const filialPlan = await queryRunner.manager.findOne(PlanYear, {
          where: {
            year: currentYear,
            type: PlanYearType.FILIAL,
            filial: { id: filialId },
          },
          relations: ['filial'],
        });

        if (filialPlan) {
          filialPlan.collectedAmount += delta;
          if (filialPlan.collectedAmount < 0) filialPlan.collectedAmount = 0;
          await queryRunner.manager.save(filialPlan);
        }
      }

      const globalPlan = await queryRunner.manager.findOne(PlanYear, {
        where: { year: currentYear, type: PlanYearType.PLANYEAR },
      });

      if (globalPlan) {
        globalPlan.collectedAmount += delta;
        if (globalPlan.collectedAmount < 0) globalPlan.collectedAmount = 0;
        await queryRunner.manager.save(globalPlan);
      }
    }
  }

  async getTotalForFlManager(kassaId: string) {
    const cashflow = await this.cashflowRepository.find({
      where: {
        kassa: { id: kassaId },
      },
      order: {
        order: {
          date: 'DESC',
        },
      },
    });

    const totals = cashflow.reduce(
      (acc, curr) => {
        if (curr.type === CashFlowEnum.InCome) {
          return { ...acc, income: acc.income + curr.price };
        } else {
          return { ...acc, expense: acc.expense + curr.price };
        }
      },
      { income: 0, expense: 0 },
    );

    return {
      income: parseFloat(totals.income.toFixed(2)),
      expense: parseFloat(totals.expense.toFixed(2)),
    };
  }

  async getTotalForMManager(reportId: string) {
    const cashflow = await this.cashflowRepository.find({
      where: {
        report: { id: reportId },
      },
      order: {
        order: {
          date: 'DESC',
        },
      },
    });

    const totals = cashflow.reduce(
      (acc, curr) => {
        if (curr.type === CashFlowEnum.InCome) {
          return { ...acc, income: acc.income + curr.price };
        } else {
          return { ...acc, expense: acc.expense + curr.price };
        }
      },
      { income: 0, expense: 0 },
    );

    return {
      income: parseFloat(totals.income.toFixed(2)),
      expense: parseFloat(totals.expense.toFixed(2)),
    };
  }

  async cancel(id: string, userId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cashflow = await this.cashflowRepository.findOne({
        where: { id },
        relations: {
          order: { product: { bar_code: { size: true } }, seller: true },
          cashflow_type: true,
          kassa: true,
          debt: true,
          child: true,
        },
      });

      if (cashflow.tip === 'order' && cashflow.type === 'Расход') {
        throw new BadRequestException('Cashflow already cancelled');
      }

      // PENDING order cashflow → otmena (bekor qilish, kassa ga qo'shilmagan)
      if (cashflow.tip === 'order' && cashflow.status === CashflowStatusEnum.PENDING) {
        // Mahsulot stockini qaytarish
        const order = cashflow.order;
        if (order?.product) {
          const product = order.product;
          product.is_deleted = false;
          product.deletedDate = null;
          if (product.bar_code?.isMetric) {
            product.y = +(product.y + order.x / 100).toFixed(2);
          } else {
            product.count += order.x;
          }
          await queryRunner.manager.save(product);
        }
        // Order va cashflow statusini cancel qilish
        await queryRunner.manager.update('order', order.id, { status: OrderEnum.Cancel });
        cashflow.status = CashflowStatusEnum.CANCELLED;
        cashflow.is_cancelled = true;
        await queryRunner.manager.save(cashflow);
        await queryRunner.commitTransaction();
        return cashflow;
      }

      // APPROVED order cashflow → vozvrat (qaytarish, kassa dan ayirish kerak)
      if (cashflow.tip === 'order' && cashflow.status === CashflowStatusEnum.APPROVED) {
        await queryRunner.release();
        return await this.orderService.returnOrder(cashflow.order.id, userId);
      }

      if (!cashflow) throw new NotFoundException('Cashflow not found');
      if (cashflow.is_cancelled) throw new BadRequestException('Cashflow already cancelled');

      const kassa = cashflow.kassa;
      const price = cashflow.price;
      const order = cashflow.order;
      const isOrder = (cashflow.tip as string) === CashflowTipEnum.ORDER;

      if (cashflow.type === 'Приход') {
        if (isOrder) {
          await this.orderService.returnOrder(cashflow.order.id, userId);
        }

        if (cashflow.cashflow_type.slug === 'Долг' || (cashflow.cashflow_type.slug === 'dolg' && cashflow.debt)) {
          const debt = await this.debtService.findOne(cashflow.debt.id);
          if (!debt) throw new BadRequestException('Debt not found');

          debt.given -= price;
          debt.totalDebt = Math.max(0, debt.given - debt.owed);
          await queryRunner.manager.save(debt);
        }
      } else if (cashflow.type === 'Расход') {
        if (cashflow.cashflow_type.slug === 'Инкассация') {
          if (kassa.status === KassaProgresEnum.ACCEPTED) {
            // Update kassa directly (was kassaReport before)
            kassa.totalSum += price;
            kassa.expense -= price;
            kassa.cash_collection -= price;
            kassa.in_hand += price;
          }

          // Find the report linked to this kassa
          const kassaWithReport = await queryRunner.manager.findOne(Kassa, {
            where: { id: kassa.id },
            relations: { report: true },
          });
          if (kassaWithReport?.report?.id) {
            const report = await queryRunner.manager.findOne(Report, { where: { id: kassaWithReport.report.id } });
            report.accountantSum -= price;
            report.totalIncome -= price;
            report.totalCashCollection -= price;

            await queryRunner.manager.save(report);
          }

          kassa.expense -= price;
          kassa.cash_collection -= price;
          kassa.in_hand += price;
        }


        if (isOrder) {
          throw new BadRequestException('You can not delete cashflow!');
        }

        if (cashflow.cashflow_type.slug === 'Долг' || (cashflow.cashflow_type.slug === 'dolg' && cashflow.debt)) {
          const debt = await this.debtService.findOne(cashflow.debt.id);
          if (!debt) throw new BadRequestException('Debt not found');

          debt.owed -= price;
          debt.totalDebt = Math.max(0, debt.given - debt.owed);
          await queryRunner.manager.save(debt);
        }
      }

      await queryRunner.manager.save(kassa);

      // if (isOrder && order) {
      //   order.status = OrderEnum.Progress;
      //   order.casher = null;
      //   await queryRunner.manager.save(order);
      // }

      cashflow.is_cancelled = true;
      cashflow.status = CashflowStatusEnum.CANCELLED;
      const otherCashflow = cashflow.child.map(el => ({ ...el, is_cancelled: true, status: CashflowStatusEnum.CANCELLED }));
      await queryRunner.manager.save(cashflow);
      await queryRunner.manager.save(otherCashflow);

      if (isOrder && order && order.seller?.id && cashflow.type === 'Приход') {
        const today = dayjs(cashflow.date).format('YYYY-MM-DD');
        const reportItem = await queryRunner.manager.findOne(SellerReportItem, {
          where: {
            user: { id: order.seller.id },
            date: today,
          },
          relations: ['user'],
        });

        if (reportItem) {
          reportItem.totalSellCount -= 1;
          reportItem.totalSellKv -= order.kv || 0;
          reportItem.totalSellPrice -= order.price || 0;
          reportItem.totalDiscount -= order.discountSum || 0;
          reportItem.additionalProfitTotalSum -= order.additionalProfitSum || 0;
          reportItem.totalPlasticSum -= order.plasticSum || 0;
          await queryRunner.manager.save(reportItem);
        }
      }

      const currentYear = dayjs().year();
      const planYear = await queryRunner.manager.findOne(PlanYear, { where: { year: currentYear } });

      if (planYear) {
        const changeAmount = isOrder ? order?.price || 0 : price;

        if (cashflow.type === CashFlowEnum.InCome) {
          planYear.collectedAmount -= changeAmount;
        } else if (cashflow.type === CashFlowEnum.Consumption) {
          planYear.collectedAmount += changeAmount;
        }

        if (planYear.collectedAmount < 0) {
          planYear.collectedAmount = 0;
        }

        await queryRunner.manager.save(planYear);
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'Cashflow cancelled successfully',
        orderId: order?.id,
        orderStatus: order?.status && OrderEnum.Cancel,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteWithOrder(id) {
    const cashflow = await this.cashflowRepository.findOne({ where: { id }, relations: { kassa: true, order: true } });
    const kassa = cashflow.kassa;
    const order = cashflow.order;

    const additionalProfitSum = order.additionalProfitSum;
    const netProfitSum = order.netProfitSum;
    const discountSum = order.discountSum;
    const plasticSum = order.plasticSum;
    const price = order.price;
    const kv = order.kv;

    kassa.additionalProfitTotalSum -= additionalProfitSum;
    kassa.netProfitTotalSum -= netProfitSum;
    kassa.discount -= discountSum;
    kassa.sale -= price;
    kassa.totalSize -= kv;
    kassa.plasticSum -= plasticSum;

    await this.entityManager.save(kassa);
    await this.entityManager.softDelete(Cashflow, { order: { id: order.id } });
    await this.entityManager.softDelete(Order, { id: order.id });
  }

  async restoreWithOrder(id: string) {
    const cashflow = await this.cashflowRepository.findOne({
      where: { id },
      relations: { kassa: true, order: true },
      withDeleted: true,
    });
    const kassa = cashflow.kassa;
    const order = cashflow.order;

    const additionalProfitSum = order.additionalProfitSum;
    const netProfitSum = order.netProfitSum;
    const discountSum = order.discountSum;
    const plasticSum = order.plasticSum;
    const price = order.price;
    const kv = order.kv;

    kassa.additionalProfitTotalSum += additionalProfitSum;
    kassa.netProfitTotalSum += netProfitSum;
    kassa.discount += discountSum;
    kassa.sale += price;
    kassa.totalSize += kv;
    kassa.plasticSum += plasticSum;

    await this.entityManager.save(kassa);
    await this.entityManager.restore(Order, order.id);
    await this.entityManager.restore(Cashflow, cashflow.id);
  }

  async getSummary(year: number, month: number, startDate: number, endDate: number, filialId?: string) {
    const daysInMonth = new Date(year, month, 0).getDate();

    if (startDate < 1 || startDate > daysInMonth) {
      throw new BadRequestException(`${year}-${String(month).padStart(2, '0')} oyida ${startDate}-kun mavjud emas`);
    }
    if (endDate < 1 || endDate > daysInMonth) {
      throw new BadRequestException(`${year}-${String(month).padStart(2, '0')} oyida ${endDate}-kun mavjud emas`);
    }
    if (startDate > endDate) {
      throw new BadRequestException('startDate endDate dan katta bo\'lishi mumkin emas');
    }

    const fromDate = new Date(year, month - 1, startDate);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(year, month - 1, endDate);
    toDate.setHours(23, 59, 59, 999);

    const queryBuilder = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.filial', 'filial')
      .where('cashflow.date >= :fromDate', { fromDate })
      .andWhere('cashflow.date <= :toDate', { toDate });

    if (filialId) {
      queryBuilder.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    const cashflows = await queryBuilder.getMany();
    let totalIncome = 0;
    let totalExpense = 0;

    cashflows.forEach((cashflow) => {
      const amount = Number(cashflow.price) || 0;
      if (cashflow.type === CashFlowEnum.InCome) {
        totalIncome += amount;
      } else if (cashflow.type === CashFlowEnum.Consumption) {
        totalExpense += amount;
      }
    });

    return {
      period: {
        year,
        month,
        startDate,
        endDate,
        daysInMonth,
        totalDays: endDate - startDate + 1,
      },
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      netCashflow: Number((totalIncome - totalExpense).toFixed(2)),
      transactionCount: cashflows.length,
    };
  }

  async getFilteredCashflows(dto: FilterCashflowByMonthDto): Promise<any> {
    const { page = 1, limit = 10, year, month, type } = dto;

    const queryBuilder = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.casher', 'casher')
      .leftJoinAndSelect('casher.avatar', 'avatar')
      .leftJoin('cashflow.report', 'report')
      .where('cashflow.reportId IS NOT NULL')
      .andWhere('report.month = :month AND report.year = :year', { month, year });

    if (type) {
      queryBuilder.andWhere('cashflow.type = :type', { type });
    }

    queryBuilder.orderBy('cashflow.date', 'DESC');

    const pagination = await paginate<Cashflow>(queryBuilder, { page, limit });

    let totalIncome = 0;
    let totalExpense = 0;

    for (const item of pagination.items) {
      if (item.type === CashFlowEnum.InCome) totalIncome += item.price;
      else if (item.type === CashFlowEnum.Consumption) totalExpense += item.price;
    }

    // Format items with fixed prices
    const formattedItems = pagination.items.map((item) => ({
      ...item,
      price: parseFloat(item.price.toFixed(2)),
    }));

    const summary = {
      summary: true,
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpense: parseFloat(totalExpense.toFixed(2)),
    };

    return {
      ...pagination,
      summary,
      items: formattedItems,
    };
  }

  async calculateDealerFilialsFromCashflows() {
    const dealerFilials = await this.filialRepository.find({
      where: { type: FilialTypeEnum.DEALER },
    });

    for (const filial of dealerFilials) {
      filial.given = 0;
      filial.owed = 0;
      await this.filialRepository.save(filial);
    }

    const cashflows = await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.kassa', 'kassa')
      .leftJoinAndSelect('kassa.filial', 'filial')
      .where('kassa.id IS NOT NULL')
      .andWhere('kassa.filialType = :type', { type: FilialTypeEnum.DEALER })
      .getMany();

    const filialMap = new Map<string, { filial: Filial; given: number; owed: number }>();

    for (const cashflow of cashflows) {
      const filial = cashflow.kassa?.filial;
      if (!filial) continue;

      const price = cashflow.price || 0;
      const filialId = filial.id;

      if (!filialMap.has(filialId)) {
        filialMap.set(filialId, { filial, given: 0, owed: 0 });
      }

      const summary = filialMap.get(filialId)!;

      if (cashflow.type === 'Приход') {
        summary.given += price;
      } else if (cashflow.type === 'Расход') {
        summary.owed += price;
      }
    }

    for (const { filial, given, owed } of filialMap.values()) {
      filial.given = given;
      filial.owed = owed;
      await this.filialRepository.save(filial);
    }

    return 'Dealer filiallar uchun hisob qayta yangilandi.';
  }

  async hardDeleteAllByKassaId(kassaId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cashflow'larni hard delete
      const deletedCashflows = await queryRunner.manager.delete(Cashflow, {
        kassa: { id: kassaId },
      });

      // 2. Order'larni hard delete
      const deletedOrders = await queryRunner.manager.delete(Order, {
        kassa: { id: kassaId },
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'All cashflows and orders permanently deleted.',
        deletedCashflows: deletedCashflows.affected || 0,
        deletedOrders: deletedOrders.affected || 0,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`Failed to delete: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cashflow = await this.cashflowRepository.findOne({
        where: { id },
        relations: {
          order: {
            product: {
              bar_code: {
                size: true,
                collection: { collection_prices: { discounts: true } },
                factory: true,
                country: true,
              },
            },
            seller: true,
          },
          cashflow_type: true,
          kassa: { filial: true },
          report: true,
          debt: true,
          parent: true,
          child: { report: true },
        },
      });

      if (!cashflow) {
        throw new NotFoundException('Cashflow not found');
      }

      if (cashflow.parent?.id) {
        throw new BadRequestException(`filial manager o'chrshi krak`);
      }

      // Order bilan bog'langan cashflowlarni o'chirmaslik
      const isOrder = (cashflow.tip as string) === CashflowTipEnum.ORDER;
      if (isOrder) {
        throw new BadRequestException('Cannot delete cashflow associated with orders');
      }

      const price = Math.abs(cashflow.price);
      const { kassa, report } = cashflow;

      // Kassa logikasini teskari qilish (was KassaReport before)
      if (kassa) {
        const user = await this.userRepo.findOne({
          where: { id: cashflow.casher?.id },
          relations: ['position'],
        });

        if (kassa.confirmationStatus === KassaReportProgresEnum.ACCEPTED) {
          throw new BadRequestException('Cannot delete cashflow from accepted kassa reports');
        }

        const isDManager = user?.position?.role === UserRoleEnum.D_MANAGER;

        if (cashflow.type === 'Приход') {
          if (cashflow?.is_online) {
            kassa.plasticSum -= price;
          }

          if (isDManager) {
            kassa.totalSum -= price;
            kassa.filial.given -= price;
            kassa.filial.owed = price + Number(kassa.filial.owed);
            kassa.income -= price;
            kassa.expense += price;
          } else {
            kassa.totalSum -= price;
            kassa.income -= price;
          }

          if (cashflow.cashflow_type.slug === 'Инкассация') {
            kassa.cash_collection -= price;
          }

          if (cashflow.cashflow_type.slug === 'Перечисление') {
            kassa.plasticSum -= price;
          }
        } else if (cashflow.type === 'Расход') {
          kassa.totalSum += price;
          kassa.expense -= price;

          if (cashflow?.is_online) {
            kassa.plasticSum += price;
          } else {
            kassa.in_hand += price;
          }

          if (isDManager) {
            kassa.filial.owed -= price;
          }

          if (cashflow.cashflow_type.slug === 'Инкассация') {
            kassa.cash_collection -= price;
          }

          if (cashflow.cashflow_type.slug === 'Перечисление') {
            kassa.plasticSum += price;
          }
        }

        await queryRunner.manager.save(kassa.filial);
        await queryRunner.manager.save(kassa);
      }

      // Report logikasini teskari qilish
      if (report) {
        const user = await this.userRepo.findOne({
          where: { id: cashflow.casher?.id },
          relations: ['position'],
        });

        const isDebtFlow = ['dolg', 'Долг'].includes(cashflow.cashflow_type.slug) && cashflow.debt;

        if (cashflow.type === 'Приход') {
          report.totalIncome -= price;
          if (user?.position?.role === UserRoleEnum.ACCOUNTANT) {
            report.accountantSum -= price;
          } else {
            report.managerSum -= price;
          }

          if (cashflow.cashflow_type.slug === 'Инкассация') {
            report.totalCashCollection -= price;
          }

          if (isDebtFlow) {
            const debt = await this.debtService.findOne(cashflow.debt?.id);
            if (debt) {
              debt.given -= price;
              debt.totalDebt = debt.given - debt.owed;
              if (debt.totalDebt < 0) debt.totalDebt = 0;
              await queryRunner.manager.save(debt);
            }
          }
        } else if (cashflow.type === 'Расход') {
          report.totalExpense -= price;

          if (user?.position?.role === UserRoleEnum.ACCOUNTANT) {
            report.accountantSum += price;
          } else {
            report.managerSum += price;
          }

          if (isDebtFlow) {
            const debt = await this.debtService.findOne(cashflow.debt?.id);
            if (debt) {
              debt.owed -= price;
              debt.totalDebt = debt.given - debt.owed;
              if (debt.totalDebt < 0) debt.totalDebt = 0;
              await queryRunner.manager.save(debt);
            }
          }

          if (cashflow.cashflow_type.slug === 'Инкассация') {
            report.totalCashCollection -= price;
          }
        }

        await queryRunner.manager.save(report);
      }

      // Kassa direct fields logikasini teskari qilish
      if (kassa) {
        if (cashflow.type === 'Приход') {
          kassa.income -= price;

          if (cashflow?.is_online) {
            kassa.plasticSum -= price;
          }
          if (cashflow.cashflow_type.slug === 'Инкассация') {
            kassa.cash_collection -= price;
          }

        } else if (cashflow.type === 'Расход') {
          if (cashflow.child.length) {
            let totalCashCollection = cashflow.child[0].report.totalCashCollection;
            let managerSum = cashflow.child[0].report.managerSum;
            let accountantSum = cashflow.child[0].report.accountantSum;
            let totalIncome = cashflow.child[0].report.totalIncome;
            if (cashflow.cashflow_type.slug === 'bugalter') {
              accountantSum -= price;
            }
            if (cashflow.cashflow_type.slug === 'manager') {
              managerSum -= price;
            }
            if (cashflow.cashflow_type.slug === 'Инкассация') {
              totalCashCollection -= price;
            }
            await this.reportRepository.update({ id: cashflow.child[0].report.id }, {
              accountantSum,
              managerSum,
              totalCashCollection,
              totalIncome: totalIncome - price,
            });
          }
          kassa.expense -= price;

          if (cashflow?.is_online) {
            kassa.plasticSum += price;
          } else {
            kassa.in_hand += price;
          }

          if (cashflow.cashflow_type.slug === 'Инкассация') {
            kassa.cash_collection -= price;
          }
        }

        await queryRunner.manager.save(kassa);
      }

      // Cashflowni o'chirish
      await queryRunner.manager.delete(Cashflow, id);

      await queryRunner.commitTransaction();
      return { message: 'Cashflow successfully deleted' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async updatePriceByOrderIdBulk(orderId: string, newPrice: number) {
    const result = await this.cashflowRepository
      .createQueryBuilder()
      .update()
      .set({ price: newPrice })
      .where('order.id = :orderId', { orderId })
      .execute();

    return {
      success: true,
      updatedCashflowsCount: result.affected || 0,
      message: `${result.affected || 0} ta cashflow yangilandi`,
    };
  }

  async updateOrdersDateFromExcel(kassaId: string, excelData: any[]) {
    let updatedCount = 0;

    for (const excelRow of excelData) {
      // Excel'dan date, price va plasticSum olish
      const excelDateStr = excelRow.date; // "09.05.2025" yoki "09,09,2025" format
      const price = excelRow.price;
      const plasticSum = excelRow.plasticSum;

      if (!excelDateStr || price === undefined || plasticSum === undefined) {
        continue;
      }

      // Date formatini o'zgartirish: "09.05.2025" yoki "09,09,2025" -> "2025-09-09 12:00:00.000000"
      let day, month, year;

      if (excelDateStr.includes(',')) {
        const parts = excelDateStr.split(',');
        [day, month, year] = parts;
      } else if (excelDateStr.includes('.')) {
        const parts = excelDateStr.split('.');
        [day, month, year] = parts;
      } else {
        continue;
      }

      // Validatsiya
      if (!day || !month || !year) {
        continue;
      }

      // Trim qilish (probel bo'lsa)
      day = day.toString().trim();
      month = month.toString().trim();
      year = year.toString().trim();

      const newDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} 12:00:00.000000`;

      try {
        // Shu kassaId, price va plasticSum bo'yicha orderlarni topish
        const ordersToUpdate = await this.orderRepository.find({
          where: {
            kassa: { id: kassaId },
            price: price,
            plasticSum: plasticSum,
          },
        });

        // Har bir orderni update qilish
        for (const order of ordersToUpdate) {
          await this.orderRepository.update({ id: order.id }, { date: newDateStr });

          // Cashflow ham bor bo'lsa, uni ham update qilish
          const cashflows = await this.cashflowRepository.find({
            where: {
              order: { id: order.id },
            },
          });

          for (const cashflow of cashflows) {
            await this.cashflowRepository.update({ id: cashflow.id }, { date: newDateStr });
          }

          updatedCount++;
        }
      } catch (error) {
        console.error(`Error processing row:`, excelRow, error);
      }
    }

    return { updatedCount };
  }

  async getCashflowsFromOrder(id: string) {
    return await this.cashflowRepository.find({
      where: {
        order: { id },
      },
    });
  }

  async getOneBySlug(slug: string) {
    return await this.cashflowTypeRepository
      .findOne({
        where: { slug },
      })
      .catch(() => {
        throw new NotFoundException('Cashflow type not found');
      });
  }

  async updateCashflowInReport(cashflows: any[]) {
    const un_updated_rows: { index: number; reason: string }[] = [];
    const updated_rows = [];

    const queryRunner = this.cashflowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let i = 2;

    try {
      for (const cashflow of cashflows) {
        const { id, date, comment } = cashflow;
        let parsedDate: dayjs.Dayjs | null = null;

        if (date instanceof Date) {
          parsedDate = dayjs(date);
        } else if (typeof date === 'string') {
          const formats = [
            'YYYY-MM-DD',
            'DD-MM-YYYY',
            'DD/MM/YYYY',
            'DD.MM.YYYY',
            'DD.MM.YYYY HH:mm:ss',
            'YYYY-MM-DD HH:mm',
          ];
          for (const f of formats) {
            const d = dayjs(date, f, true);
            if (d.isValid()) {
              parsedDate = d;
              break;
            }
          }
        }

        if (!parsedDate) {
          un_updated_rows.push({ index: i, reason: `invalid date: ${date}` });
          i++;
          continue;
        }

        const find_cashflow = await queryRunner.manager.findOne(Cashflow, {
          where: { id },
          relations: { report: true },
        });

        if (!find_cashflow || !find_cashflow?.report?.id) {
          un_updated_rows.push({ index: i, reason: `invalid cashflow: ${id} report: ${find_cashflow?.report?.id}` });
          i++;
          continue;
        }

        const report = await queryRunner.manager.findOne(Report, { where: { month: +parsedDate.month() + 1, filialType: FilialType.FILIAL } });

        if (!report) {
          un_updated_rows.push({ index: i, reason: `invalid report: ${+parsedDate.month() + 1}` });
          i++;
          continue;
        }

        await queryRunner.manager.update(Cashflow, { id }, {
          report: report.id,
          date: parsedDate.toDate(),
          ...(comment && { comment: comment }),
        } as unknown as Cashflow);

        updated_rows.push({ index: i, id });
        i++;
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('❌ Transaction failed:', error);
    } finally {
      await queryRunner.release();
    }

    return {
      message: 'Cashflow update completed',
      un_updated_rows,
      updated_rows,
    };
  }

  async updateCashflowDate(cashflows: any[], kassa_id: string) {
    const un_updated_rows: { index: number; reason: string }[] = [];
    const updated_rows = [];
    const updated_child_rows = [];

    const queryRunner = this.cashflowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let i = 0;

    try {
      // Validate Context Kassa
      const contextKassa = await queryRunner.manager.findOne(Kassa, {
        where: { id: kassa_id },
        relations: { filial: true },
      });

      if (!contextKassa) throw new BadRequestException('Kassa topilmadi!');

      for (const cashflowItem of cashflows) {
        i++;
        try {
          const {
            date,
            id,
          } = cashflowItem;

          // --- 1. Basic Validation ---
          if (!id) {
            un_updated_rows.push({ index: i, reason: 'Missing ID' });
            continue;
          }
           if (!date) {
            un_updated_rows.push({ index: i, reason: 'Missing date' });
            continue;
          }

          // --- 2. Date Parsing ---
          let parsedDate: dayjs.Dayjs | null = null;
          if (date instanceof Date) {
            parsedDate = dayjs(date);
          } else {
             const formats = [
              'YYYY-MM-DD',
              'DD-MM-YYYY',
              'DD/MM/YYYY',
              'DD.MM.YYYY',
              'DD.MM.YYYY HH:mm:ss',
              'YYYY-MM-DD HH:mm',
              'YYYY-MM-DDTHH:mm:ss.SSSZ',
            ];

            // Try strict parsing first
             for (const f of formats) {
               const test = dayjs(date, f, true);
               if (test.isValid()) {
                 parsedDate = test;
                 break;
               }
             }
             // Fallback to loose parsing
             if (!parsedDate || !parsedDate.isValid()) {
                 const loose = dayjs(date);
                 if (loose.isValid()) parsedDate = loose;
             }
          }

          if (!parsedDate || !parsedDate.isValid()) {
            un_updated_rows.push({ index: i, reason: `Invalid date format: ${date}` });
            continue;
          }
          const newDate = parsedDate.toDate();

          // --- 3. Fetch Existing Cashflow ---
          const existingCashflow = await queryRunner.manager.findOne(Cashflow, {
            where: { id },
            relations: { filial: true, child: true, order: true },
          });

          if (!existingCashflow) {
            un_updated_rows.push({ index: i, reason: 'Cashflow not found in DB' });
            continue;
          }

          // If cashflow has no filial, fallback to context kassa filial
          const filialId = existingCashflow.filial?.id || contextKassa.filial?.id;

          // --- 4. Find Correct Kassa for New Date ---
          // Logic: Find kassa of this filial that was active at 'newDate'
          const targetKassa = await queryRunner.manager.findOne(Kassa, {
            where: [
                { filial: { id: filialId }, startDate: LessThanOrEqual(newDate), endDate: MoreThanOrEqual(newDate) },
                { filial: { id: filialId }, startDate: LessThanOrEqual(newDate), endDate: IsNull() } // For currently open kassa
            ],
            order: { startDate: 'DESC' }
          });

          if (!targetKassa) {
             console.warn(`No active Kassa found for date ${parsedDate.format('YYYY-MM-DD')} for filial ${filialId}`);
             un_updated_rows.push({ index: i, reason: `Active Kassa not found for date ${parsedDate.format('YYYY-MM-DD')}` });
             continue;
          }

          // --- 5. Update Operations ---

          // A. Update Children (if any)
           if (existingCashflow.child?.length) {
              const reportMonth = parsedDate.month() + 1;
              const reportYear = parsedDate.year();

              const report = await queryRunner.manager.findOne(Report, {
                  where: {
                      filialType: FilialType.FILIAL,
                      month: reportMonth,
                      year: reportYear
                  }
              });

              for (const child of existingCashflow.child) {
                  await queryRunner.manager.update(Cashflow, child.id, {
                      report: report ? report : null, // If report missing, set null or keep old? Logic implies null if missing.
                      date: newDate,
                  });
                   updated_child_rows.push({ child_id: child.id, date: newDate });
              }
           }

           // B. Update Order (if exists)
           if (existingCashflow.order) {
               const updatePayload: any = {
                   date: newDate,
                   kassa: targetKassa
               };

               await queryRunner.manager.update(Order, existingCashflow.order.id, updatePayload);
           }

           // C. Update Main Cashflow
           await queryRunner.manager.update(Cashflow, existingCashflow.id, {
               date: newDate,
               kassa: targetKassa
           });

           updated_rows.push({ index: i, id: existingCashflow.id });

        } catch (rowError) {
             console.error(`Row ${i} Error:`, rowError);
             un_updated_rows.push({ index: i, reason: rowError.message });
        }
      }

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      console.error('Transaction Failed:', err);
      // Don't throw entire failure if possible, but the outer structure implies the whole batch fails if transaction fails.
      // However, we catch inside the loop for rows, so only critical failures (like DB connection lost) reach here.
      throw new BadRequestException('Transaction failed: ' + err.message);
    } finally {
        await queryRunner.release();
    }

    return {
      message: 'Cashflow update completed',
      un_updated_rows,
      updated_rows,
      updated_child_rows,
    };
  }


  async updatecosts(kassa_id: string) {
    const foundKassa = await this.kassaRepository.findOne({
      where: { id: kassa_id },
    });

    if (!foundKassa) throw new BadRequestException('Kassa not found!');
    const opening_balance = foundKassa.opening_balance < 0 ? Number(foundKassa?.opening_balance) || 0 : 0;

    const kassa = `
WITH orderSums AS (
  SELECT
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN o.price + o."plasticSum" ELSE 0 END), 0) AS "sale",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') AND o."isDebt" != true THEN o.price ELSE 0 END), 0) AS in_hand,
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') AND o."isDebt" != true THEN o."plasticSum" ELSE 0 END), 0) AS "plasticSum",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN o."additionalProfitSum" ELSE 0 END), 0) AS "additionalProfitSum",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN o."netProfitSum" ELSE 0 END), 0) AS "netProfitSum",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN o."discountSum" ELSE 0 END), 0) AS "discountSum",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN o.kv ELSE 0 END), 0) AS "totalSellKv",
    COALESCE(SUM(CASE WHEN o.status = 'canceled' THEN o.price ELSE 0 END), 0) AS "returnSale",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') THEN (CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END) ELSE 0 END), 0) AS "sellCount",
    COALESCE(SUM(CASE WHEN o.status = 'accepted' AND o."isDebt" = true THEN o.price + o."plasticSum" ELSE 0 END), 0) AS "debtSum",
    COALESCE(SUM(CASE WHEN o.status = 'accepted' AND o."isDebt" = true THEN o.kv ELSE 0 END), 0) AS "debtKv",
    COALESCE(SUM(CASE WHEN o.status = 'accepted' AND o."isDebt" = true THEN (CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END) ELSE 0 END), 0) AS "debtCount",
    COALESCE(SUM(CASE WHEN o.status IN('accepted', 'canceled') AND p."isInternetShop" = true THEN o.price + o."plasticSum" ELSE 0 END), 0) AS "internetShopSum"
  FROM "order" o
  LEFT JOIN qrbase q ON o."barCodeId" = q.id
  LEFT JOIN product p ON o."productId" = p.id
  WHERE o."kassaId" = $1
),
cashflowSums AS (
  SELECT
    COALESCE(SUM(CASE WHEN c.type = 'Приход' and c.tip = 'cashflow' and ct.slug != 'Перечисление' THEN c.price ELSE 0 END), 0) AS "totalIncome",
    COALESCE(SUM(CASE WHEN c.type = 'Расход' and c.tip = 'cashflow' THEN c.price ELSE 0 END), 0) AS "totalExpence",
    COALESCE(SUM(CASE WHEN ct.slug = 'Инкассация' THEN c.price ELSE 0 END), 0) AS "cashCollection",
    COALESCE(SUM(CASE WHEN ct.slug = 'return' THEN c.price ELSE 0 END), 0) AS "returnSale",
    COALESCE(SUM(CASE WHEN ct.slug = 'Перечисление' THEN c.price ELSE 0 END), 0) AS "perechesleniya"
  FROM cashflow c
  LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
  WHERE c."kassaId" = $1
)
UPDATE "kassa" AS k
SET
  "additionalProfitTotalSum" = o."additionalProfitSum",
  "netProfitTotalSum" = o."netProfitSum",
  "totalSize" = o."totalSellKv",
  "plasticSum" = o."plasticSum" + c."perechesleniya",
  "sale" = o."sale",
  "cash_collection" = c."cashCollection",
  "discount" = o."discountSum",
  "income" = c."totalIncome" + c."perechesleniya",
  "expense" = c."totalExpence",
  "totalSellCount" = o."sellCount",
  "return_sale" = c."returnSale",
  "in_hand" = (((o.in_hand + c."totalIncome") - (c."totalExpence" + c."returnSale")) + $2) - c."perechesleniya",
  "totalSum" = (((o.in_hand + c."totalIncome") - (c."totalExpence" + c."returnSale")) + $2) - c."perechesleniya" + o."plasticSum" + c."perechesleniya",
  "internetShopSum" = o."internetShopSum",
  "debt_count" = o."debtCount",
  "debt_kv" = o."debtKv",
  "debt_sum" = o."debtSum"
FROM orderSums o, cashflowSums c
WHERE k.id = $1;
`;


    await this.cashflowRepository.query(kassa, [kassa_id, opening_balance]);

    return 'okay';
  }

  parseExcelBuffer(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Normalize keys
    return rawData.map((row: any) => {
      const normalized: any = {};
      for (const key in row) {
        normalized[key.toLowerCase().trim()] = row[key];
      }
      return normalized;
    });
  }

  async dealerCashflow(body) {
    const { is_online, kassa_report, price, comment } = body;

    // kassa_report now refers to a Kassa id
    const kassaEntity = await this.kassaRepository.findOne({
      where: { id: kassa_report },
      relations: {
        filial: true,
      },
    });

    // Validate important entities
    if (!kassaEntity) {
      throw new BadRequestException('Kassa not found');
    }

    let { year, month, filial } = kassaEntity as any;

    if (!filial) {
      filial = kassaEntity.filial;
    }

    if (!filial) {
      throw new BadRequestException('filial not found');
    }

    const [[filialReport], [dealerReport]] = await Promise.all([
      this.reportService.findAllByYearMonthAndFilialType(year, month, FilialType.FILIAL),
      this.reportService.findAllByYearMonthAndFilialType(year, month, FilialType.DEALER),
    ]);

    if (!filialReport || !dealerReport) {
      throw new BadRequestException('Reports for this month/year not found');
    }

    const parsedPrice = Number(price || 0);

    if (parsedPrice > filial.owed) {
      throw new BadRequestException('Долг меньше указанной цены!');
    }

    // === Common reusable parts ===
    const now = new Date().toISOString();
    const cashflow_types = await this.cashflowTypeRepository.find({ where: { slug: In(['Перечисление', 'delaer']) } });
    const dealerType = cashflow_types.find(el => el.slug === 'delaer');
    const transferType = cashflow_types.find(el => el.slug === 'Перечисление');

    const dManager = await this.userRepo.findOne({
      where: { position: { role: UserRoleEnum.D_MANAGER } },
    });

    const userRole = is_online ? UserRoleEnum.ACCOUNTANT : UserRoleEnum.M_MANAGER;
    const cashflowComment = is_online
      ? `${filial.title} dealer "перечисления" qildi.`
      : `${filial.title} dealer naqd kassa.`;

    const casher = await this.userRepo.findOne({
      where: { position: { role: userRole } },
      relations: { avatar: true, position: true },
    });

    if (!casher || !dManager) {
      throw new BadRequestException('Required users not found');
    }

    // === Prepare cashflow entries ===
    const baseCashflow = {
      price: parsedPrice,
      type: CashFlowEnum.InCome,
      tip: CashflowTipEnum.CASHFLOW,
      date: now,
      is_static: true,
      filial: filial.id,
    };

    const kassaCashflow = this.cashflowRepository.create({
      ...baseCashflow,
      comment,
      cashflow_type: dealerType,
      kassa: kassaEntity,
      casher: dManager,
      is_online,
      filial: filial.id,
    } as unknown as Cashflow);

    // Cashflow saves
    const kassaCashflowSaved = await this.cashflowRepository.save(kassaCashflow);

    const filialCashflow = this.cashflowRepository.create({
      ...baseCashflow,
      comment: cashflowComment,
      cashflow_type: is_online ? transferType : dealerType,
      report: filialReport,
      casher,
      is_online,
      parent: kassaCashflowSaved,
    } as unknown as Cashflow);
    await this.cashflowRepository.save(filialCashflow);

    // === Parallel updates ===
    await Promise.all([
      // Kassa & filial updates
      this.filialRepository.update(
        { id: filial.id },
        {
          given: Number(filial?.given || 0) + parsedPrice,
          owed: Number(filial?.owed || 0) - parsedPrice,
        },
      ),

      this.kassaRepository.update(kassa_report, {
        income: Number(kassaEntity?.income || 0) + parsedPrice,
        ...(is_online ? { plasticSum: Number(kassaEntity.plasticSum) + parsedPrice } : { in_hand: Number(kassaEntity.in_hand) + parsedPrice }),
      }),

      // Filial report update
      this.reportService.update(filialReport.id, {
        totalIncome: Number(filialReport?.totalIncome || 0) + parsedPrice,
        ...(is_online
          ? {
            totalPlasticSum: Number(filialReport?.totalPlasticSum || 0) + parsedPrice,
            accountantSum: Number(filialReport?.accountantSum || 0) + parsedPrice,
          }
          : {
            managerSum: Number(filialReport?.managerSum || 0) + parsedPrice,
          }),
      }),

      // Dealer report update
      this.reportService.update(dealerReport.id, {
        totalIncome: Number(dealerReport?.totalIncome || 0) + parsedPrice,
        ...(is_online
          ? {
            totalPlasticSum: Number(filialReport?.totalPlasticSum || 0) + parsedPrice,
          }
          : {
            in_hand: Number(dealerReport?.totalIncome || 0) + parsedPrice,
          }),
      }),
    ]);
  }

  async reverseDealerCashflow(cashflow_id: string) {
    // === 1 Fetch the target cashflow with relations ===
    const cashflow = await this.cashflowRepository.findOne({
      where: { id: cashflow_id },
      relations: ['kassa', 'report', 'cashflow_type', 'parent'],
    });

    if (!cashflow) {
      throw new BadRequestException('Cashflow not found');
    }

    const { price, is_online, kassa: kassaEntity, report: filialReport } = cashflow;

    // === 2 Fetch related reports ===
    const { year, month } = kassaEntity as any;
    const [[dealerReport]] = await Promise.all([
      this.reportService.findAllByYearMonthAndFilialType(year, month, FilialType.DEALER),
    ]);

    if (!dealerReport || !filialReport) {
      throw new BadRequestException('Reports for this cashflow not found');
    }

    const parsedPrice = Number(price || 0);

    // === 3 Reverse report & kassa values ===
    await Promise.all([
      // Kassa update
      this.kassaRepository.update(kassaEntity.id, {
        income: Number(kassaEntity?.income || 0) - parsedPrice,
      }),

      // Filial report update
      this.reportService.update(filialReport.id, {
        totalIncome: Number(filialReport?.totalIncome || 0) - parsedPrice,
        ...(is_online
          ? {
            totalPlasticSum: Number(filialReport?.totalPlasticSum || 0) - parsedPrice,
            accountantSum: Number(filialReport?.accountantSum || 0) - parsedPrice,
          }
          : {
            managerSum: Number(filialReport?.managerSum || 0) - parsedPrice,
          }),
      }),

      // Dealer report update
      this.reportService.update(dealerReport.id, {
        totalIncome: Number(dealerReport?.totalIncome || 0) - parsedPrice,
      }),
    ]);

    // === 4 Delete the cashflow and its child if any ===
    const childCashflows = await this.cashflowRepository.find({
      where: { parent: { id: cashflow_id } },
    });

    // Remove children first (if exist)
    if (childCashflows.length) {
      await this.cashflowRepository.remove(childCashflows);
    }

    // Then remove the main cashflow
    await this.cashflowRepository.remove(cashflow);

    return { message: `Cashflow #${cashflow_id} reversed successfully` };
  }

  async createPending(value: any, userId: string): Promise<Cashflow> {
    const cashflow_type = value.cashflow_type;
    const cashflow = this.cashflowRepository.create({
      price: value.price,
      type: value.type,
      tip: value.tip,
      comment: value.comment || '',
      title: value.title || '',
      kassa: { id: value.kassa },
      order: value.order ? { id: value.order } : null,
      casher: { id: userId },
      cashflow_type: cashflow_type ? { id: cashflow_type } : null,
      status: CashflowStatusEnum.PENDING,
      seller: value.seller ? { id: value.seller } : null,
    });
    return await this.cashflowRepository.save(cashflow);
  }

  async findPendingByOrderId(orderId: string): Promise<Cashflow | null> {
    return await this.cashflowRepository.findOne({
      where: {
        order: { id: orderId },
        status: CashflowStatusEnum.PENDING,
      },
      relations: ['kassa', 'order', 'cashflow_type'],
    });
  }

  async findByOrderId(orderId: string): Promise<Cashflow[]> {
    return await this.cashflowRepository.find({
      where: {
        order: { id: orderId },
      },
      relations: ['kassa', 'order', 'cashflow_type'],
    });
  }

  async updateCashflowKassa(cashflowId: string, kassaId: string): Promise<void> {
    await this.cashflowRepository.update({ id: cashflowId }, { kassa: { id: kassaId } });
  }

  async approveCashflow(cashflowId: string, casherId?: string): Promise<Cashflow> {
    const cashflow = await this.cashflowRepository.findOne({
      where: { id: cashflowId },
      relations: {
        order: {
          product: {
            bar_code: {
              size: true,
              collection: { collection_prices: { discounts: true } },
              factory: true,
              country: true,
            },
          },
          seller: true,
        },
        cashflow_type: true,
        kassa: { filial: true },
      },
    });

    if (!cashflow) throw new BadRequestException('Cashflow not found');
    if (cashflow.status !== CashflowStatusEnum.PENDING) {
      throw new BadRequestException('Cashflow is not in PENDING status');
    }

    cashflow.status = CashflowStatusEnum.APPROVED;
    if (casherId) {
      cashflow.casher = { id: casherId } as any;
    }
    cashflow.title = cashflow?.cashflow_type?.title || '';

    const price = Math.abs(cashflow.price);
    const order = cashflow.order;
    const isOrder = cashflow.tip === CashflowTipEnum.ORDER;
    const kassa = cashflow.kassa;
    const today = dayjs().format('YYYY-MM-DD');

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (cashflow.type === CashFlowEnum.InCome && kassa?.id) {
        if (isOrder && order) {
          await this.processManagerDiscount(queryRunner, order, true);

          if (order.isDebt) {
            kassa.debt_sum += price;
            kassa.debt_kv += order.kv;
            kassa.debt_count += order.product.bar_code.isMetric ? 1 : order.x;
          } else {
            kassa.in_hand += order.price;
          }
          kassa.plasticSum += order.plasticSum || 0;
          kassa.sale += price;
          kassa.discount += (order.discountSum || 0) + (order.managerDiscountSum || 0);
          kassa.netProfitTotalSum += order.netProfitSum || 0;
          kassa.additionalProfitTotalSum += order.additionalProfitSum || 0;
          const barCode = order?.product?.bar_code;
          const size = barCode?.size;
          if (barCode && size) {
            kassa.totalSize += barCode.isMetric ? (order.x / 100) * size.x : size.kv * order.x;
            kassa.totalSellCount += barCode.isMetric ? 1 : order.x;
          }

          await this.updateSellerReportItem(queryRunner, order, today, true);
          await this.updateReportItems(queryRunner, order, true, kassa, null);

          // Use kassa directly instead of getKassareportFromKassaId - kassa IS the monthly entity now
          const kassaWithReport = await queryRunner.manager.findOne(Kassa, {
            where: { id: kassa.id },
            relations: { report: true },
          });

          if (kassaWithReport) {
            const oneReport = kassaWithReport.report;
            if (oneReport) {
              oneReport.totalSale += price;
              oneReport.totalPlasticSum += order.plasticSum || 0;
              oneReport.accountantSum += order.plasticSum || 0;
              oneReport.totalDiscount += (order.discountSum || 0) + (order.managerDiscountSum || 0);
              oneReport.netProfitTotalSum += order.netProfitSum || 0;
              oneReport.additionalProfitTotalSum += order.additionalProfitSum || 0;
              if (barCode && size) {
                oneReport.totalSize += barCode.isMetric ? (order.x / 100) * size.x : size.kv * order.x;
                oneReport.totalSellCount += barCode.isMetric ? 1 : order.x;
              }
              await this.reportService.save(oneReport);
            }
          }
        }
      }

      // Order statusini accepted ga o'zgartirish
      if (isOrder && order) {
        await queryRunner.manager.update('order', order.id, { status: OrderEnum.Accept });
      }

      if (kassa) await queryRunner.manager.save(kassa);
      await queryRunner.manager.save(cashflow);
      await queryRunner.commitTransaction();

      return cashflow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * CANCEL (qaytarish) uchun: Yangi Расход cashflow yaratadi.
   * Totallardan AYIRMAYDI. Faqat:
   * - kassa.return_sale += price
   * - kassa.return_size += kv
   * - kassa.in_hand -= in_hand_amount
   * - kassa.totalSaleReturn += price
   * - kassa.totalSaleSizeReturn += kv
   * - report.totalSaleReturn += price
   */
  async createReturnCashflow(
    value: {
      price: number;
      kassa: string;
      order: string;
      cashflow_type?: string;
      comment?: string;
      title?: string;
      in_hand_amount: number;
      kv: number;
    },
    userId: string,
  ): Promise<void> {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cashflow yaratish (APPROVED, Расход)
      const cashflow = this.cashflowRepository.create({
        price: value.price,
        type: CashFlowEnum.Consumption,
        tip: CashflowTipEnum.ORDER,
        comment: value.comment || '',
        title: value.title || '',
        kassa: { id: value.kassa },
        order: { id: value.order },
        casher: { id: userId },
        cashflow_type: value.cashflow_type ? { id: value.cashflow_type } : null,
        status: CashflowStatusEnum.APPROVED,
      } as any);
      await queryRunner.manager.save(cashflow);

      // 2. Kassa: faqat return fieldlar va in_hand
      const kassa = await queryRunner.manager.findOne(Kassa, {
        where: { id: value.kassa },
        relations: { report: true },
      });

      if (kassa) {
        kassa.return_sale = (kassa.return_sale || 0) + value.price;
        kassa.return_size = (kassa.return_size || 0) + value.kv;
        kassa.in_hand = (kassa.in_hand || 0) - value.in_hand_amount;

        // Update kassa-level return fields (was kassaReport before)
        kassa.totalSaleReturn = (kassa.totalSaleReturn || 0) + value.price;
        kassa.totalSaleSizeReturn = (kassa.totalSaleSizeReturn || 0) + value.kv;

        await queryRunner.manager.save(kassa);

        // 3. Report: faqat totalSaleReturn
        const report = kassa.report;
        if (report) {
          report.totalSaleReturn = (report.totalSaleReturn || 0) + value.price;
          await queryRunner.manager.save(report);
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async rejectCashflow(cashflowId: string): Promise<Cashflow> {
    const cashflow = await this.cashflowRepository.findOne({
      where: { id: cashflowId },
    });

    if (!cashflow) throw new BadRequestException('Cashflow not found');

    cashflow.status = CashflowStatusEnum.REJECTED;
    return await this.cashflowRepository.save(cashflow);
  }

  async reverseCashflow(cashflowId: string): Promise<Cashflow> {
    const cashflow = await this.cashflowRepository.findOne({
      where: { id: cashflowId },
      relations: {
        order: {
          product: {
            bar_code: {
              size: true,
              collection: { collection_prices: { discounts: true } },
              factory: true,
              country: true,
            },
          },
          seller: true,
        },
        cashflow_type: true,
        kassa: { filial: true },
      },
    });

    if (!cashflow) throw new BadRequestException('Cashflow not found');
    if (cashflow.status !== CashflowStatusEnum.APPROVED) {
      throw new BadRequestException('Only APPROVED cashflows can be reversed');
    }

    const price = Math.abs(cashflow.price);
    const order = cashflow.order;
    const isOrder = cashflow.tip === CashflowTipEnum.ORDER;
    const kassa = cashflow.kassa;
    const today = dayjs().format('YYYY-MM-DD');

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (cashflow.type === CashFlowEnum.InCome && kassa?.id) {
        if (isOrder && order) {
          await this.processManagerDiscount(queryRunner, order, false);

          if (order.isDebt) {
            kassa.debt_sum -= price;
            kassa.debt_kv -= order.kv;
            kassa.debt_count -= order.product.bar_code.isMetric ? 1 : order.x;
          } else {
            kassa.in_hand -= order.price;
          }
          kassa.plasticSum -= order.plasticSum || 0;
          kassa.sale -= price;
          kassa.discount -= (order.discountSum || 0) + (order.managerDiscountSum || 0);
          kassa.netProfitTotalSum -= order.netProfitSum || 0;
          kassa.additionalProfitTotalSum -= order.additionalProfitSum || 0;
          const barCode = order?.product?.bar_code;
          const size = barCode?.size;
          if (barCode && size) {
            kassa.totalSize -= barCode.isMetric ? (order.x / 100) * size.x : size.kv * order.x;
            kassa.totalSellCount -= barCode.isMetric ? 1 : order.x;
          }

          await this.updateSellerReportItem(queryRunner, order, today, false);
          await this.updateReportItems(queryRunner, order, false, kassa, null);

          // Use kassa directly instead of getKassareportFromKassaId
          const kassaWithReport = await queryRunner.manager.findOne(Kassa, {
            where: { id: kassa.id },
            relations: { report: true },
          });

          if (kassaWithReport) {
            const oneReport = kassaWithReport.report;
            if (oneReport) {
              oneReport.totalSale -= price;
              oneReport.totalPlasticSum -= order.plasticSum || 0;
              oneReport.accountantSum -= order.plasticSum || 0;
              oneReport.totalDiscount -= (order.discountSum || 0) + (order.managerDiscountSum || 0);
              oneReport.netProfitTotalSum -= order.netProfitSum || 0;
              oneReport.additionalProfitTotalSum -= order.additionalProfitSum || 0;
              if (barCode && size) {
                oneReport.totalSize -= barCode.isMetric ? (order.x / 100) * size.x : size.kv * order.x;
                oneReport.totalSellCount -= barCode.isMetric ? 1 : order.x;
              }
              await this.reportService.save(oneReport);
            }
          }
        }
      }

      cashflow.status = CashflowStatusEnum.CANCELLED;
      if (kassa) await queryRunner.manager.save(kassa);
      await queryRunner.manager.save(cashflow);
      await queryRunner.commitTransaction();

      return cashflow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }
}
