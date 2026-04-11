import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { Factory } from './factory.entity';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import { CreateFactoryDto, UpdateFactoryDto } from './dto';
import { Country } from '@modules/country/country.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { FactoryReportQueryDto } from './dto/factory-report-query.dto';
import { FactoryDetailQueryDto } from './dto/factory-detail-query.dto';
import { FactoryExcelQueryDto } from './dto/factory-excel-query.dto';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
import * as ExcelJS from 'exceljs';

@Injectable()
export class FactoryService {
  private readonly logger = new Logger(FactoryService.name);

  constructor(
    @InjectRepository(Factory)
    private readonly repository: Repository<Factory>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    private readonly entityManager: EntityManager,
  ) {
  }

  async create(data: CreateFactoryDto) {
    const res = this.repository.create(data as unknown as Factory);
    return await this.repository.save(res);
  }

  async getAll(options: IPaginationOptions, where: { title: string }) {
    return paginate<Factory>(this.repository, options, {
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      },
      relations: {
        country: true,
      },
    });
  }

  async getOne(id: string) {
    return await this.repository.findOne({ where: { id } });
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase').update().set({ is_active: false })
      .where('factoryId = :id', { id }).execute();

    return await this.repository.delete(id).catch(() => {
      throw new NotFoundException('factory not found');
    });
  }

  async change(value: UpdateFactoryDto, id: string) {
    return await this.repository
      .createQueryBuilder()
      .update()
      .set(value as unknown as Factory)
      .where('id = :id', { id })
      .execute();
  }

  async findOrCreate(title, country) {
    title = title.toLowerCase().trim().split(" ")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const response = await this.repository.findOne({
      where: { title: ILike(`%${title}%`) },
    });

    if (!response) {
      return (await this.create({ title, country })).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.repository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async connectFactoriesToCountry(data: { countryId: string; factories: string[] }) {
    const exists = await this.countryRepository.existsBy({ id: data.countryId });
    if (!exists) throw new Error(`Country ${data.countryId} does not exist`);

    await this.repository
      .createQueryBuilder()
      .update()
      .set({ country: () => `:countryId` })
      .whereInIds(data.factories)
      .setParameters({ countryId: data.countryId })
      .execute();
  }

  // ==================== REPORT METHODS ====================

  async toggleReport(id: string) {
    const factory = await this.repository.findOne({ where: { id } });
    if (!factory) throw new NotFoundException('Factory not found');
    factory.isReportEnabled = !factory.isReportEnabled;
    await this.repository.save(factory);
    return { isReportEnabled: factory.isReportEnabled };
  }

  async getReportEnabled() {
    return this.repository.find({
      where: { isReportEnabled: true },
      relations: { country: true },
      order: { title: 'ASC' },
    });
  }

  async getNotReportEnabled() {
    return this.repository.find({
      where: { isReportEnabled: false },
      order: { title: 'ASC' },
    });
  }

  async getFactoryReport(dto: FactoryReportQueryDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('f')
      .select([
        'f.id AS id',
        'f.title AS title',
        'f.owed AS owed',
        'f.given AS given',
        'f."totalDebt" AS "totalDebt"',
        'c.title AS country',
      ])
      .leftJoin('f.country', 'c')
      .where('f."isReportEnabled" = true')
      .andWhere('f."deletedDate" IS NULL')
      .groupBy('f.id, c.title')
      .orderBy('f."totalDebt"', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.search) {
      qb.andWhere('f.title ILIKE :search', { search: `%${dto.search}%` });
    }

    const items = await qb.getRawMany();

    const countQb = this.repository
      .createQueryBuilder('f')
      .where('f."isReportEnabled" = true')
      .andWhere('f."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('f.title ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    const totalsQb = this.repository
      .createQueryBuilder('f')
      .select([
        'SUM(f.owed)::NUMERIC(20,2) AS total_owed',
        'SUM(f.given)::NUMERIC(20,2) AS total_given',
        'SUM(f."totalDebt")::NUMERIC(20,2) AS total_debt',
      ])
      .where('f."isReportEnabled" = true')
      .andWhere('f."deletedDate" IS NULL');
    const totals = await totalsQb.getRawOne();

    return {
      items: items.map((i) => ({
        ...i,
        owed: Number(i.owed || 0),
        given: Number(i.given || 0),
        totalDebt: Number(i.totalDebt || 0),
      })),
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        itemCount: limit,
      },
      totals: {
        total_owed: Number(totals?.total_owed || 0),
        total_given: Number(totals?.total_given || 0),
        total_debt: Number(totals?.total_debt || 0),
      },
    };
  }

  async getFactoryDetailReport(factoryId: string, dto: FactoryDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || null;
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const factory = await this.repository.findOne({
      where: { id: factoryId },
      relations: { country: true },
    });
    if (!factory) throw new NotFoundException('Factory not found');

    let startDate: Date;
    let endDate: Date;
    if (month) {
      startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${year}-12-31`).endOf('year').toDate();
    }

    // Source A: Partiya collection entries
    const partiyaEntries = await this.entityManager.query(`
      SELECT
        p.id AS partiya_id,
        'partiya' AS entry_type,
        p.date,
        col.title AS collection_title,
        pcp."factoryPricePerKv" AS price_per_kv,
        SUM(CASE
          WHEN qb."isMetric" = true THEN (pe.check_count::numeric / 100) * s.x
          ELSE s.y * s.x * pe.count
        END)::NUMERIC(20,2) AS total_kv,
        (SUM(CASE
          WHEN qb."isMetric" = true THEN (pe.check_count::numeric / 100) * s.x
          ELSE s.y * s.x * pe.count
        END) * pcp."factoryPricePerKv")::NUMERIC(20,2) AS total_cost
      FROM partiya p
      JOIN "partiya-collection-price" pcp ON pcp."partiyaId" = p.id
      JOIN collection col ON pcp."collectionId" = col.id
      JOIN productexcel pe ON pe."partiyaId" = p.id
      JOIN qrbase qb ON pe."barCodeId" = qb.id AND qb."collectionId" = col.id
      JOIN size s ON qb."sizeId" = s.id
      WHERE p."factoryId" = $1
        AND p.partiya_status = 'finished'
        AND p.date BETWEEN $2 AND $3
      GROUP BY p.id, p.date, col.title, pcp."factoryPricePerKv"
      ORDER BY p.date ASC
    `, [factoryId, startDate, endDate]);

    // Source B: Payment entries (cashflows)
    const paymentEntries = await this.entityManager.query(`
      SELECT
        c.id,
        'payment' AS entry_type,
        c.date,
        c.price AS total_cost,
        c.comment,
        u."firstName" || ' ' || u."lastName" AS who_paid
      FROM cashflow c
      JOIN "user" u ON c."createdById" = u.id
      WHERE c."factoryId" = $1
        AND c.is_cancelled = false
        AND c.date BETWEEN $2 AND $3
      ORDER BY c.date ASC
    `, [factoryId, startDate, endDate]);

    // Merge and sort by date
    const allEntries = [
      ...partiyaEntries.map((e: any) => ({
        ...e,
        total_kv: Number(e.total_kv || 0),
        price_per_kv: Number(e.price_per_kv || 0),
        total_cost: Number(e.total_cost || 0),
      })),
      ...paymentEntries.map((e: any) => ({
        ...e,
        total_cost: Number(e.total_cost || 0),
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Paginate
    const totalItems = allEntries.length;
    const offset = (page - 1) * limit;
    const paginatedItems = allEntries.slice(offset, offset + limit);

    // Totals for period
    const totalOwed = partiyaEntries.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
    const totalGiven = paymentEntries.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);

    return {
      items: paginatedItems,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        itemCount: limit,
      },
      totals: {
        period_owed: Number(totalOwed.toFixed(2)),
        period_given: Number(totalGiven.toFixed(2)),
        period_balance: Number((totalOwed - totalGiven).toFixed(2)),
      },
      factory: {
        id: factory.id,
        title: factory.title,
        country: factory.country?.title || '',
        owed: factory.owed,
        given: factory.given,
        totalDebt: factory.totalDebt,
      },
    };
  }

  async generateFactoryExcel(dto: FactoryExcelQueryDto): Promise<Buffer> {
    const year = dto.year || dayjs().year();
    const month = dto.month || null;

    const workbook = new ExcelJS.Workbook();

    if (dto.factoryId) {
      const detail = await this.getFactoryDetailReport(dto.factoryId, {
        year,
        month,
        limit: 10000,
      });

      const sheet = workbook.addWorksheet(detail.factory.title);
      sheet.columns = [
        { header: '№', key: 'no', width: 5 },
        { header: 'Sana', key: 'date', width: 15 },
        { header: 'Turi', key: 'type', width: 12 },
        { header: 'Kolleksiya', key: 'collection', width: 20 },
        { header: 'M kv', key: 'kv', width: 12 },
        { header: 'Narxi', key: 'price', width: 12 },
        { header: 'Summasi', key: 'total', width: 15 },
        { header: 'Kim to\'lagan', key: 'who', width: 20 },
        { header: 'Izoh', key: 'comment', width: 25 },
      ];

      detail.items.forEach((item: any, idx: number) => {
        sheet.addRow({
          no: idx + 1,
          date: dayjs(item.date).format('DD.MM.YYYY'),
          type: item.entry_type === 'partiya' ? 'Partiya' : 'To\'lov',
          collection: item.collection_title || '',
          kv: item.total_kv || '',
          price: item.price_per_kv || '',
          total: item.total_cost,
          who: item.who_paid || '',
          comment: item.comment || '',
        });
      });
    } else {
      const report = await this.getFactoryReport({ year, limit: 1000 });
      const sheet = workbook.addWorksheet('Zavodlar hisoboti');
      sheet.columns = [
        { header: '№', key: 'no', width: 5 },
        { header: 'Zavod', key: 'title', width: 25 },
        { header: 'Mamlakat', key: 'country', width: 15 },
        { header: 'Olingan', key: 'owed', width: 15 },
        { header: 'To\'langan', key: 'given', width: 15 },
        { header: 'Qolgan', key: 'totalDebt', width: 15 },
      ];

      report.items.forEach((item: any, idx: number) => {
        sheet.addRow({
          no: idx + 1,
          title: item.title,
          country: item.country || '',
          owed: item.owed,
          given: item.given,
          totalDebt: item.totalDebt,
        });
      });
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  @Cron('2 0 1 1 *', { name: 'factory-year-end-reset' })
  async handleYearEndFactoryReset() {
    this.logger.log('Running factory year-end reset...');
    const factories = await this.repository.find({ where: { isReportEnabled: true } });
    for (const factory of factories) {
      factory.owed = factory.totalDebt;
      factory.given = 0;
    }
    await this.repository.save(factories);
    this.logger.log(`Factory year-end reset completed for ${factories.length} factories.`);
  }
}
