import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
import * as ExcelJS from 'exceljs';
import { Debt } from './debt.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CashflowService } from '../cashflow/cashflow.service';
import { CashFlowEnum } from 'src/infra/shared/enum';
import CashflowTipEnum from 'src/infra/shared/enum/cashflow/cashflow-tip.enum';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import DebtTransactionTypeEnum from 'src/infra/shared/enum/debt-type-enum';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { CashflowTypeService } from '../cashflow-type/cashflow-type.service';
import { DebtTransactionDto } from './dto/amount-debt-dto';
import { DebtReportQueryDto } from './dto/debt-report-query.dto';
import { DebtDetailQueryDto } from './dto/debt-detail-query.dto';
import { DebtExcelQueryDto } from './dto/debt-excel-query.dto';

@Injectable()
export class DebtService {
  private readonly logger = new Logger(DebtService.name);

  constructor(
    @InjectRepository(Debt)
    private readonly debtRepository: Repository<Debt>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    private readonly connection: DataSource,
    @Inject(forwardRef(() => CashflowService))
    private readonly cashflowService: CashflowService,
    @Inject(forwardRef(() => CashflowTypeService))
    private readonly cashflowTypeService: CashflowTypeService,
  ) {}

  async findAll(options: IPaginationOptions): Promise<Pagination<Debt>> {
    const queryBuilder = this.debtRepository.createQueryBuilder('debt');
    return paginate<Debt>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Debt> {
    const debt = await this.debtRepository.findOne({ where: { id } });
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }
    return debt;
  }

  async create(dto: CreateDebtDto): Promise<Debt> {
    const debt = this.debtRepository.create(dto);
    return this.debtRepository.save(debt);
  }

  async update(id: string, dto: UpdateDebtDto): Promise<Debt> {
    const debt = await this.findOne(id);
    Object.assign(debt, dto);
    return this.debtRepository.save(debt);
  }

  async remove(id: string): Promise<{ message: string }> {
    const debt = await this.findOne(id);
    await this.debtRepository.remove(debt);
    return { message: 'Debt successfully deleted' };
  }

  async getDebtBalance(id: string): Promise<{ balance: number }> {
    const debt = await this.findOne(id);
    const balance = debt.owed - debt.given;
    return { balance };
  }

  async handleTransaction(dto: DebtTransactionDto, userId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const debt = await this.findOne(dto.debtId);

      const cashflowTypeId = await this.cashflowTypeService.getDebtTypeId();

      // CashflowService orqali operatsiyani amalga oshirish
      await this.cashflowService.create(
        {
          type: dto.transactionType === DebtTransactionTypeEnum.TAKE ? CashFlowEnum.InCome : CashFlowEnum.Consumption,
          price: dto.amount,
          comment: dto.comment,
          kassa: dto.kassaId,
          cashflow_type: cashflowTypeId,
          debtId: debt.id,
          tip: CashflowTipEnum.DEBT,
          title: 'debt',
          createdBy: userId,
          order: null,
          report: null,
        },
        userId,
      );

      // Debt ma'lumotlarini yangilash (after given/owed are updated)
      const updatedDebt = await this.findOne(dto.debtId);
      updatedDebt.totalDebt = updatedDebt.owed - updatedDebt.given;
      if (updatedDebt.totalDebt < 0) updatedDebt.totalDebt = 0;

      await this.debtRepository.save(updatedDebt);

      await queryRunner.commitTransaction();
      return { message: 'Transaction completed', debt: updatedDebt };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getNextNumber(): Promise<number> {
    const last = await this.debtRepository.findOne({
      order: { number_debt: 'DESC' },
    });

    return (last?.number_debt ?? 0) + 1;
  }

  // ==================== REPORT METHODS ====================

  async getDebtReport(dto: DebtReportQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const qb = this.debtRepository
      .createQueryBuilder('d')
      .select([
        'd.id AS id',
        'd."fullName" AS "fullName"',
        'd.phone AS phone',
        'd.given AS given',
        'd.owed AS owed',
        'd."totalDebt" AS "totalDebt"',
        'd.number_debt AS number_debt',
        `COALESCE(SUM(CASE WHEN c.type = 'Приход' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_income`,
        `COALESCE(SUM(CASE WHEN c.type = 'Расход' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_expense`,
      ])
      .leftJoin(
        'cashflow',
        'c',
        `c."debtId" = d.id AND c.is_cancelled = false AND c.date BETWEEN :startDate AND :endDate`,
        { startDate, endDate },
      )
      .where('d."deletedDate" IS NULL')
      .groupBy('d.id')
      .orderBy('d."totalDebt"', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.search) {
      qb.andWhere('d."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }

    const items = await qb.getRawMany();

    // Count total
    const countQb = this.debtRepository
      .createQueryBuilder('d')
      .where('d."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('d."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    // Totals
    const totalsQb = this.debtRepository
      .createQueryBuilder('d')
      .select([
        `SUM(d.given)::NUMERIC(20,2) AS total_given`,
        `SUM(d.owed)::NUMERIC(20,2) AS total_owed`,
        `SUM(d."totalDebt")::NUMERIC(20,2) AS total_debt`,
        `COALESCE(SUM(pi.period_income), 0)::NUMERIC(20,2) AS total_period_income`,
        `COALESCE(SUM(pe.period_expense), 0)::NUMERIC(20,2) AS total_period_expense`,
      ])
      .leftJoin(
        (sub) =>
          sub
            .select('c."debtId"', 'debtId')
            .addSelect(`SUM(CASE WHEN c.type = 'Приход' THEN c.price ELSE 0 END)`, 'period_income')
            .from('cashflow', 'c')
            .where('c.is_cancelled = false AND c.date BETWEEN :s AND :e', { s: startDate, e: endDate })
            .groupBy('c."debtId"'),
        'pi',
        'pi."debtId" = d.id',
      )
      .leftJoin(
        (sub) =>
          sub
            .select('c2."debtId"', 'debtId')
            .addSelect(`SUM(CASE WHEN c2.type = 'Расход' THEN c2.price ELSE 0 END)`, 'period_expense')
            .from('cashflow', 'c2')
            .where('c2.is_cancelled = false AND c2.date BETWEEN :s2 AND :e2', { s2: startDate, e2: endDate })
            .groupBy('c2."debtId"'),
        'pe',
        'pe."debtId" = d.id',
      )
      .where('d."deletedDate" IS NULL');

    const totals = await totalsQb.getRawOne();

    return {
      items: items.map((i) => ({
        ...i,
        given: Number(i.given || 0),
        owed: Number(i.owed || 0),
        totalDebt: Number(i.totalDebt || 0),
        period_income: Number(i.period_income || 0),
        period_expense: Number(i.period_expense || 0),
      })),
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        itemCount: limit,
      },
      totals: {
        total_given: Number(totals?.total_given || 0),
        total_owed: Number(totals?.total_owed || 0),
        total_debt: Number(totals?.total_debt || 0),
        total_period_income: Number(totals?.total_period_income || 0),
        total_period_expense: Number(totals?.total_period_expense || 0),
      },
    };
  }

  async getDebtDetailReport(debtId: string, dto: DebtDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const debt = await this.findOne(debtId);

    const cashflow_qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect(['cashflow_type.id', 'cashflow_type.title', 'cashflow_type.slug'])
      .leftJoin('cash.debt', 'debt')
      .addSelect(['debt.id', 'debt.fullName'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .where('debt.id = :debtId', { debtId })
      .andWhere('cash.is_cancelled = false')
      .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .orderBy('cash.date', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.type) {
      cashflow_qb.andWhere('cash.type = :type', { type: dto.type });
    }

    const total_qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select(`
        SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_income,
        SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_expense
      `)
      .leftJoin('cash.debt', 'debt')
      .where('debt.id = :debtId', { debtId })
      .andWhere('cash.is_cancelled = false')
      .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (dto.type) {
      total_qb.andWhere('cash.type = :type', { type: dto.type });
    }

    const [[items, total], totals] = await Promise.all([
      cashflow_qb.getManyAndCount(),
      total_qb.getRawOne(),
    ]);

    return {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_income: Number(totals?.total_income || 0),
        total_expense: Number(totals?.total_expense || 0),
        balance: Number((Number(totals?.total_income || 0) - Number(totals?.total_expense || 0)).toFixed(2)),
      },
      debt: {
        id: debt.id,
        fullName: debt.fullName,
        phone: debt.phone,
        given: debt.given,
        owed: debt.owed,
        totalDebt: debt.totalDebt,
      },
    };
  }

  async generateDebtExcel(dto: DebtExcelQueryDto): Promise<Buffer> {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const workbook = new ExcelJS.Workbook();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    if (dto.debtId) {
      // Single kent cashflows export
      const debt = await this.findOne(dto.debtId);
      const sheet = workbook.addWorksheet(`${debt.fullName}`);

      sheet.mergeCells('A1:F1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `${debt.fullName} — ${year} yil ${month}-oy`;
      titleCell.font = { bold: true, size: 14 };

      const headers = ['№', 'Sana', 'Turi', 'Summa ($)', 'Izoh', 'Kim qo\'shgan'];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(3, i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      sheet.columns = [
        { width: 5 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 30 }, { width: 20 },
      ];

      const cashflows = await this.cashflowRepository
        .createQueryBuilder('cash')
        .leftJoin('cash.debt', 'debt')
        .leftJoin('cash.createdBy', 'createdBy')
        .select(['cash.id', 'cash.price', 'cash.type', 'cash.comment', 'cash.date', 'createdBy.firstName', 'createdBy.lastName'])
        .where('debt.id = :debtId', { debtId: dto.debtId })
        .andWhere('cash.is_cancelled = false')
        .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate })
        .orderBy('cash.date', 'DESC')
        .getMany();

      cashflows.forEach((cf, idx) => {
        const row = sheet.getRow(idx + 4);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = dayjs(cf.date).format('DD.MM.YYYY HH:mm');
        row.getCell(3).value = cf.type;
        row.getCell(4).value = Number(cf.price);
        row.getCell(5).value = cf.comment || '';
        row.getCell(6).value = cf.createdBy ? `${cf.createdBy.firstName} ${cf.createdBy.lastName}` : '';
      });
    } else {
      // All kents summary export
      const report = await this.getDebtReport({ year, month, page: 1, limit: 10000 });
      const sheet = workbook.addWorksheet('Kentlar');

      sheet.mergeCells('A1:H1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `Kentlar hisoboti — ${year} yil ${month}-oy`;
      titleCell.font = { bold: true, size: 14 };

      const headers = ['№', 'Ism', 'Telefon', 'Взято ($)', 'Дано ($)', 'Qoldiq ($)', 'Davriy kirim ($)', 'Davriy chiqim ($)'];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(3, i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      sheet.columns = [
        { width: 5 }, { width: 25 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
      ];

      report.items.forEach((item, idx) => {
        const row = sheet.getRow(idx + 4);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = item.fullName || '';
        row.getCell(3).value = item.phone || '';
        row.getCell(4).value = item.owed;
        row.getCell(5).value = item.given;
        row.getCell(6).value = item.totalDebt;
        row.getCell(7).value = item.period_income;
        row.getCell(8).value = item.period_expense;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  @Cron('1 0 1 1 *', { name: 'debt-year-end-reset' })
  async handleYearEndDebtReset() {
    this.logger.log('Starting year-end debt reset...');
    const debts = await this.debtRepository.find();
    for (const debt of debts) {
      debt.owed = debt.totalDebt;
      debt.given = 0;
      // totalDebt = owed - given = totalDebt (unchanged)
    }
    await this.debtRepository.save(debts);
    this.logger.log(`Year-end debt reset completed for ${debts.length} debts`);
  }
}
