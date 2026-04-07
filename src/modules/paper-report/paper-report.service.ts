import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreatePaperReportDto, PaperReportFilters } from './dto/create-paper-report.dto';
import { UpdatePaperReportDto } from './dto/update-paper-report.dto';
import { PaperReport } from './paper-report.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Order } from '@modules/order/order.entity';
import { CashFlowEnum, FilialTypeEnum, OrderEnum, UserRoleEnum } from 'src/infra/shared/enum';
import { ClientService } from '@modules/client/client.service';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { Debt } from '@modules/debt/debt.entity';
import * as XLSX from 'xlsx';
import { TransferService } from '@modules/transfer/transfer.service';
import { ReportService } from '@modules/report/report.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ru';
import { Filial } from '@modules/filial/filial.entity';

dayjs.extend(utc);
dayjs.extend(timezone);


dayjs.locale('uz');

@Injectable()
export class PaperReportService {
  constructor(
    @InjectRepository(PaperReport)
    private readonly paperReportRepository: Repository<PaperReport>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(Debt)
    private readonly debtRepository: Repository<Debt>,

    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,

    private readonly transferService: TransferService,
    private readonly reportService: ReportService,
    private readonly entityManager: EntityManager,
    private readonly clientService: ClientService,
  ) {
  }

  async create(dto: CreatePaperReportDto): Promise<PaperReport> {
    const report = new PaperReport();
    report.title = dto.title;
    report.price = dto.price;
    report.kv = dto.kv;
    report.filial = { id: dto.filialId } as any;
    return this.paperReportRepository.save(report);
  }

  async findAll(filters?: PaperReportFilters, options?: IPaginationOptions, req?: any): Promise<Pagination<PaperReport>> {
    const queryBuilder = this.paperReportRepository.createQueryBuilder('paperReport');

    if (filters) {
      if (filters.year && filters.month) {
        const startDate = new Date(filters.year, filters.month - 1, 1);
        const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);

        queryBuilder.andWhere('paperReport.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (filters.filialId) {
        queryBuilder.andWhere('paperReport.filial.id = :filialId', {
          filialId: filters.filialId,
        });
      } else {
        // If no filialId is provided, return empty array
        queryBuilder.andWhere('1 = 0');
      }
    } else {
      // If no filters are provided, return empty array
      queryBuilder.andWhere('1 = 0');
    }

    queryBuilder.orderBy('paperReport.date', 'DESC');

    const paginationOptions: IPaginationOptions = {
      page: options?.page || 1,
      limit: options?.limit || 10,
      ...options,
    };

    return paginate<PaperReport>(queryBuilder, paginationOptions);
  }

  async findOne(id: string): Promise<PaperReport> {
    const report = await this.paperReportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('PaperReport topilmadi');
    return report;
  }

  async update(id: string, dto: UpdatePaperReportDto): Promise<PaperReport> {
    const report = await this.findOne(id);
    const updated = this.paperReportRepository.merge(report, dto);
    return this.paperReportRepository.save(updated);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.paperReportRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('PaperReport topilmadi');
    return { deleted: true };
  }

  async getMonthlyStatsByFilial(filialId: string | undefined, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Sotuvlar - umumiy
    const salesQuery = this.kassaRepository
      .createQueryBuilder('report')
      .where('report.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (filialId) {
      salesQuery.andWhere('report.filialId = :filialId', { filialId });
    }

    // Filial sotuvlari
    const salesQueryFilial = this.kassaRepository
      .createQueryBuilder('report')
      .where('report.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('report.filialType = :type', { type: FilialTypeEnum.FILIAL });

    if (filialId) {
      salesQueryFilial.andWhere('report.filialId = :filialId', { filialId });
    }

    // Dealer sotuvlari
    const salesQueryDealer = this.kassaRepository
      .createQueryBuilder('report')
      .where('report.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('report.filialType = :type', { type: FilialTypeEnum.DEALER });

    if (filialId) {
      salesQueryDealer.andWhere('report.filialId = :filialId', { filialId });
    }

    // Naqd pul uchun alohida querylar
    const salesQueryFilialNaqd = this.kassaRepository
      .createQueryBuilder('report')
      .where('report.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('report.filialType = :type', { type: FilialTypeEnum.FILIAL });

    if (filialId) {
      salesQueryFilialNaqd.andWhere('report.filialId = :filialId', { filialId }); // TUZATILDI
    }

    const salesQueryDealerNaqd = this.kassaRepository
      .createQueryBuilder('report')
      .where('report.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('report.filialType = :type', { type: FilialTypeEnum.DEALER });

    if (filialId) {
      salesQueryDealerNaqd.andWhere('report.filialId = :filialId', { filialId }); // TUZATILDI
    }

    // Querylarni bajarish
    const [sales, salesFilial, salesDealer, salesFilialNaqd, salesDealerNaqd] = await Promise.all([
      salesQuery.getMany(),
      salesQueryFilial.getMany(),
      salesQueryDealer.getMany(),
      salesQueryFilialNaqd.getMany(),
      salesQueryDealerNaqd.getMany(),
    ]);

    // Asosiy hisoblar
    const skidka = sales.reduce((acc, r) => acc + Number(r.discount || 0), 0);
    const inkasatsiya = sales.reduce((acc, r) => acc + Number(r.cash_collection || 0), 0);
    const terminal = salesFilial.reduce((acc, r) => acc + Number(r.plasticSum || 0), 0);
    const terminalDealer = salesDealer.reduce((acc, r) => acc + Number(r.plasticSum || 0), 0);

    // Naqd hisoblar - ikkala field ham totalSum ishlatiladi (TUZATILDI)
    const naqdFilial = salesFilialNaqd.reduce((acc, r) => acc + Number(r.in_hand || 0), 0);
    const naqdDealer = salesDealerNaqd.reduce((acc, r) => acc + Number((r.income || 0) - (r.plasticSum || 0)), 0);

    const foyda1 = sales.reduce((acc, r) => acc + Number(r.netProfitTotalSum || 0), 0);

    // Magazin rasxodlari - TUZATILGAN query
    const storeExpensesQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title IN (:...titles)', {
        titles: ['Магазин', 'Аренда', 'Корпоротив', 'Логистика', 'Банк%'],
      });

    if (filialId) {
      storeExpensesQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Boss rasxod va kirimlar
    const bosRasxodQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Босс' })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.Consumption });

    if (filialId) {
      bosRasxodQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    const bosPrixodQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Босс' })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.InCome });

    if (filialId) {
      bosPrixodQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Navar rasxodlari
    const navarRasxodiQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Навар' });

    if (filialId) {
      navarRasxodiQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Tamojnya
    const tamojnyaQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Таможня' });

    if (filialId) {
      tamojnyaQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Qolgan pul
    const qolganPulQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Сальдо' })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.InCome });

    if (filialId) {
      qolganPulQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Dolg - TUZATILGAN
    const dolgQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Долг' });

    if (filialId) {
      dolgQuery.andWhere('cashflow.filialId = :filialId', { filialId }); // TUZATILDI
    }

    // Bank - TUZATILGAN
    const bankQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Банк%' });

    if (filialId) {
      bankQuery.andWhere('cashflow.filialId = :filialId', { filialId }); // TUZATILDI
    }

    // Kredit - TUZATILGAN
    const kreditQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Кредит' });

    if (filialId) {
      kreditQuery.andWhere('cashflow.filialId = :filialId', { filialId }); // TUZATILDI
    }

    const logistikaQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Логистика' });

    if (filialId) {
      kreditQuery.andWhere('cashflow.filialId = :filialId', { filialId }); // TUZATILDI
    }

    // Postavshik - plastic (buxgalter orqali)
    const postavshikPlasticQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .leftJoin('cashflow.createdBy', 'createdBy')
      .leftJoin('createdBy.position', 'position')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Поставщики' })
      .andWhere('position.role = :role', { role: UserRoleEnum.ACCOUNTANT });

    if (filialId) {
      postavshikPlasticQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Postavshik - naqd (manager orqali)
    const postavshikNaqdQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .leftJoin('cashflow.createdBy', 'createdBy')
      .leftJoin('createdBy.position', 'position')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow_type.title = :title', { title: 'Поставщики' })
      .andWhere('position.role = :role', { role: UserRoleEnum.M_MANAGER });

    if (filialId) {
      postavshikNaqdQuery.andWhere('cashflow.filialId = :filialId', { filialId });
    }

    // Barcha cashflow querylarni parallel bajarish
    const [
      storeExpenses,
      bossRasxod,
      bossPrixod,
      navarRasxodlar,
      tamojnya,
      qolganPul,
      dolg,
      postavshikNaqd,
      postavshikPlastic,
      Bank,
      Kredit,
      Logistika,
      dealerTransfer,
    ] = await Promise.all([
      storeExpensesQuery.getMany(),
      bosRasxodQuery.getMany(),
      bosPrixodQuery.getMany(),
      navarRasxodiQuery.getMany(),
      tamojnyaQuery.getMany(),
      qolganPulQuery.getMany(),
      dolgQuery.getMany(),
      postavshikNaqdQuery.getMany(),
      postavshikPlasticQuery.getMany(),
      bankQuery.getMany(),
      kreditQuery.getMany(),
      logistikaQuery.getMany(),
      this.transferService.totalsByDealer(filialId, month, year),
    ]);

    // Hisoblar
    const magazinRasxod = storeExpenses.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const bossRasxodSum = bossRasxod.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const bossPrixodSum = bossPrixod.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const navarRasxod = navarRasxodlar.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const tamojnyaSum = tamojnya.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const postavshikSum = postavshikNaqd.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const postavshikTerminalSum = postavshikPlastic.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const qolganPulSum = qolganPul.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const dolgSum = dolg.reduce((acc, expense) => acc + Number(expense.price || 0), 0); // Avval e'lon qilinadi
    const bank = Bank.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const kredit = Kredit.reduce((acc, expense) => acc + Number(expense.price || 0), 0);
    const logistika = Logistika.reduce((acc, expense) => acc + Number(expense.price || 0), 0);

    // Qaytarilgan mahsulotlar
    const canceledOrdersQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.kassa', 'kassa')
      .where('order.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('order.status = :status', { status: OrderEnum.Cancel });

    if (filialId) {
      canceledOrdersQuery.andWhere('kassa.filialId = :filialId', { filialId });
    }

    // Qabul qilingan orderlar
    const acceptedOrdersQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.kassa', 'kassa')
      .where('order.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('order.status = :status', { status: OrderEnum.Accept });

    if (filialId) {
      acceptedOrdersQuery.andWhere('kassa.filialId = :filialId', { filialId });
    }

    // Davlatlar bo'yicha sotuvlar
    const countrySalesQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.kassa', 'kassa')
      .leftJoin('order.bar_code', 'bar_code')
      .leftJoin('bar_code.country', 'country')
      .select([
        'country.id as countryId',
        'country.title as countryName',
        'SUM(order.kv) as totalKv',
        'SUM(order.price) as totalPrice',
      ])
      .where('order.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('order.status = :status', { status: OrderEnum.Accept })
      .andWhere('country.id IS NOT NULL')
      .groupBy('country.id, country.title');

    if (filialId) {
      countrySalesQuery.andWhere('kassa.filialId = :filialId', { filialId });
    }

    // Qarzga sotilgan mahsulotlar
    const debtOrdersQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.kassa', 'kassa')
      .where('order.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('order.isDebt = :isDebt', { isDebt: true });

    if (filialId) {
      debtOrdersQuery.andWhere('kassa.filialId = :filialId', { filialId });
    }

    const qarzdanKelganQuery = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoin('cashflow.cashflow_type', 'cashflow_type')
      .leftJoin('cashflow.createdBy', 'createdBy')
      .leftJoin('cashflow.kassa', 'kassa')
      .where('cashflow.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.InCome })
      .andWhere('cashflow_type.title IN (:...titles)', {
        titles: ['ПогашениеДолг', 'Долг'],
      });

    if (filialId) {
      qarzdanKelganQuery.andWhere('kassa.filialId = :filialId', { filialId });
    }

    // Order querylarni parallel bajarish
    const [canceledOrders, acceptedOrders, countrySales, debtOrders, kelganqarzlar] = await Promise.all([
      canceledOrdersQuery.getMany(),
      acceptedOrdersQuery.getMany(),
      countrySalesQuery.getRawMany(),
      debtOrdersQuery.getMany(),
      qarzdanKelganQuery.getMany(),
    ]);

    // Order hisoblar
    const qaytganNarx = canceledOrders.reduce((acc, order) => acc + Number(order.price || 0), 0);
    const qaytganKv = canceledOrders.reduce((acc, order) => acc + Number(order.kv || 0), 0);

    const savdoNarxi = acceptedOrders.reduce((acc, order) => acc + Number(order.price || 0), 0);
    const savdoKv = acceptedOrders.reduce((acc, order) => acc + Number(order.kv || 0), 0);
    const navar = acceptedOrders.reduce((acc, order) => acc + Number(order.additionalProfitSum || 0), 0);

    const qarzgaSotilganKv = debtOrders.reduce((acc, order) => acc + Number(order.kv || 0), 0);
    const qarzgaSotilganNarx = debtOrders.reduce((acc, order) => acc + Number(order.price || 0), 0);
    const kelganQarzlar = kelganqarzlar.reduce((acc, order) => acc + Number(order.price || 0), 0);

    // Davlatlar ma'lumotlari
    const davlatlar = countrySales.map((item) => ({
      countryId: item.countryid,
      countryName: item.countryname,
      totalKv: Number(Number(item.totalkv ?? 0).toFixed(2)),
      totalPrice: Number(Number(item.totalprice ?? 0).toFixed(2)),
    }));

    // Qarzlar ma'lumotlari
    const debtsRaw = await this.debtRepository.query(
      `
    SELECT 
      d.id,
      d."fullName",
      COALESCE(SUM(CASE WHEN c.type = $1 
                   AND c.date BETWEEN $3 AND $4 
                   THEN c.price ELSE 0 END), 0) as "monthlyOwed",
      COALESCE(SUM(CASE WHEN c.type = $2 
                   AND c.date BETWEEN $3 AND $4 
                   THEN c.price ELSE 0 END), 0) as "monthlyGiven",
      ( 
       COALESCE(SUM(CASE WHEN c.type = $1 
                    AND c.date BETWEEN $3 AND $4 
                    THEN c.price ELSE 0 END), 0) - 
       COALESCE(SUM(CASE WHEN c.type = $2 
                    AND c.date BETWEEN $3 AND $4 
                    THEN c.price ELSE 0 END), 0)
      ) as "totalDebt"
    FROM debts d
    LEFT JOIN cashflow c ON d.id = c."debtId"
    GROUP BY d.id, d."fullName", d."totalDebt"
  `,
      [CashFlowEnum.InCome, CashFlowEnum.Consumption, startDate, endDate],
    );

    const debts = debtsRaw.map((d) => ({
      fullName: d.fullName,
      totalDebt: Number(d.totalDebt ?? 0),
      monthlyOwed: Number(d.monthlyOwed ?? 0),
      monthlyGiven: Number(d.monthlyGiven ?? 0),
    }));

    const dealerSums = {
      totalKv: Number(dealerTransfer?.totalKv ?? 0),
      total_sum: Number(dealerTransfer?.total_sum ?? 0),
      total_profit_sum: Number(dealerTransfer?.total_profit_sum ?? 0),
      total_count: Number(dealerTransfer?.total_count ?? 0),
    };

    return {
      savdoNarxi: Number(savdoNarxi.toFixed(2)),
      savdoKv: Number(savdoKv.toFixed(2)),
      terminal: Number(terminal.toFixed(2)),
      terminalDealer: Number(terminalDealer.toFixed(2)),
      naqdFilial: Number(naqdFilial.toFixed(2)),
      naqdDealer: Number(naqdDealer.toFixed(2)),
      inkasatsiya: Number(inkasatsiya.toFixed(2)),
      qaytganKv: Number(qaytganKv.toFixed(2)),
      qaytganNarx: Number(qaytganNarx.toFixed(2)),
      davlatlar,
      skidka: Number(skidka.toFixed(2)),
      qarzgaSotilganKv: Number(Number(+qarzgaSotilganKv.toFixed(2) + dealerSums.totalKv).toFixed(2)),
      qarzgaSotilganNarx: Number(Number(+qarzgaSotilganNarx.toFixed(2) + dealerSums.total_sum).toFixed(2)),
      magazinRasxod: Number(magazinRasxod.toFixed(2)),
      navar: Number(navar.toFixed(2)),
      kelganQarzlar: Number(kelganQarzlar.toFixed(2)),
      foyda1: Number(foyda1.toFixed(2)),
      bossRasxod: Number(bossRasxodSum.toFixed(2)),
      bossPrixod: Number(bossPrixodSum.toFixed(2)),
      navarRasxod: Number(navarRasxod.toFixed(2)),
      tamojnya: Number(tamojnyaSum.toFixed(2)),
      postavshik: Number(postavshikSum.toFixed(2)),
      postavshikTerminal: Number(postavshikTerminalSum.toFixed(2)),
      qolganPul: Number(qolganPulSum.toFixed(2)),
      bank: Number(bank.toFixed(2)),
      kredit: Number(kredit.toFixed(2)),
      logistika: Number(logistika.toFixed(2)),
      debts,
    };
  }

  // Birlashtirilgan Excel export metodi
  async exportCombinedToExcel(filialId: string | undefined, year: number, month: number): Promise<Buffer> {
    // Monthly stats har doim olish
    const stats = await this.getMonthlyStatsByFilial(filialId, year, month);

    // Paper reports faqat filialId berilganda olish
    let paperReports = [];
    if (filialId) {
      const filters = { filialId, year, month };
      const paginatedResult = await this.findAll(filters, { page: 1, limit: 1000 }); // Barcha ma'lumotlarni olish uchun
      paperReports = paginatedResult.items;
    }

    const workbook = new ExcelJS.Workbook();

    // Common styling
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFE0E0E0' },
      },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    };

    // 1. OYLIK HISOBOT worksheet
    const monthlySheet = workbook.addWorksheet('Oylik Hisobot');

    // Title row
    monthlySheet.mergeCells('A1:C1');
    const titleCell = monthlySheet.getCell('A1');
    titleCell.value = `Oylik Hisobot - ${year} yil ${month} oy`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' as const };

    // Headers
    monthlySheet.getCell('A3').value = 'Ko\'rsatkich';
    monthlySheet.getCell('B3').value = 'Kv (m²)';
    monthlySheet.getCell('C3').value = 'Summa ($)';

    // Apply header styling
    ['A3', 'B3', 'C3'].forEach((cell) => {
      monthlySheet.getCell(cell).style = headerStyle;
    });

    // Monthly data
    const monthlyData = [
      ['Savdo naqd', stats.savdoKv, stats.savdoNarxi],
      ['Kelgan qarzlar', '-', stats.kelganQarzlar],
      ['Oldingi oydan o\'tgan pul', '-', stats.qolganPul],
      ['Terminal va perechisleniya savdosi', '-', stats.terminal],
      ['Inskassatsiya', '-', Math.abs(stats.inkasatsiya)],
      ['Naqd kassa', '-', stats.naqdFilial],
    ];

    // Add country data
    stats.davlatlar.forEach((country) => {
      monthlyData.push([country.countryName, country.totalKv, country.totalPrice]);
    });

    monthlyData.push(
      ['Dealer naqd', '-', stats.naqdDealer],
      ['Dealer perechisleniya', '-', stats.terminalDealer],
      ['Foyda 1', '-', stats.foyda1],
      ['Boss prixod', '-', stats.bossPrixod],
      ['Boss rasxod', '-', stats.bossRasxod],
      ['Qarzga sotilgan', stats.qarzgaSotilganKv, stats.qarzgaSotilganNarx],
      ['Qaytgan tovarlar', stats.qaytganKv, stats.qaytganNarx],
      ['Skidka', '-', stats.skidka],
      ['Biznes rasxod', '-', stats.magazinRasxod],

      // ['Navar summa', '-', stats.navar],
    );

    // Manager va Bugalter uchun qo'shimcha ma'lumotlar (faqat filialId berilmagan bo'lsa)
    if (!filialId) {
      monthlyData.push(
        ['Postavshik', '-', stats.postavshik],
        ['PostavshikTerminal', '-', stats.postavshikTerminal],
        ['Tamojnya', '-', stats.tamojnya],
        ['Navar rasxod', '-', stats.navarRasxod],
      );
    }

    // Add monthly data to worksheet
    let rowIndex = 4;
    monthlyData.forEach((row) => {
      monthlySheet.getCell(`A${rowIndex}`).value = row[0];
      monthlySheet.getCell(`B${rowIndex}`).value = row[1];
      monthlySheet.getCell(`C${rowIndex}`).value = row[2];

      // Style data cells
      ['A', 'B', 'C'].forEach((col) => {
        const cell = monthlySheet.getCell(`${col}${rowIndex}`);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        if (col === 'B' || col === 'C') {
          cell.numFmt = col === 'B' ? '0.00' : '$0.00';
          cell.alignment = { horizontal: 'right' };
        }
      });

      rowIndex++;
    });

    // 2. PAPER REPORTS qismi (faqat filialId berilganda)
    if (filialId && paperReports.length > 0) {
      // Bo'sh qator qo'shish
      rowIndex += 2;

      // Paper Reports title
      monthlySheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
      const paperTitleCell = monthlySheet.getCell(`A${rowIndex}`);
      paperTitleCell.value = 'Qo\'shilgan qatorlar';
      paperTitleCell.font = { bold: true, size: 12 };
      paperTitleCell.alignment = { horizontal: 'center' as const };
      rowIndex += 2;

      // Paper reports headers
      monthlySheet.getCell(`A${rowIndex}`).value = 'Sarlavha';
      monthlySheet.getCell(`B${rowIndex}`).value = 'Kv (m²)';
      monthlySheet.getCell(`C${rowIndex}`).value = 'Summa ($)';

      ['A', 'B', 'C'].forEach((col) => {
        const cell = monthlySheet.getCell(`${col}${rowIndex}`);
        cell.style = headerStyle;
      });
      rowIndex++;

      // Paper reports data
      paperReports.forEach((report) => {
        monthlySheet.getCell(`A${rowIndex}`).value = `${report.title} (${new Date(report.date).toLocaleDateString()})`;
        monthlySheet.getCell(`B${rowIndex}`).value = report.kv;
        monthlySheet.getCell(`C${rowIndex}`).value = report.price;

        ['A', 'B', 'C'].forEach((col) => {
          const cell = monthlySheet.getCell(`${col}${rowIndex}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          if (col === 'B') {
            cell.numFmt = '0.00';
            cell.alignment = { horizontal: 'right' };
          } else if (col === 'C') {
            cell.numFmt = '$0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });

        rowIndex++;
      });
    }

    // 3. DEBTS qismi (faqat filialId berilmagan bo'lsa)
    if (!filialId && stats.debts && stats.debts.length > 0) {
      // Bo'sh qator qo'shish
      rowIndex += 2;

      // Debts title
      monthlySheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
      const debtsTitleCell = monthlySheet.getCell(`A${rowIndex}`);
      debtsTitleCell.value = 'Qarzdorliklar';
      debtsTitleCell.font = { bold: true, size: 12 };
      debtsTitleCell.alignment = { horizontal: 'center' as const };
      rowIndex += 2;

      // Debts headers
      monthlySheet.getCell(`A${rowIndex}`).value = 'Qarzdor';
      monthlySheet.getCell(`B${rowIndex}`).value = 'Oylik qarzdorlik ($)';
      monthlySheet.getCell(`C${rowIndex}`).value = 'Bu oy olingan ($)';
      monthlySheet.getCell(`D${rowIndex}`).value = 'Bu oy berilgan ($)';

      ['A', 'B', 'C', 'D'].forEach((col) => {
        const cell = monthlySheet.getCell(`${col}${rowIndex}`);
        cell.style = headerStyle;
      });
      rowIndex++;

      // Debts data
      stats.debts.forEach((debt) => {
        monthlySheet.getCell(`A${rowIndex}`).value = debt.fullName;
        monthlySheet.getCell(`B${rowIndex}`).value = debt.totalDebt;
        monthlySheet.getCell(`C${rowIndex}`).value = debt.monthlyOwed;
        monthlySheet.getCell(`D${rowIndex}`).value = debt.monthlyGiven;

        ['A', 'B', 'C', 'D'].forEach((col) => {
          const cell = monthlySheet.getCell(`${col}${rowIndex}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          if (col === 'B' || col === 'C' || col === 'D') {
            cell.numFmt = '$0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });

        rowIndex++;
      });

      // Debts jami qator
      monthlySheet.getCell(`A${rowIndex}`).value = 'JAMI QARZLAR:';
      monthlySheet.getCell(`A${rowIndex}`).font = { bold: true };

      monthlySheet.getCell(`B${rowIndex}`).value = stats.debts.reduce((sum, d) => sum + d.totalDebt, 0);
      monthlySheet.getCell(`C${rowIndex}`).value = stats.debts.reduce((sum, d) => sum + d.monthlyOwed, 0);
      monthlySheet.getCell(`D${rowIndex}`).value = stats.debts.reduce((sum, d) => sum + d.monthlyGiven, 0);

      ['A', 'B', 'C', 'D'].forEach((col) => {
        const cell = monthlySheet.getCell(`${col}${rowIndex}`);
        cell.font = { bold: true };
        if (col !== 'A') {
          cell.numFmt = '$0.00';
          cell.alignment = { horizontal: 'right' };
        }
        cell.border = {
          top: { style: 'thick' },
          left: { style: 'thin' },
          bottom: { style: 'thick' },
          right: { style: 'thin' },
        };
      });
    }

    // Column widths update for debts
    monthlySheet.getColumn('A').width = 35;
    monthlySheet.getColumn('B').width = 18;
    monthlySheet.getColumn('C').width = 18;
    monthlySheet.getColumn('D').width = 18;

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  //----------------------------------------------

  async exportUniversalExcel(
    tur:
      | 'savdoNarxi'
      | 'kelganQarzlar'
      | 'saldo'
      | 'terminal'
      | 'inkasatsiya'
      | 'naqdKassa'
      | 'countrySales'
      | 'dillerNaqd'
      | 'dillerTerminal'
      | 'zavodFoyda1'
      | 'kolleksiyaFoyda1'
      | 'boss'
      | 'qarzgaSotilgan'
      | 'qaytganTovarlar'
      | 'skidka'
      | 'biznesRasxod'
      | 'postavshik'
      | 'tamojnya'
      | 'qarzlar',
    filialId: string | undefined,
    year: number,
    month: number,
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    let rows: any[] = [];
    let sheetName = '';
    let columns: { header: string; key: string; width: number }[] = [];
    let totalsRow: any = {};

    //SAVDO NARXI
    if (tur === 'savdoNarxi') {
      sheetName = 'SavdoNarxi';
      columns = [
        { header: 'Naqd Pul', key: 'Naqd Pul', width: 12 },
        { header: 'Terminal Summasi', key: 'Terminal Summasi', width: 15 },
        { header: 'Turi', key: 'Turi', width: 8 },
        { header: 'Kolleksiya', key: 'Kolleksiya', width: 15 },
        { header: 'Model', key: 'Model', width: 15 },
        { header: 'O\'lchami', key: 'O\'lchami', width: 10 },
        { header: 'Rangi', key: 'Rangi', width: 12 },
        { header: 'Soni', key: 'Soni', width: 8 },
        { header: 'Chegirma', key: 'Chegirma', width: 10 },
        { header: 'Foyda', key: 'Foyda', width: 10 },
        { header: 'Davlat', key: 'Davlat', width: 12 },
        { header: 'Zavod', key: 'Zavod', width: 12 },
        { header: 'Filial', key: 'Filial', width: 15 },
        { header: 'Sotuvchi', key: 'Sotuvchi', width: 12 },
        { header: 'Kassir', key: 'Kassir', width: 12 },
        { header: 'Sana', key: 'Sana', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 20 },
      ];

      const query = `
    SELECT 
      o.id,
      o."sellerId",
      o."createdById",
      CASE 
        WHEN o."plasticSum" IS NOT NULL
        THEN GREATEST(o."price" - o."plasticSum", 0) 
        ELSE o."price" 
      END as naqd_pul,
      COALESCE(o."plasticSum", 0) as terminal_sum,
      COALESCE(o."price", 0) as total_sum,
      COALESCE(o.x, 0) as soni,
      COALESCE(o."discountSum", 0) as chegirma,
      COALESCE(o."additionalProfitSum", 0) as foyda,
      o.date,
      COALESCE(o.comment, '') as comment,
      COALESCE(c.title, '') as collection_title,
      COALESCE(m.title, '') as model_title,
      COALESCE(s.title, '') as size_title,
      COALESCE(col.title, '') as color_title,
      COALESCE(country.title, '') as country_title,
      COALESCE(factory.title, '') as factory_title,
      COALESCE(f.title, '') as filial_title
    FROM "order" o
    INNER JOIN kassa k ON o."kassaId" = k.id
    INNER JOIN filial f ON k."filialId" = f.id
    LEFT JOIN qrbase bc ON o."barCodeId" = bc.id
    LEFT JOIN collection c ON bc."collectionId" = c.id
    LEFT JOIN model m ON bc."modelId" = m.id
    LEFT JOIN size s ON bc."sizeId" = s.id
    LEFT JOIN color col ON bc."colorId" = col.id
    LEFT JOIN country country ON bc."countryId" = country.id
    LEFT JOIN factory factory ON bc."factoryId" = factory.id
    WHERE o.date BETWEEN $1 AND $2 
      AND o.status = $3
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY o.date DESC
  `;
      const params = filialId ? [startDate, endDate, OrderEnum.Accept, filialId] : [startDate, endDate, OrderEnum.Accept];
      const orders = await this.orderRepository.query(query, params);

      // User ma'lumotlarini olish
      const userIds = [
        ...new Set([...orders.map((o) => o.sellerId).filter(Boolean), ...orders.map((o) => o.createdById).filter(Boolean)]),
      ];
      let usersMap = new Map();
      if (userIds.length > 0) {
        const usersQuery = `
      SELECT id, "firstName", "lastName" 
      FROM "users" 
      WHERE id = ANY($1)
    `;
        try {
          const users = await this.orderRepository.query(usersQuery, [userIds]);
          usersMap = new Map(users.map((u) => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim()]));
        } catch (error) {
          // Agar user table bilan muammo bo'lsa, bo'sh qoldiradi
        }
      }

      rows = orders.map((order) => ({
        'Naqd Pul': parseFloat(order.naqd_pul) || 0,
        'Terminal Summasi': parseFloat(order.terminal_sum) || 0,
        Turi: 'Savdo',
        Kolleksiya: order.collection_title || '',
        Model: order.model_title || '',
        'O\'lchami': order.size_title || '',
        Rangi: order.color_title || '',
        Soni: parseFloat(order.soni) || 0,
        Chegirma: parseFloat(order.chegirma) || 0,
        Foyda: parseFloat(order.foyda) || 0,
        Davlat: order.country_title || '',
        Zavod: order.factory_title || '',
        Filial: order.filial_title || '',
        Sotuvchi: usersMap.get(order.sellerId) || '',
        Kassir: usersMap.get(order.createdById) || '',
        Sana: order.date ? new Date(order.date).toLocaleDateString('uz-UZ') : '',
        Izoh: order.comment || '',
      }));

      totalsRow = {
        'Naqd Pul': Number(orders.reduce((sum, o) => sum + (parseFloat(o.naqd_pul) || 0), 0).toFixed(2)),
        'Terminal Summasi': Number(orders.reduce((sum, o) => sum + (parseFloat(o.terminal_sum) || 0), 0).toFixed(2)),
        Soni: Number(orders.reduce((sum, o) => sum + (parseFloat(o.soni) || 0), 0).toFixed(2)),
        Chegirma: Number(orders.reduce((sum, o) => sum + (parseFloat(o.chegirma) || 0), 0).toFixed(2)),
        Foyda: Number(orders.reduce((sum, o) => sum + (parseFloat(o.foyda) || 0), 0).toFixed(2)),
        Turi: 'JAMI',
      };
    }

    // TERMINAL
    else if (tur === 'terminal') {
      sheetName = 'Terminal_Perechislenie';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Turi', key: 'Turi', width: 15 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // Terminal (order) - faqat filial type FILIAL bo'lganlar
      const orderQuery = `
    SELECT o."plasticSum" as summa, o.comment as izoh, f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, o.date
    FROM "order" o
    INNER JOIN kassa k ON o."kassaId" = k.id
    INNER JOIN filial f ON k."filialId" = f.id AND f.type = $3
    LEFT JOIN "users" u ON o."createdById" = u.id
    WHERE o.date BETWEEN $1 AND $2
      AND o.status = $4
      AND o."plasticSum" > 0
      ${filialId ? 'AND k."filialId" = $5' : ''}
    ORDER BY o.date DESC
  `;
      const orderParams = filialId
        ? [startDate, endDate, FilialTypeEnum.FILIAL, OrderEnum.Accept, filialId]
        : [startDate, endDate, FilialTypeEnum.FILIAL, OrderEnum.Accept];
      const terminalOrders = await this.orderRepository.query(orderQuery, orderParams);

      // Perechislenie (cashflow) - filial type tekshirish shart emas, chunki getMonthlyStatsByFilial da yo'q
      const perechislenieQuery = `
    SELECT c.price as summa, c.comment as izoh, f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, c.date
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    LEFT JOIN filial f ON k."filialId" = f.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    WHERE c.date BETWEEN $1 AND $2
      AND c.type = $3
      AND ct.title = 'Перечисление'
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const perechislenieParams = filialId
        ? [startDate, endDate, CashFlowEnum.InCome, filialId]
        : [startDate, endDate, CashFlowEnum.InCome];
      const perechisleniya = await this.cashflowRepository.query(perechislenieQuery, perechislenieParams);

      rows = [
        ...terminalOrders.map((row) => ({
          Summa: parseFloat(row.summa) || 0,
          Izoh: row.izoh || '',
          Filial: row.filial || '',
          Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
          Turi: 'Terminal',
          Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
        })),
        ...perechisleniya.map((row) => ({
          Summa: parseFloat(row.summa) || 0,
          Izoh: row.izoh || '',
          Filial: row.filial || '',
          Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
          Turi: 'Perechislenie',
          Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
        })),
      ];

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta terminal/perechislenie`,
        Filial: '',
        Kassir: '',
        Turi: 'JAMI',
        Sana: '',
      };
    }

    // INKASSATSIYA
    else if (tur === 'inkasatsiya') {
      sheetName = 'Inkassatsiya';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // Cashflow dan inkassatsiya ma'lumotlarini olish
      const inkassatsiyaQuery = `
    SELECT c.price as summa, c.comment as izoh, f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, c.date
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    LEFT JOIN filial f ON k."filialId" = f.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    WHERE c.date BETWEEN $1 AND $2
      AND ct.title = $3
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;

      const baseParams = [startDate, endDate, 'Перечисление'];
      const params = filialId ? [...baseParams, filialId] : baseParams;

      const data = await this.cashflowRepository.query(inkassatsiyaQuery, params);

      rows = data.map((row) => ({
        Summa: Math.abs(Number(row.summa) || 0), // Musbat qilib ko'rsatamiz
        Izoh: row.izoh || '',
        Filial: row.filial || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      // Totalsni xavfsiz hisoblash
      const totalSumma = rows.reduce((sum, r) => sum + (Number(r.Summa) || 0), 0);

      totalsRow = {
        Summa: Number(totalSumma.toFixed(2)),
        Izoh: `Jami ${rows.length} ta inkassatsiya`,
        Filial: '',
        Kassir: '',
        Sana: '',
      };
    }

    // NAQD KASSA
    else if (tur === 'naqdKassa') {
      sheetName = 'NaqdKassa';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      const kassaReportsQuery = `
    SELECT
      k."in_hand" as naqd_summa,
      k.comment as izoh,
      f.title as filial,
      u."firstName" as kassir_name,
      u."lastName" as kassir_lastname,
      k."createdAt" as date
    FROM kassa k
    INNER JOIN filial f ON k."filialId" = f.id AND f.type = $3
    LEFT JOIN "users" u ON k."createdById" = u.id
    WHERE k."createdAt" BETWEEN $1 AND $2
      AND k."in_hand" > 0
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY k."createdAt" DESC
  `;
      const params = filialId
        ? [startDate, endDate, FilialTypeEnum.FILIAL, filialId]
        : [startDate, endDate, FilialTypeEnum.FILIAL];
      const data = await this.kassaRepository.query(kassaReportsQuery, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.naqd_summa) || 0,
        Izoh: row.izoh || '',
        Filial: row.filial || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta naqd kassa`,
        Filial: '',
        Kassir: '',
        Sana: '',
      };
    }

    // KELGAN QARZLAR
    else if (tur === 'kelganQarzlar') {
      sheetName = 'KelganQarzlar';
      columns = [
        { header: 'Sana', key: 'Sana', width: 14 },
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
      ];

      // getMonthlyStatsByFilial da kassa orqali filialId tekshiriladi
      const query = `
    SELECT c.price, c.date, c.comment, u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    WHERE c.date BETWEEN $1 AND $2
      AND c.type = $3
      AND ct.title IN ('ПогашениеДолг', 'Долг')
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const params = filialId
        ? [startDate, endDate, CashFlowEnum.InCome, filialId]
        : [startDate, endDate, CashFlowEnum.InCome];
      const data = await this.cashflowRepository.query(query, params);

      rows = data.map((qarz) => ({
        Sana: qarz.date ? new Date(qarz.date).toLocaleDateString('uz-UZ') : '',
        Summa: parseFloat(qarz.price) || 0,
        Izoh: qarz.comment || '',
        Kassir: `${qarz.kassir_name || ''} ${qarz.kassir_lastname || ''}`.trim(),
      }));

      totalsRow = {
        Sana: '',
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta kelgan qarz`,
        Kassir: '',
      };
    }

    // DILLER NAQD
    else if (tur === 'dillerNaqd') {
      sheetName = 'Diller_Naqd';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      const kassaReportsQuery = `
    SELECT 
      (kr."totalIncome" - COALESCE(kr."totalPlasticSum", 0)) as naqd_summa,
      kr.comment as izoh, 
      u."firstName" as kassir_name, 
      u."lastName" as kassir_lastname, 
      kr."createdAt" as date
    FROM kassa_report kr
    INNER JOIN filial f ON kr."filialId" = f.id AND f.type = $3
    LEFT JOIN "users" u ON kr."createdById" = u.id
    WHERE kr."createdAt" BETWEEN $1 AND $2
      AND (kr."totalIncome" - COALESCE(kr."totalPlasticSum", 0)) > 0
      ${filialId ? 'AND kr."filialId" = $4' : ''}
    ORDER BY kr."createdAt" DESC
  `;
      const params = filialId
        ? [startDate, endDate, FilialTypeEnum.DEALER, filialId]
        : [startDate, endDate, FilialTypeEnum.DEALER];
      const data = await this.kassaRepository.query(kassaReportsQuery, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.naqd_summa) || 0,
        Izoh: row.izoh || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta diller naqd`,
        Kassir: '',
        Sana: '',
      };
    }

    // DILLER TERMINAL
    else if (tur === 'dillerTerminal') {
      sheetName = 'Diller_Terminal';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      const kassaReportsQuery = `
    SELECT 
      kr."totalPlasticSum" as terminal_summa,
      kr.comment as izoh, 
      u."firstName" as kassir_name, 
      u."lastName" as kassir_lastname, 
      kr."createdAt" as date
    FROM kassa_report kr
    INNER JOIN filial f ON kr."filialId" = f.id AND f.type = $3
    LEFT JOIN "users" u ON kr."createdById" = u.id
    WHERE kr."createdAt" BETWEEN $1 AND $2
      AND COALESCE(kr."totalPlasticSum", 0) > 0
      ${filialId ? 'AND kr."filialId" = $4' : ''}
    ORDER BY kr."createdAt" DESC
  `;
      const params = filialId
        ? [startDate, endDate, FilialTypeEnum.DEALER, filialId]
        : [startDate, endDate, FilialTypeEnum.DEALER];
      const data = await this.kassaRepository.query(kassaReportsQuery, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.terminal_summa) || 0,
        Izoh: row.izoh || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta diller terminal`,
        Kassir: '',
        Sana: '',
      };
    }

    // SALDO
    else if (tur === 'saldo') {
      sheetName = 'OydanOytganPul';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da "Сальдо" title bilan InCome type cashflow olinadi
      const query = `
    SELECT c.price, c.comment, f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, c.date
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    LEFT JOIN filial f ON k."filialId" = f.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    WHERE c.date BETWEEN $1 AND $2
      AND c.type = $3
      AND ct.title = 'Сальдо'
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const params = filialId
        ? [startDate, endDate, CashFlowEnum.InCome, filialId]
        : [startDate, endDate, CashFlowEnum.InCome];
      const data = await this.cashflowRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Izoh: row.comment || '',
        Filial: row.filial || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: `Jami ${rows.length} ta o'tgan pul`,
        Filial: '',
        Kassir: '',
        Sana: '',
      };
    }

    // COUNTRY SALES
    else if (tur === 'countrySales') {
      sheetName = 'Davlatlar';
      columns = [
        { header: 'Davlat', key: 'Davlat', width: 20 },
        { header: 'Sotilgan dona', key: 'Sotilgan dona', width: 15 },
        { header: 'Kv (m²)', key: 'Kv', width: 12 },
        { header: 'Summa ($)', key: 'Summa', width: 15 },
      ];

      // getMonthlyStatsByFilial bilan bir xil query
      const query = `
    SELECT country.title as country_name, 
           SUM(o.x) as total_dona, 
           SUM(o.kv) as total_kv, 
           SUM(o.price) as total_sum
    FROM "order" o
    INNER JOIN kassa k ON o."kassaId" = k.id
    LEFT JOIN qrbase bc ON o."barCodeId" = bc.id
    LEFT JOIN country country ON bc."countryId" = country.id
    WHERE o.date BETWEEN $1 AND $2
      AND o.status = $3
      AND country.id IS NOT NULL
      ${filialId ? 'AND k."filialId" = $4' : ''}
    GROUP BY country.id, country.title
    ORDER BY SUM(o.price) DESC
  `;
      const params = filialId ? [startDate, endDate, OrderEnum.Accept, filialId] : [startDate, endDate, OrderEnum.Accept];
      const data = await this.orderRepository.query(query, params);

      rows = data.map((row) => ({
        Davlat: row.country_name || '',
        'Sotilgan dona': Number((parseFloat(row.total_dona) || 0).toFixed(2)),
        Kv: Number((parseFloat(row.total_kv) || 0).toFixed(2)),
        Summa: Number((parseFloat(row.total_sum) || 0).toFixed(2)),
      }));

      totalsRow = {
        Davlat: 'JAMI',
        'Sotilgan dona': Number(rows.reduce((sum, r) => sum + (parseFloat(r['Sotilgan dona']) || 0), 0).toFixed(2)),
        Kv: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Kv) || 0), 0).toFixed(2)),
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
      };
    }

    // QARZGA SOTILGAN
    else if (tur === 'qarzgaSotilgan') {
      sheetName = 'QarzgaSotilgan';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Kv (m²)', key: 'Kv', width: 12 },
        { header: 'Seller', key: 'Seller', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Status', key: 'Status', width: 18 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da faqat isDebt = true bo'lganlar olinadi
      const query = `
    SELECT o.price, o.kv, o.date, o.status,
           s."firstName" as seller_name, s."lastName" as seller_lastname,
           u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM "order" o
    LEFT JOIN "users" s ON o."sellerId" = s.id
    LEFT JOIN "users" u ON o."createdById" = u.id
    INNER JOIN kassa k ON o."kassaId" = k.id
    WHERE o.date BETWEEN $1 AND $2
      AND o."isDebt" = true
      ${filialId ? 'AND k."filialId" = $3' : ''}
    ORDER BY o.date DESC
  `;
      const params = filialId ? [startDate, endDate, filialId] : [startDate, endDate];
      const data = await this.orderRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Kv: parseFloat(row.kv) || 0,
        Seller: `${row.seller_name || ''} ${row.seller_lastname || ''}`.trim(),
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Status: row.status === 'accepted' ? 'Tasdiqlangan' : 'Tasdiqlanmagan',
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Kv: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Kv) || 0), 0).toFixed(2)),
        Seller: '',
        Kassir: '',
        Status: 'JAMI',
        Sana: '',
      };
    }

    // QAYTGAN TOVARLAR
    else if (tur === 'qaytganTovarlar') {
      sheetName = 'QaytganTovarlar';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Kv (m²)', key: 'Kv', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 25 },
        { header: 'Seller', key: 'Seller', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da status = Cancel bo'lganlar olinadi
      const query = `
    SELECT o.price, o.kv, o.comment, o.date,
           s."firstName" as seller_name, s."lastName" as seller_lastname,
           u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM "order" o
    LEFT JOIN "users" s ON o."sellerId" = s.id
    LEFT JOIN "users" u ON o."createdById" = u.id
    INNER JOIN kassa k ON o."kassaId" = k.id
    WHERE o.date BETWEEN $1 AND $2
      AND o.status = $3
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY o.date DESC
  `;
      const params = filialId ? [startDate, endDate, OrderEnum.Cancel, filialId] : [startDate, endDate, OrderEnum.Cancel];
      const data = await this.orderRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Kv: parseFloat(row.kv) || 0,
        Izoh: row.comment || '',
        Seller: `${row.seller_name || ''} ${row.seller_lastname || ''}`.trim(),
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Kv: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Kv) || 0), 0).toFixed(2)),
        Izoh: 'JAMI',
        Seller: '',
        Kassir: '',
        Sana: '',
      };
    }

    // SKIDKA
    else if (tur === 'skidka') {
      sheetName = 'Skidka';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Seller', key: 'Seller', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da barcha orderlardan totalDiscount olinadi
      const query = `
    SELECT kr."totalDiscount" as skidka, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, 
           f.title as filial, kr."createdAt" as date
    FROM kassa_report kr
    INNER JOIN filial f ON kr."filialId" = f.id
    LEFT JOIN "users" u ON kr."createdById" = u.id
    WHERE kr."createdAt" BETWEEN $1 AND $2
      AND COALESCE(kr."totalDiscount", 0) > 0
      ${filialId ? 'AND kr."filialId" = $3' : ''}
    ORDER BY kr."createdAt" DESC
  `;
      const params = filialId ? [startDate, endDate, filialId] : [startDate, endDate];
      const data = await this.kassaRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.skidka) || 0,
        Seller: '', // Kassa report da seller yo'q
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Filial: row.filial || '',
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Seller: '',
        Kassir: '',
        Filial: 'JAMI',
        Sana: '',
      };
    }

    // BIZNES RASXOD
    else if (tur === 'biznesRasxod') {
      sheetName = 'BiznesRasxod';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Turi', key: 'Turi', width: 15 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da aniq shu titlelar ishlatiladi
      const query = `
    SELECT c.price, c.comment, c.date,
           f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname, 
           ct.title as turi
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    LEFT JOIN filial f ON k."filialId" = f.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    WHERE c.date BETWEEN $1 AND $2
      AND c.type = $3
      AND ct.title IN ('Магазин', 'Аренда', 'Корпоротив', 'Логистика', 'Банк%')
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const params = filialId
        ? [startDate, endDate, CashFlowEnum.Consumption, filialId]
        : [startDate, endDate, CashFlowEnum.Consumption];
      const data = await this.cashflowRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Izoh: row.comment || '',
        Filial: row.filial || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Turi: row.turi || '',
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: '',
        Filial: '',
        Kassir: '',
        Turi: 'JAMI',
        Sana: '',
      };
    }

    // BOSS PRIXOD RASXOD
    else if (tur === 'boss') {
      sheetName = 'Boss_Prixod_Rasxod';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Turi', key: 'Turi', width: 12 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // Boss prixod (kirim)
      const prixodQuery = `
    SELECT c.price, c.comment, c.date,
           u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    WHERE c.date BETWEEN $1 AND $2
      AND ct.title = 'Босс'
      AND c.type = $3
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const prixodParams = filialId
        ? [startDate, endDate, CashFlowEnum.InCome, filialId]
        : [startDate, endDate, CashFlowEnum.InCome];
      const prixod = await this.cashflowRepository.query(prixodQuery, prixodParams);

      // Boss rasxod (chiqim)
      const rasxodQuery = `
    SELECT c.price, c.comment, c.date,
           u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    WHERE c.date BETWEEN $1 AND $2
      AND ct.title = 'Босс'
      AND c.type = $3
      ${filialId ? 'AND k."filialId" = $4' : ''}
    ORDER BY c.date DESC
  `;
      const rasxodParams = filialId
        ? [startDate, endDate, CashFlowEnum.Consumption, filialId]
        : [startDate, endDate, CashFlowEnum.Consumption];
      const rasxod = await this.cashflowRepository.query(rasxodQuery, rasxodParams);

      rows = [
        ...prixod.map((row) => ({
          Summa: parseFloat(row.price) || 0,
          Izoh: row.comment || '',
          Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
          Turi: 'Prixod',
          Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
        })),
        ...rasxod.map((row) => ({
          Summa: parseFloat(row.price) || 0,
          Izoh: row.comment || '',
          Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
          Turi: 'Rasxod',
          Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
        })),
      ];

      const prixodSum = prixod.reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0);
      const rasxodSum = rasxod.reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0);

      totalsRow = {
        Summa: `Prixod: ${Number(prixodSum.toFixed(2))}, Rasxod: ${Number(rasxodSum.toFixed(2))}`,
        Izoh: 'JAMI BOSS',
        Kassir: '',
        Turi: '',
        Sana: '',
      };
    }

    // POSTAVSHIK
    else if (tur === 'postavshik') {
      sheetName = 'Postavshik';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Turi', key: 'Turi', width: 15 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      // getMonthlyStatsByFilial da role bo'yicha ajratiladi
      const query = `
    SELECT c.price, c.comment, c.date,
           u."firstName" as kassir_name, u."lastName" as kassir_lastname,
           pos.role as user_role
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    LEFT JOIN position pos ON u."positionId" = pos.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    WHERE c.date BETWEEN $1 AND $2
      AND ct.title = 'Поставщики'
      ${filialId ? 'AND k."filialId" = $3' : ''}
    ORDER BY c.date DESC
  `;
      const params = filialId ? [startDate, endDate, filialId] : [startDate, endDate];
      const data = await this.cashflowRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Izoh: row.comment || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Turi: row.user_role === UserRoleEnum.ACCOUNTANT ? 'Plastic' : 'Naqd',
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: '',
        Kassir: '',
        Turi: 'JAMI',
        Sana: '',
      };
    }

    // TAMOJNYA
    else if (tur === 'tamojnya') {
      sheetName = 'Tamojnya';
      columns = [
        { header: 'Summa', key: 'Summa', width: 12 },
        { header: 'Izoh', key: 'Izoh', width: 30 },
        { header: 'Filial', key: 'Filial', width: 20 },
        { header: 'Kassir', key: 'Kassir', width: 20 },
        { header: 'Sana', key: 'Sana', width: 14 },
      ];

      const query = `
    SELECT c.price, c.comment, c.date,
           f.title as filial, 
           u."firstName" as kassir_name, u."lastName" as kassir_lastname
    FROM cashflow c
    LEFT JOIN cashflow_type ct ON c."cashflowTypeId" = ct.id
    LEFT JOIN kassa k ON c."kassaId" = k.id
    LEFT JOIN filial f ON k."filialId" = f.id
    LEFT JOIN "users" u ON c."createdById" = u.id
    WHERE c.date BETWEEN $1 AND $2
      AND ct.title = 'Таможня'
      ${filialId ? 'AND k."filialId" = $3' : ''}
    ORDER BY c.date DESC
  `;
      const params = filialId ? [startDate, endDate, filialId] : [startDate, endDate];
      const data = await this.cashflowRepository.query(query, params);

      rows = data.map((row) => ({
        Summa: parseFloat(row.price) || 0,
        Izoh: row.comment || '',
        Filial: row.filial || '',
        Kassir: `${row.kassir_name || ''} ${row.kassir_lastname || ''}`.trim(),
        Sana: row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '',
      }));

      totalsRow = {
        Summa: Number(rows.reduce((sum, r) => sum + (parseFloat(r.Summa) || 0), 0).toFixed(2)),
        Izoh: '',
        Filial: '',
        Kassir: 'JAMI',
        Sana: '',
      };
    }

    // QARZLAR
    else if (tur === 'qarzlar') {
      sheetName = 'Qarzdorliklar';
      columns = [
        { header: 'Qarzdor', key: 'Qarzdor', width: 30 },
        { header: 'Oylik qarzdorlik ($)', key: 'OylikQarz', width: 18 },
        { header: 'Bu oy olingan ($)', key: 'Olingan', width: 18 },
        { header: 'Bu oy berilgan ($)', key: 'Berilgan', width: 18 },
      ];

      // getMonthlyStatsByFilial bilan bir xil query
      const debtsRaw = await this.debtRepository.query(
        `
    SELECT 
      d.id,
      d."fullName",
      COALESCE(SUM(CASE WHEN c.type = $1 
                   AND c.date BETWEEN $3 AND $4 
                   THEN c.price ELSE 0 END), 0) as "monthlyOwed",
      COALESCE(SUM(CASE WHEN c.type = $2 
                   AND c.date BETWEEN $3 AND $4 
                   THEN c.price ELSE 0 END), 0) as "monthlyGiven",
      ( 
       COALESCE(SUM(CASE WHEN c.type = $1 
                    AND c.date BETWEEN $3 AND $4 
                    THEN c.price ELSE 0 END), 0) - 
       COALESCE(SUM(CASE WHEN c.type = $2 
                    AND c.date BETWEEN $3 AND $4 
                    THEN c.price ELSE 0 END), 0)
      ) as "totalDebt"
    FROM debts d
    LEFT JOIN cashflow c ON d.id = c."debtId"
    GROUP BY d.id, d."fullName", d."totalDebt"
  `,
        [CashFlowEnum.InCome, CashFlowEnum.Consumption, startDate, endDate],
      );

      rows = debtsRaw.map((d) => ({
        Qarzdor: d.fullName || '',
        OylikQarz: Number((Number(d.totalDebt) || 0).toFixed(2)),
        Olingan: Number((Number(d.monthlyOwed) || 0).toFixed(2)),
        Berilgan: Number((Number(d.monthlyGiven) || 0).toFixed(2)),
      }));

      // Totalsni hisoblashda ham xatolikni oldini olish
      const totalOylikQarz = rows.reduce((sum, d) => sum + (Number(d.OylikQarz) || 0), 0);
      const totalOlingan = rows.reduce((sum, d) => sum + (Number(d.Olingan) || 0), 0);
      const totalBerilgan = rows.reduce((sum, d) => sum + (Number(d.Berilgan) || 0), 0);

      totalsRow = {
        Qarzdor: 'JAMI QARZLAR',
        OylikQarz: Number(totalOylikQarz.toFixed(2)),
        Olingan: Number(totalOlingan.toFixed(2)),
        Berilgan: Number(totalBerilgan.toFixed(2)),
      };
    }

    // FACTORY FOYDA1 (factory bo'yicha)
    else if (tur === 'zavodFoyda1') {
      sheetName = 'FactoryFoyda1';

      // MUHIM: Faqat type = 'filial' bo'lgan filiallarni olish
      const filiallar = await this.entityManager.query(`
    SELECT id, title 
    FROM filial 
    WHERE type = 'filial' 
    ORDER BY title
  `);

      // Factory bo'yicha foyda1
      const factoryRows = await this.entityManager.query(
        `
    SELECT
      fct.title as factory,
      fil.id as filial_id,
      fil.title as filial,
      SUM(o."netProfitSum") as foyda
    FROM "order" o
    INNER JOIN kassa k ON o."kassaId" = k.id
    INNER JOIN filial fil ON k."filialId" = fil.id
    INNER JOIN qrbase qb ON o."barCodeId" = qb.id
    INNER JOIN factory fct ON qb."factoryId" = fct.id
    WHERE o.date BETWEEN $1 AND $2
      AND o.status = 'accepted'
      AND fil.type = 'filial'
    GROUP BY fct.title, fil.id, fil.title
    ORDER BY fct.title, fil.title
  `,
        [startDate, endDate],
      );

      const factoryNomi = [...new Set(factoryRows.map((r) => r.factory))];

      columns = [
        { header: 'Factory', key: 'Factory', width: 20 },
        ...filiallar.map((f) => ({ header: f.title, key: f.title, width: 15 })),
      ];

      rows = factoryNomi.map((factory) => {
        const row: any = { Factory: factory };
        filiallar.forEach((f) => {
          const found = factoryRows.find((r) => r.factory === factory && r.filial_id === f.id);
          row[f.title] = found ? Number(Number(found.foyda).toFixed(2)) : 0;
        });
        return row;
      });

      totalsRow = { Factory: 'Total' };
      filiallar.forEach((f) => {
        const total = rows.reduce((s, r) => s + (Number(r[f.title]) || 0), 0);
        totalsRow[f.title] = Number(total.toFixed(2));
      });
    }

    // KOLLEKSIYA FOYDA1 (collection bo'yicha)
    else if (tur === 'kolleksiyaFoyda1') {
      sheetName = 'CollectionFoyda1';

      const filiallar = await this.entityManager.query(`
    SELECT id, title 
    FROM filial 
    WHERE type = 'filial' 
    ORDER BY title
  `);

      const collecRows = await this.entityManager.query(
        `
    SELECT
      c.title as collection,
      fil.id as filial_id,
      fil.title as filial,
      SUM(o."netProfitSum") as foyda
    FROM "order" o
    INNER JOIN kassa k ON o."kassaId" = k.id
    INNER JOIN filial fil ON k."filialId" = fil.id
    INNER JOIN qrbase qb ON o."barCodeId" = qb.id
    INNER JOIN collection c ON qb."collectionId" = c.id
    WHERE o.date BETWEEN $1 AND $2
      AND o.status = 'accepted'
      AND fil.type = 'filial'
    GROUP BY c.title, fil.id, fil.title
    ORDER BY c.title, fil.title
  `,
        [startDate, endDate],
      );

      const collecNomi = [...new Set(collecRows.map((r) => r.collection))];

      columns = [
        { header: 'Collection', key: 'Collection', width: 20 },
        ...filiallar.map((f) => ({ header: f.title, key: f.title, width: 15 })),
      ];

      rows = collecNomi.map((collec) => {
        const row: any = { Collection: collec };
        filiallar.forEach((f) => {
          const found = collecRows.find((r) => r.collection === collec && r.filial_id === f.id);
          row[f.title] = found ? Number(Number(found.foyda).toFixed(2)) : 0;
        });
        return row;
      });

      totalsRow = { Collection: 'Total' };
      filiallar.forEach((f) => {
        const total = rows.reduce((s, r) => s + (Number(r[f.title]) || 0), 0);
        totalsRow[f.title] = Number(total.toFixed(2));
      });
    }

    // Excel yaratish
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([...rows, totalsRow]);
    worksheet['!cols'] = columns.map((col) => ({ wch: col.width }));

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = `${sheetName.toLowerCase()}_${year}-${month.toString().padStart(2, '0')}${
      filialId ? `_filial_${filialId}` : ''
    }.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName,
      count: rows.length,
      period: `${year}-${month.toString().padStart(2, '0')}`,
    };
  }

  async getArray() {
    return [
      { label: 'Savdo narxi', value: 'savdoNarxi' },
      { label: 'Kelgan qarzlar', value: 'kelganQarzlar' },
      { label: 'Oldingi oydan o\'tgan pul (Saldo)', value: 'saldo' },
      { label: 'Terminal va perechislenie', value: 'terminal' },
      { label: 'Inkassatsiya', value: 'inkasatsiya' },
      { label: 'Naqd kassa', value: 'naqdKassa' },
      { label: 'Davlatlar bo‘yicha savdo', value: 'countrySales' },
      { label: 'Diller naqd', value: 'dillerNaqd' },
      { label: 'Diller terminal', value: 'dillerTerminal' },
      { label: 'Factory foyda 1', value: 'zavodFoyda1' },
      { label: 'Kolleksiya foyda 1', value: 'kolleksiyaFoyda1' },
      { label: 'Boss prixod/rasxod', value: 'boss' },
      { label: 'Qarzga sotilgan', value: 'qarzgaSotilgan' },
      { label: 'Qaytgan tovarlar', value: 'qaytganTovarlar' },
      { label: 'Skidka', value: 'skidka' },
      { label: 'Biznes rasxod', value: 'biznesRasxod' },
      { label: 'Postavshik', value: 'postavshik' },
      { label: 'Tamojnya', value: 'tamojnya' },
      { label: 'Qarzdorliklar', value: 'qarzlar' },
    ];
  }

  async generateCustomExcel({ year, month, filialId }) {
    const data = await this.reportService.bossMonthReport({ year, month, filialId });

    let fileHeadName = filialId === '#dealers' ? 'Dillerlar' : !filialId ? 'Umumiy' : null;

    if (!fileHeadName) {
      const filial = await this.filialRepository.findOne({ where: { id: filialId } });
      fileHeadName = filial.title;
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('Report');

    const monthsUz = {
      1: 'Yanvar',
      2: 'Fevral',
      3: 'Mart',
      4: 'Aprel',
      5: 'May',
      6: 'Iyun',
      7: 'Iyul',
      8: 'Avgust',
      9: 'Sentyabr',
      10: 'Oktyabr',
      11: 'Noyabr',
      12: 'Dekabr',
    };

    /* ================== BORDERLAR ================== */
    const BORDER_THIN_BLACK = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' },
    };

    const BORDER_BOTTOM_GREEN = {
      bottom: { style: 'medium', color: { argb: 'FF00AA00' } },
    };

    const BORDER_BOTTOM_RED = {
      bottom: { style: 'medium', color: { argb: 'FFCC0000' } },
    };

    /* ================== COLUMNLAR ================== */
    sh.columns = [
      { width: 3 },   // A — bo‘sh
      { width: 37 },  // B — Ko‘rsatkich
      { width: 16 },  // C — Kv
      { width: 21 },  // D — Summa
    ];

    /* ================== TITLE ================== */
    sh.mergeCells('B2:D3');
    const title = sh.getCell('B2');
    title.value = `${fileHeadName} hisobot - ${year} yil ${monthsUz[month]}`;
    title.font = { bold: true, size: 14 };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = BORDER_THIN_BLACK;

    /* ================== HEADER ================== */
    const header = sh.addRow(['', 'Ko‘rsatkich', 'Kv (m²)', 'Summa ($)']);
    header.height = 22.5;

    header.eachCell((cell, col) => {
      if (col > 1) {
        cell.font = { bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6E6E6' },
        };
        cell.border = BORDER_THIN_BLACK;
      }
    });

    /* ================== YORDAMCHI FUNKSIYA ================== */
    const addRow = (label: string, key: string) => {
      const item = data[key] ?? {};
      const kv = item.kv || '-';
      const price = item.price || '-';

      const r = sh.addRow(['', label, kv, price]);
      r.height = 22;

      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

      r.getCell(4).numFmt = '$#,##0.00';

      [2, 3, 4].forEach(i => {
        r.getCell(i).border = BORDER_THIN_BLACK;
      });

      return r;
    };

    /* ================== MA’LUMOTLAR ================== */
    addRow('Savdo aylanmasi', 'turnover');
    addRow('Qarz savdosi', 'debt_trading');
    addRow('Chegirma(Skidka)', 'discount');

    const profit = addRow('Foyda hisobi', 'profit');
    profit.eachCell((cell, col) => {
      if (col > 1) {
        cell.border = { ...BORDER_THIN_BLACK, ...BORDER_BOTTOM_GREEN };
      }
    });

    if (filialId === '#dealers') {
      addRow('Diller Naqd', 'dealer_cash');
      addRow('Diller perechesleniya', 'dealer_terminal');

      /* ================== RETURN ================== */
      return { arrayBuffer: await wb.xlsx.writeBuffer(), headName: fileHeadName, monthText: monthsUz[month] };
    }

    if (!filialId) {
      addRow('Naqd kassa', 'cash');
      addRow('Terminal va perechesleniya', 'terminal');
      addRow('Inkassatsiya', 'cash_collection');
      addRow('Diller Naqd', 'dealer_cash');
      addRow('Diller perechesleniya', 'dealer_terminal');
    }

    addRow('Kelgan qarzlar', 'owed_debt');
    addRow('Oldingi oydan o‘tgan pul', 'opening_balance');
    addRow('Filial balansi', 'filial_balance');
    addRow('Boss prixod', 'boss_income');
    if (!filialId) {
      const kent_income = addRow('Kent prixod', 'kent_income');
      kent_income.eachCell((cell, col) => {
        if (col > 1) {
          cell.border = { ...BORDER_THIN_BLACK, ...BORDER_BOTTOM_RED };
        }
      });
    }

    if (filialId) {
      const navar = addRow('Navar', 'navar_income');
      navar.eachCell((cell, col) => {
        if (col > 1) {
          cell.border = { ...BORDER_THIN_BLACK, ...BORDER_BOTTOM_RED };
        }
      });
    }

    filialId && addRow('Naqd kassa', 'cash');
    filialId && addRow('Terminal va perechisleniya', 'terminal');
    filialId && addRow('Inkassatsiya', 'cash_collection');
    if (!filialId) {
      addRow('Kent rasxod', 'kent_expense');
    }
    addRow('Boss rasxod', 'boss_expense');
    addRow('Biznes rasxod', 'business_expense');
    if (filialId) {
      addRow('Qaytgan Tavarlar(Vazvrad)', 'return_orders');
      addRow('Navar Rasxod', 'navar_expense');
    } else {
      addRow('Yetkazib beruvchi(Pastavshik)', 'factory');
      addRow('Bojxona(tamojniy)', 'tamojniy');
      addRow('Qaytgan Tavarlar(Vazvrad)', 'return_orders');
    }

    /* ================== RETURN ================== */
    return { arrayBuffer: await wb.xlsx.writeBuffer(), headName: fileHeadName, monthText: monthsUz[month] };
  }
}
