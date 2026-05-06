import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
import * as ExcelJS from 'exceljs';
import { Street } from './street.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CashflowService } from '../cashflow/cashflow.service';
import { CashFlowEnum } from 'src/infra/shared/enum';
import CashflowTipEnum from 'src/infra/shared/enum/cashflow/cashflow-tip.enum';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import DebtTransactionTypeEnum from 'src/infra/shared/enum/debt-type-enum';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { CashflowTypeService } from '../cashflow-type/cashflow-type.service';
import { StreetTransactionDto } from './dto/amount-street-dto';
import { StreetReportQueryDto } from './dto/street-report-query.dto';
import { StreetDetailQueryDto } from './dto/street-detail-query.dto';
import { StreetExcelQueryDto } from './dto/street-excel-query.dto';

@Injectable()
export class StreetService {
  private readonly logger = new Logger(StreetService.name);

  constructor(
    @InjectRepository(Street)
    private readonly streetRepository: Repository<Street>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    private readonly connection: DataSource,
    @Inject(forwardRef(() => CashflowService))
    private readonly cashflowService: CashflowService,
    @Inject(forwardRef(() => CashflowTypeService))
    private readonly cashflowTypeService: CashflowTypeService,
  ) {}

  async findAll(options: IPaginationOptions): Promise<Pagination<Street>> {
    const queryBuilder = this.streetRepository.createQueryBuilder('street');
    return paginate<Street>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Street> {
    const street = await this.streetRepository.findOne({ where: { id } });
    if (!street) {
      throw new NotFoundException('Street not found');
    }
    return street;
  }

  async create(dto: CreateStreetDto): Promise<Street> {
    const street = this.streetRepository.create(dto);
    return this.streetRepository.save(street);
  }

  async update(id: string, dto: UpdateStreetDto): Promise<Street> {
    const street = await this.findOne(id);
    Object.assign(street, dto);
    return this.streetRepository.save(street);
  }

  async remove(id: string): Promise<{ message: string }> {
    const street = await this.findOne(id);
    await this.streetRepository.remove(street);
    return { message: 'Street successfully deleted' };
  }

  async getStreetBalance(id: string): Promise<{ balance: number }> {
    const street = await this.findOne(id);
    const balance = Number(street.owed) + Number(street.percent) - Number(street.given);
    return { balance };
  }

  async handleTransaction(dto: StreetTransactionDto, userId: string) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const street = await this.findOne(dto.streetId);

      const cashflowTypeId = await this.cashflowTypeService.getDebtTypeId();

      await this.cashflowService.create(
        {
          type: dto.transactionType === DebtTransactionTypeEnum.TAKE ? CashFlowEnum.InCome : CashFlowEnum.Consumption,
          price: dto.amount,
          comment: dto.comment,
          kassa: dto.kassaId,
          cashflow_type: cashflowTypeId,
          streetId: street.id,
          tip: CashflowTipEnum.DEBT,
          title: 'street',
          createdBy: userId,
          order: null,
          report: null,
        } as any,
        userId,
      );

      const updated = await this.findOne(dto.streetId);
      updated.totalDebt =
        Number(updated.owed) + Number(updated.percent) - Number(updated.given);
      if (updated.totalDebt < 0) updated.totalDebt = 0;

      await this.streetRepository.save(updated);

      await queryRunner.commitTransaction();
      return { message: 'Transaction completed', street: updated };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getNextNumber(): Promise<number> {
    const last = await this.streetRepository.findOne({
      order: { number_debt: 'DESC' },
    });

    return (last?.number_debt ?? 0) + 1;
  }

  // ==================== REPORT METHODS ====================

  async getStreetReport(dto: StreetReportQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const qb = this.streetRepository
      .createQueryBuilder('s')
      .select([
        's.id AS id',
        's."fullName" AS "fullName"',
        's.phone AS phone',
        's.given AS given',
        's.owed AS owed',
        's.percent AS percent',
        's."totalDebt" AS "totalDebt"',
        's.number_debt AS number_debt',
        `COALESCE(SUM(CASE WHEN c.type = 'income' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_income`,
        `COALESCE(SUM(CASE WHEN c.type = 'expense' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_expense`,
      ])
      .leftJoin(
        'cashflow',
        'c',
        `c."streetId" = s.id AND c.is_cancelled = false AND c.date BETWEEN :startDate AND :endDate`,
        { startDate, endDate },
      )
      .where('s."deletedDate" IS NULL')
      .groupBy('s.id')
      .orderBy('s."totalDebt"', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.search) {
      qb.andWhere('s."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }

    const items = await qb.getRawMany();

    const countQb = this.streetRepository
      .createQueryBuilder('s')
      .where('s."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('s."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    const totalsQb = this.streetRepository
      .createQueryBuilder('s')
      .select([
        `SUM(s.given)::NUMERIC(20,2) AS total_given`,
        `SUM(s.owed)::NUMERIC(20,2) AS total_owed`,
        `SUM(s.percent)::NUMERIC(20,2) AS total_percent`,
        `SUM(s."totalDebt")::NUMERIC(20,2) AS total_debt`,
        `COALESCE(SUM(pi.period_income), 0)::NUMERIC(20,2) AS total_period_income`,
        `COALESCE(SUM(pe.period_expense), 0)::NUMERIC(20,2) AS total_period_expense`,
      ])
      .leftJoin(
        (sub) =>
          sub
            .select('c."streetId"', 'streetId')
            .addSelect(`SUM(CASE WHEN c.type = 'income' THEN c.price ELSE 0 END)`, 'period_income')
            .from('cashflow', 'c')
            .where('c.is_cancelled = false AND c.date BETWEEN :s AND :e', { s: startDate, e: endDate })
            .groupBy('c."streetId"'),
        'pi',
        'pi."streetId" = s.id',
      )
      .leftJoin(
        (sub) =>
          sub
            .select('c2."streetId"', 'streetId')
            .addSelect(`SUM(CASE WHEN c2.type = 'expense' THEN c2.price ELSE 0 END)`, 'period_expense')
            .from('cashflow', 'c2')
            .where('c2.is_cancelled = false AND c2.date BETWEEN :s2 AND :e2', { s2: startDate, e2: endDate })
            .groupBy('c2."streetId"'),
        'pe',
        'pe."streetId" = s.id',
      )
      .where('s."deletedDate" IS NULL');

    const totals = await totalsQb.getRawOne();

    return {
      items: items.map((i) => ({
        ...i,
        given: Number(i.given || 0),
        owed: Number(i.owed || 0),
        percent: Number(i.percent || 0),
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
        total_percent: Number(totals?.total_percent || 0),
        total_debt: Number(totals?.total_debt || 0),
        total_period_income: Number(totals?.total_period_income || 0),
        total_period_expense: Number(totals?.total_period_expense || 0),
      },
    };
  }

  async getStreetDetailReport(streetId: string, dto: StreetDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || null;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    let startDate: Date;
    let endDate: Date;
    if (dto.fromDate || dto.toDate) {
      startDate = dto.fromDate
        ? dayjs(dto.fromDate).startOf('day').toDate()
        : dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dto.toDate
        ? dayjs(dto.toDate).endOf('day').toDate()
        : dayjs(`${year}-12-31`).endOf('year').toDate();
    } else if (month) {
      startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${year}-12-31`).endOf('year').toDate();
    }

    const street = await this.findOne(streetId);

    const cashflow_qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.streetPercent',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect(['cashflow_type.id', 'cashflow_type.title', 'cashflow_type.slug'])
      .leftJoin('cash.street', 'street')
      .addSelect(['street.id', 'street.fullName'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .where('street.id = :streetId', { streetId })
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
        SUM(CASE WHEN cash.type = 'income' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_income,
        SUM(CASE WHEN cash.type = 'income' THEN cash.street_percent ELSE 0 END)::NUMERIC(20,2) AS total_percent,
        SUM(CASE WHEN cash.type = 'expense' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_expense
      `)
      .leftJoin('cash.street', 'street')
      .where('street.id = :streetId', { streetId })
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
        total_percent: Number(totals?.total_percent || 0),
        total_expense: Number(totals?.total_expense || 0),
        balance: Number((Number(totals?.total_income || 0) + Number(totals?.total_percent || 0) - Number(totals?.total_expense || 0)).toFixed(2)),
      },
      street: {
        id: street.id,
        fullName: street.fullName,
        phone: street.phone,
        given: street.given,
        owed: street.owed,
        percent: street.percent,
        totalDebt: street.totalDebt,
      },
    };
  }

  async generateStreetExcel(dto: StreetExcelQueryDto): Promise<Buffer> {
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

    if (dto.streetId) {
      const street = await this.findOne(dto.streetId);
      const sheet = workbook.addWorksheet(`${street.fullName}`);

      sheet.mergeCells('A1:G1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `${street.fullName} — ${year} yil ${month}-oy`;
      titleCell.font = { bold: true, size: 14 };

      const headers = ['№', 'Sana', 'Turi', 'Summa ($)', 'Foiz ($)', 'Izoh', "Kim qo'shgan"];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(3, i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      sheet.columns = [
        { width: 5 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 30 }, { width: 20 },
      ];

      const cashflows = await this.cashflowRepository
        .createQueryBuilder('cash')
        .leftJoin('cash.street', 'street')
        .leftJoin('cash.createdBy', 'createdBy')
        .select(['cash.id', 'cash.price', 'cash.streetPercent', 'cash.type', 'cash.comment', 'cash.date', 'createdBy.firstName', 'createdBy.lastName'])
        .where('street.id = :streetId', { streetId: dto.streetId })
        .andWhere('cash.is_cancelled = false')
        .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate })
        .orderBy('cash.date', 'DESC')
        .getMany();

      cashflows.forEach((cf: any, idx) => {
        const row = sheet.getRow(idx + 4);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = dayjs(cf.date).format('DD.MM.YYYY HH:mm');
        row.getCell(3).value = cf.type;
        row.getCell(4).value = Number(cf.price);
        row.getCell(5).value = Number(cf.streetPercent || 0);
        row.getCell(6).value = cf.comment || '';
        row.getCell(7).value = cf.createdBy ? `${cf.createdBy.firstName} ${cf.createdBy.lastName}` : '';
      });
    } else {
      const report = await this.getStreetReport({ year, month, page: 1, limit: 10000 });
      const sheet = workbook.addWorksheet("Ko'cha");

      sheet.mergeCells('A1:I1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `Ko'cha hisoboti — ${year} yil ${month}-oy`;
      titleCell.font = { bold: true, size: 14 };

      const headers = ['№', 'Ism', 'Telefon', 'Olgan ($)', 'Foiz ($)', 'Qaytargan ($)', 'Qoldiq ($)', 'Davriy kirim ($)', 'Davriy chiqim ($)'];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(3, i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      sheet.columns = [
        { width: 5 }, { width: 25 }, { width: 18 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
      ];

      report.items.forEach((item: any, idx) => {
        const row = sheet.getRow(idx + 4);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = item.fullName || '';
        row.getCell(3).value = item.phone || '';
        row.getCell(4).value = item.owed;
        row.getCell(5).value = item.percent;
        row.getCell(6).value = item.given;
        row.getCell(7).value = item.totalDebt;
        row.getCell(8).value = item.period_income;
        row.getCell(9).value = item.period_expense;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  @Cron('1 0 1 1 *', { name: 'street-year-end-reset' })
  async handleYearEndStreetReset() {
    this.logger.log('Starting year-end street reset...');
    const streets = await this.streetRepository.find();
    for (const street of streets) {
      street.owed = street.totalDebt;
      street.given = 0;
      street.percent = 0;
    }
    await this.streetRepository.save(streets);
    this.logger.log(`Year-end street reset completed for ${streets.length} streets`);
  }
}
