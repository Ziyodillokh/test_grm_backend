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

  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.repository
      .createQueryBuilder('e')
      .leftJoin('country', 'p', 'p.id = e."countryId"')
      .leftJoin('qrbase', 'qb', 'qb."factoryId" = e.id AND qb."deletedDate" IS NULL')
      .select('e.id', 'id')
      .addSelect('e.title', 'title')
      .addSelect('p.title', 'parentTitle')
      .addSelect('COUNT(qb.id)', 'qrBaseCount')
      .groupBy('e.id')
      .addGroupBy('p.title')
      .orderBy('e.title', 'ASC');
    if (where.title) {
      qb.andWhere('(e.title ILIKE :s OR p.title ILIKE :s)', { s: `%${where.title}%` });
    }
    const limit = Number(options.limit) || 50;
    const page = Number(options.page) || 1;
    const items = await qb.clone().offset((page - 1) * limit).limit(limit).getRawMany();

    const countQb = this.repository
      .createQueryBuilder('e')
      .leftJoin('country', 'p', 'p.id = e."countryId"');
    if (where.title) {
      countQb.andWhere('(e.title ILIKE :s OR p.title ILIKE :s)', { s: `%${where.title}%` });
    }
    const totalCount = await countQb.getCount();

    return {
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        parentTitle: it.parentTitle || null,
        qrBaseCount: Number(it.qrBaseCount) || 0,
      })),
      meta: { totalItems: totalCount, itemCount: items.length, itemsPerPage: limit, totalPages: Math.ceil(totalCount / limit), currentPage: page },
    };
  }

  async getOne(id: string) {
    return await this.repository.findOne({ where: { id } });
  }

  async deleteOne(id: string) {
    // Factory o'chirilganda, bog'liq qrbase'lar factoryId NULL ga o'tadi (FK cascade)
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
    const year = dto.year || dayjs().year();
    const month = dto.month || (dayjs().month() + 1);

    const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').toDate();

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

    // Period data per factory
    const factoryIds = items.map((i: any) => i.id);
    let periodOwedMap = new Map<string, number>();
    let periodGivenMap = new Map<string, number>();

    if (factoryIds.length > 0) {
      const periodOwedResult = await this.entityManager.query(`
        SELECT p."factoryId" AS factory_id,
          SUM(
            CASE
              WHEN qb."isMetric" = true THEN (pe.check_count::numeric / 100) * s.x
              ELSE s.y * s.x * pe.count
            END * pcp."factoryPricePerKv"
          )::NUMERIC(20,2) AS period_owed
        FROM partiya p
        JOIN "partiya-collection-price" pcp ON pcp."partiyaId" = p.id
        JOIN productexcel pe ON pe."partiyaId" = p.id
        JOIN qrbase qb ON pe."barCodeId" = qb.id AND qb."collectionId" = pcp."collectionId"
        JOIN size s ON qb."sizeId" = s.id
        WHERE p."factoryId" = ANY($1)
          AND p.partiya_status = 'finished'
          AND p.date BETWEEN $2 AND $3
        GROUP BY p."factoryId"
      `, [factoryIds, startDate, endDate]);

      const periodGivenResult = await this.entityManager.query(`
        SELECT c."factoryId" AS factory_id,
          COALESCE(SUM(c.price), 0)::NUMERIC(20,2) AS period_given
        FROM cashflow c
        WHERE c."factoryId" = ANY($1)
          AND c.isCancelled = false
          AND c.date BETWEEN $2 AND $3
        GROUP BY c."factoryId"
      `, [factoryIds, startDate, endDate]);

      periodOwedMap = new Map(periodOwedResult.map((r: any) => [r.factory_id, Number(r.period_owed)]));
      periodGivenMap = new Map(periodGivenResult.map((r: any) => [r.factory_id, Number(r.period_given)]));
    }

    return {
      items: items.map((i: any) => ({
        ...i,
        owed: Number(i.owed || 0),
        given: Number(i.given || 0),
        totalDebt: Number(i.totalDebt || 0),
        period_owed: periodOwedMap.get(i.id) || 0,
        period_given: periodGivenMap.get(i.id) || 0,
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

    // Source A: Partiya collection entries (per collection)
    const rawPartiyaEntries = await this.entityManager.query(`
      SELECT
        p.id AS partiya_id,
        p.date,
        pn.title AS partiya_name,
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
      LEFT JOIN partiya_number pn ON p."partiyaNoId" = pn.id
      JOIN "partiya-collection-price" pcp ON pcp."partiyaId" = p.id
      JOIN collection col ON pcp."collectionId" = col.id
      JOIN productexcel pe ON pe."partiyaId" = p.id
      JOIN qrbase qb ON pe."barCodeId" = qb.id AND qb."collectionId" = col.id
      JOIN size s ON qb."sizeId" = s.id
      WHERE p."factoryId" = $1
        AND p.partiya_status = 'finished'
        AND p.date BETWEEN $2 AND $3
      GROUP BY p.id, p.date, pn.title, col.title, pcp."factoryPricePerKv"
      ORDER BY p.date ASC
    `, [factoryId, startDate, endDate]);

    // Group collections by partiya
    const partiyaMap = new Map<string, any>();
    for (const entry of rawPartiyaEntries) {
      const key = entry.partiya_id;
      if (!partiyaMap.has(key)) {
        partiyaMap.set(key, {
          id: entry.partiya_id,
          entry_type: 'partiya',
          date: entry.date,
          partiya_name: entry.partiya_name || 'Partiya',
          total_kv: 0,
          total_cost: 0,
          collections: [],
        });
      }
      const group = partiyaMap.get(key);
      group.total_kv += Number(entry.total_kv || 0);
      group.total_cost += Number(entry.total_cost || 0);
      group.collections.push({
        collection_title: entry.collection_title,
        price_per_kv: Number(entry.price_per_kv || 0),
        total_kv: Number(entry.total_kv || 0),
        total_cost: Number(entry.total_cost || 0),
      });
    }
    const partiyaEntries = Array.from(partiyaMap.values()).map((e) => ({
      ...e,
      total_kv: Number(e.total_kv.toFixed(2)),
      total_cost: Number(e.total_cost.toFixed(2)),
    }));

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
      LEFT JOIN users u ON c."createdById" = u.id
      WHERE c."factoryId" = $1
        AND c.isCancelled = false
        AND c.date BETWEEN $2 AND $3
      ORDER BY c.date ASC
    `, [factoryId, startDate, endDate]);

    // Merge and sort by date
    const allEntries = [
      ...partiyaEntries,
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
