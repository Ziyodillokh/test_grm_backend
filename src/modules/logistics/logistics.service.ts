import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
import * as ExcelJS from 'exceljs';
import { Logistics } from './logistics.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateLogisticsDto } from './dto/create-logistics.dto';
import { UpdateLogisticsDto } from './dto/update-logistics.dto';
import { LogisticsReportQueryDto } from './dto/logistics-report-query.dto';
import { LogisticsDetailQueryDto } from './dto/logistics-detail-query.dto';
import { LogisticsExcelQueryDto } from './dto/logistics-excel-query.dto';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    @InjectRepository(Logistics)
    private readonly logisticsRepository: Repository<Logistics>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
  ) {}

  async findAll(options: IPaginationOptions): Promise<Pagination<Logistics>> {
    const queryBuilder = this.logisticsRepository.createQueryBuilder('logistics');
    return paginate<Logistics>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Logistics> {
    const logistics = await this.logisticsRepository.findOne({ where: { id } });
    if (!logistics) {
      throw new NotFoundException('Logistics not found');
    }
    return logistics;
  }

  async create(dto: CreateLogisticsDto): Promise<Logistics> {
    const logistics = this.logisticsRepository.create(dto);
    return this.logisticsRepository.save(logistics);
  }

  async update(id: string, dto: UpdateLogisticsDto): Promise<Logistics> {
    const logistics = await this.findOne(id);
    Object.assign(logistics, dto);
    return this.logisticsRepository.save(logistics);
  }

  async remove(id: string): Promise<{ message: string }> {
    const logistics = await this.findOne(id);
    await this.logisticsRepository.remove(logistics);
    return { message: 'Logistics successfully deleted' };
  }

  // ==================== REPORT METHODS ====================

  async getLogisticsReport(dto: LogisticsReportQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const qb = this.logisticsRepository
      .createQueryBuilder('l')
      .select([
        'l.id AS id',
        'l.title AS title',
        'l.given AS given',
        'l.owed AS owed',
        'l."totalDebt" AS "totalDebt"',
        `COALESCE(SUM(CASE WHEN c.type = 'income' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_income`,
        `COALESCE(SUM(CASE WHEN c.type = 'expense' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_expense`,
      ])
      .leftJoin(
        'cashflow',
        'c',
        `c."logisticsId" = l.id AND c.isCancelled = false AND c.date BETWEEN :startDate AND :endDate`,
        { startDate, endDate },
      )
      .where('l."deletedDate" IS NULL')
      .groupBy('l.id')
      .orderBy('l."totalDebt"', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.search) {
      qb.andWhere('l.title ILIKE :search', { search: `%${dto.search}%` });
    }

    const items = await qb.getRawMany();

    // Count total
    const countQb = this.logisticsRepository
      .createQueryBuilder('l')
      .where('l."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('l.title ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    // Totals
    const totalsQb = this.logisticsRepository
      .createQueryBuilder('l')
      .select([
        `SUM(l.given)::NUMERIC(20,2) AS total_given`,
        `SUM(l.owed)::NUMERIC(20,2) AS total_owed`,
        `SUM(l."totalDebt")::NUMERIC(20,2) AS total_debt`,
        `COALESCE(SUM(pi.period_income), 0)::NUMERIC(20,2) AS total_period_income`,
        `COALESCE(SUM(pe.period_expense), 0)::NUMERIC(20,2) AS total_period_expense`,
      ])
      .leftJoin(
        (sub) =>
          sub
            .select('c."logisticsId"', 'logisticsId')
            .addSelect(`SUM(CASE WHEN c.type = 'income' THEN c.price ELSE 0 END)`, 'period_income')
            .from('cashflow', 'c')
            .where('c.isCancelled = false AND c.date BETWEEN :s AND :e', { s: startDate, e: endDate })
            .groupBy('c."logisticsId"'),
        'pi',
        'pi."logisticsId" = l.id',
      )
      .leftJoin(
        (sub) =>
          sub
            .select('c2."logisticsId"', 'logisticsId')
            .addSelect(`SUM(CASE WHEN c2.type = 'expense' THEN c2.price ELSE 0 END)`, 'period_expense')
            .from('cashflow', 'c2')
            .where('c2.isCancelled = false AND c2.date BETWEEN :s2 AND :e2', { s2: startDate, e2: endDate })
            .groupBy('c2."logisticsId"'),
        'pe',
        'pe."logisticsId" = l.id',
      )
      .where('l."deletedDate" IS NULL');

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

  async getLogisticsDetailReport(logisticsId: string, dto: LogisticsDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const logistics = await this.findOne(logisticsId);

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
      .leftJoin('cash.logistics', 'logistics')
      .addSelect(['logistics.id', 'logistics.title'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .where('logistics.id = :logisticsId', { logisticsId })
      .andWhere('cash.isCancelled = false')
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
        SUM(CASE WHEN cash.type = 'expense' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_expense
      `)
      .leftJoin('cash.logistics', 'logistics')
      .where('logistics.id = :logisticsId', { logisticsId })
      .andWhere('cash.isCancelled = false')
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
      logistics: {
        id: logistics.id,
        title: logistics.title,
        given: logistics.given,
        owed: logistics.owed,
        totalDebt: logistics.totalDebt,
      },
    };
  }

  async generateLogisticsExcel(dto: LogisticsExcelQueryDto): Promise<Buffer> {
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

    if (dto.logisticsId) {
      // Single logistics cashflows export
      const logistics = await this.findOne(dto.logisticsId);
      const sheet = workbook.addWorksheet(`${logistics.title}`);

      sheet.mergeCells('A1:F1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `${logistics.title} — ${year} yil ${month}-oy`;
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
        .leftJoin('cash.logistics', 'logistics')
        .leftJoin('cash.createdBy', 'createdBy')
        .select(['cash.id', 'cash.price', 'cash.type', 'cash.comment', 'cash.date', 'createdBy.firstName', 'createdBy.lastName'])
        .where('logistics.id = :logisticsId', { logisticsId: dto.logisticsId })
        .andWhere('cash.isCancelled = false')
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
      // All logistics summary export
      const report = await this.getLogisticsReport({ year, month, page: 1, limit: 10000 });
      const sheet = workbook.addWorksheet('Logistika');

      sheet.mergeCells('A1:G1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `Logistika hisoboti — ${year} yil ${month}-oy`;
      titleCell.font = { bold: true, size: 14 };

      const headers = ['№', 'Nomi', 'Olingan ($)', 'To\'langan ($)', 'Qoldiq ($)', 'Davriy kirim ($)', 'Davriy chiqim ($)'];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(3, i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      sheet.columns = [
        { width: 5 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
      ];

      report.items.forEach((item, idx) => {
        const row = sheet.getRow(idx + 4);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = item.title || '';
        row.getCell(3).value = item.owed;
        row.getCell(4).value = item.given;
        row.getCell(5).value = item.totalDebt;
        row.getCell(6).value = item.period_income;
        row.getCell(7).value = item.period_expense;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  @Cron('3 0 1 1 *', { name: 'logistics-year-end-reset' })
  async handleYearEndLogisticsReset() {
    this.logger.log('Starting year-end logistics reset...');
    const items = await this.logisticsRepository.find();
    for (const item of items) {
      item.owed = item.totalDebt;
      item.given = 0;
      // totalDebt = owed - given = totalDebt (unchanged)
    }
    await this.logisticsRepository.save(items);
    this.logger.log(`Year-end logistics reset completed for ${items.length} items`);
  }
}
