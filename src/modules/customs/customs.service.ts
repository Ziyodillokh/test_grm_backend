import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
import * as ExcelJS from 'exceljs';
import { Customs } from './customs.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateCustomsDto } from './dto/create-customs.dto';
import { UpdateCustomsDto } from './dto/update-customs.dto';
import { CustomsReportQueryDto } from './dto/customs-report-query.dto';
import { CustomsDetailQueryDto } from './dto/customs-detail-query.dto';
import { CustomsExcelQueryDto } from './dto/customs-excel-query.dto';

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);

  constructor(
    @InjectRepository(Customs)
    private readonly customsRepository: Repository<Customs>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
  ) {}

  async findAll(options: IPaginationOptions): Promise<Pagination<Customs>> {
    const queryBuilder = this.customsRepository.createQueryBuilder('customs');
    return paginate<Customs>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Customs> {
    const customs = await this.customsRepository.findOne({ where: { id } });
    if (!customs) {
      throw new NotFoundException('Customs not found');
    }
    return customs;
  }

  async create(dto: CreateCustomsDto): Promise<Customs> {
    const customs = this.customsRepository.create(dto);
    return this.customsRepository.save(customs);
  }

  async update(id: string, dto: UpdateCustomsDto): Promise<Customs> {
    const customs = await this.findOne(id);
    Object.assign(customs, dto);
    return this.customsRepository.save(customs);
  }

  async remove(id: string): Promise<{ message: string }> {
    const customs = await this.findOne(id);
    await this.customsRepository.remove(customs);
    return { message: 'Customs successfully deleted' };
  }

  // ==================== REPORT METHODS ====================

  async getCustomsReport(dto: CustomsReportQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const qb = this.customsRepository
      .createQueryBuilder('l')
      .select([
        'l.id AS id',
        'l.title AS title',
        'l.given AS given',
        'l.owed AS owed',
        'l."totalDebt" AS "totalDebt"',
        `COALESCE(SUM(CASE WHEN c.type = 'Приход' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_income`,
        `COALESCE(SUM(CASE WHEN c.type = 'Расход' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_expense`,
      ])
      .leftJoin(
        'cashflow',
        'c',
        `c."customsId" = l.id AND c.isCancelled = false AND c.date BETWEEN :startDate AND :endDate`,
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
    const countQb = this.customsRepository
      .createQueryBuilder('l')
      .where('l."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('l.title ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    // Totals
    const totalsQb = this.customsRepository
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
            .select('c."customsId"', 'customsId')
            .addSelect(`SUM(CASE WHEN c.type = 'Приход' THEN c.price ELSE 0 END)`, 'period_income')
            .from('cashflow', 'c')
            .where('c.isCancelled = false AND c.date BETWEEN :s AND :e', { s: startDate, e: endDate })
            .groupBy('c."customsId"'),
        'pi',
        'pi."customsId" = l.id',
      )
      .leftJoin(
        (sub) =>
          sub
            .select('c2."customsId"', 'customsId')
            .addSelect(`SUM(CASE WHEN c2.type = 'Расход' THEN c2.price ELSE 0 END)`, 'period_expense')
            .from('cashflow', 'c2')
            .where('c2.isCancelled = false AND c2.date BETWEEN :s2 AND :e2', { s2: startDate, e2: endDate })
            .groupBy('c2."customsId"'),
        'pe',
        'pe."customsId" = l.id',
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

  async getCustomsDetailReport(customsId: string, dto: CustomsDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const customs = await this.findOne(customsId);

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
      .leftJoin('cash.customs', 'customs')
      .addSelect(['customs.id', 'customs.title'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .where('customs.id = :customsId', { customsId })
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
        SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_income,
        SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_expense
      `)
      .leftJoin('cash.customs', 'customs')
      .where('customs.id = :customsId', { customsId })
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
      customs: {
        id: customs.id,
        title: customs.title,
        given: customs.given,
        owed: customs.owed,
        totalDebt: customs.totalDebt,
      },
    };
  }

  async generateCustomsExcel(dto: CustomsExcelQueryDto): Promise<Buffer> {
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

    if (dto.customsId) {
      const customs = await this.findOne(dto.customsId);
      const sheet = workbook.addWorksheet(`${customs.title}`);

      sheet.mergeCells('A1:F1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `${customs.title} — ${year} yil ${month}-oy`;
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
        .leftJoin('cash.customs', 'customs')
        .leftJoin('cash.createdBy', 'createdBy')
        .select(['cash.id', 'cash.price', 'cash.type', 'cash.comment', 'cash.date', 'createdBy.firstName', 'createdBy.lastName'])
        .where('customs.id = :customsId', { customsId: dto.customsId })
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
      const report = await this.getCustomsReport({ year, month, page: 1, limit: 10000 });
      const sheet = workbook.addWorksheet('Bojxona');

      sheet.mergeCells('A1:G1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `Bojxona hisoboti — ${year} yil ${month}-oy`;
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

  @Cron('4 0 1 1 *', { name: 'customs-year-end-reset' })
  async handleYearEndCustomsReset() {
    this.logger.log('Starting year-end customs reset...');
    const items = await this.customsRepository.find();
    for (const item of items) {
      item.owed = item.totalDebt;
      item.given = 0;
    }
    await this.customsRepository.save(items);
    this.logger.log(`Year-end customs reset completed for ${items.length} items`);
  }
}
