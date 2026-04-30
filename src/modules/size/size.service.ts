import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, Repository } from 'typeorm';

import { Size } from './size.entity';
import { CreateSizeDto, UpdateSizeDto } from './dto';
import { sizeParser } from '../../infra/helpers';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import { Product } from '@modules/product/product.entity';

@Injectable()

export class SizeService {
  constructor(
    @InjectRepository(Size)
    private readonly sizeRepository: Repository<Size>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {
  }

  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.sizeRepository
      .createQueryBuilder('e')
      .leftJoin('qrbase', 'qb', 'qb."sizeId" = e.id AND qb."deletedDate" IS NULL')
      .select('e.id', 'id')
      .addSelect('e.title', 'title')
      .addSelect('COUNT(qb.id)', 'qrBaseCount')
      .groupBy('e.id')
      .orderBy('e.title', 'ASC');
    if (where.title) qb.andWhere('e.title ILIKE :title', { title: `%${where.title}%` });
    const limit = Number(options.limit) || 50;
    const page = Number(options.page) || 1;
    const [items, totalCount] = await Promise.all([
      qb.clone().offset((page - 1) * limit).limit(limit).getRawMany(),
      this.sizeRepository.count({ where: where.title ? { title: ILike(`%${where.title}%`) } : {} }),
    ]);
    return {
      items: items.map((it) => ({ id: it.id, title: it.title, qrBaseCount: Number(it.qrBaseCount) || 0 })),
      meta: { totalItems: totalCount, itemCount: items.length, itemsPerPage: limit, totalPages: Math.ceil(totalCount / limit), currentPage: page },
    };
  }

  async getAll(options: IPaginationOptions, where: { title: string }) {
    return paginate<Size>(this.sizeRepository, options, {
      order: {
        title: 'asc',
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      },
    });
  }

  async getOne(id: string) {
    const data = await this.sizeRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Size not found');
      });

    return data;
  }

  async getOneByName(title: string) {
    const [data] = await this.sizeRepository.find({
      where: { title: ILike(title) },
    });

    return data;
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase').update().set({ is_active: false })
      .where('sizeId = :id', { id }).execute();
    return await this.sizeRepository.delete(id).catch(() => {
      throw new NotFoundException('Size not found');
    });
  }

  async change(value: UpdateSizeDto, id: string) {
    const xy = sizeParser(value.title);
    value.x = xy[0] / 100;
    value.y = xy[1] / 100;
    value.kv = value.x * value.y;
    return await this.sizeRepository.update({ id }, value);
  }

  async create(value: CreateSizeDto) {
    const xy = sizeParser(value.title);
    value.x = xy[0] / 100;
    value.y = xy[1] / 100;
    value.kv = value.x * value.y;
    const data = this.sizeRepository.create(value);
    return await this.sizeRepository.save(data);
  }

  async mergeSizeReferences(
    oldSizeId: string,
    newSizeTitle: string,
  ) {
    const sizeRepo = this.dataSource.getRepository('size');
    const oldSize = await sizeRepo.findOneBy({ id: oldSizeId });
    if (!oldSize) throw new Error('Old size not found');

    const existingSize = await sizeRepo.findOne({ where: { title: newSizeTitle } });

    if (!existingSize) {
      // Just update the title
      const xy = sizeParser(newSizeTitle);
      const value = {
        x: xy[0] / 100,
        y: xy[1] / 100,
        kv: 0,
      };
      value.kv = value.x * value.y;
      await this.sizeRepository.update({ id: oldSizeId }, value);
      return { message: 'Size title updated.' };
    }

    const client = this.dataSource.createQueryRunner();
    await client.connect();
    await client.startTransaction();

    try {
      // Step 1: Find all foreign key references to size
      const refs = await client.query(`
  SELECT
    kcu.table_name,
    kcu.column_name
  FROM
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.constraint_schema = ccu.constraint_schema
  WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'size'
`);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;

        // Step 2: Update all rows in this table from oldSizeId to existingSize.id
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existingSize.id, oldSizeId],
        );
      }

      // Step 3: Delete the old size
      await client.manager.delete('size', oldSizeId);

      await client.commitTransaction();
      return { message: 'Merged references and deleted old size.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }

  async findOrCreate(title) {
    title = title.toLowerCase().trim().split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    const response = await this.sizeRepository.findOne({
      where: { title: ILike(`${title}`) },
    });
    const value = { title, x: 0, y: 0, kv: 0 };
    const xy = sizeParser(value.title);
    value.x = xy[0] / 100;
    value.y = xy[1] / 100;
    value.kv = value.x * value.y;
    if (!response) {
      return (await this.create(value)).id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.sizeRepository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async sizesReport(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    model?: string,
    factory?: string,
    collectionId?: string,
    country?: string,
    year?: string,
    month?: string, // 👈 added month/year filter
  ) {
    const skip = (page - 1) * limit;

    // === Calculate the last day of (month, year) ===
    let endDate: string | null = null;
    if (year && month) {
      const lastDay = new Date(+year, +month, 0); // e.g., (2025, 2, 0) -> Feb 28/29
      endDate = lastDay.toISOString().split('T')[0];
    }

    // === Subquery: latest_price ===
    const latestPriceSubQuery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ON (cp."collectionId") cp."collectionId"', 'collectionId')
      .addSelect('cp."priceMeter"', 'priceMeter')
      .from('collection-price', 'cp')
      .where(`cp.type = 'filial'`)
      .orderBy('cp."collectionId"')
      .addOrderBy('cp."date"', 'DESC');

    // === Base conditions ===
    const baseWhere = [
      'p.count > 0',
      'p.y > 0.1',
      `f.type != 'dealer'`,
    ];

    if (filialId) baseWhere.push('p."filialId" = :filialId');
    if (country) baseWhere.push('q."countryId" = :country');
    if (factory) baseWhere.push('q."factoryId" = :factory');
    if (collectionId) baseWhere.push('q."collectionId" = :collectionId');
    if (model) baseWhere.push('q."modelId" = :model');
    if (endDate) baseWhere.push('p.date <= :endDate'); // 👈 added date filter

    // === Main query ===
    const query = this.productRepo
      .createQueryBuilder('p')
      .select([
        `json_build_object('id', s.id, 'title', s.title) as size`,
        `COALESCE(SUM(s.x * p.y * p.count), 0) as "totalKv"`,
        `COALESCE(SUM(p.count), 0) as "totalCount"`,
        `COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) as "totalPrice"`,
      ])
      .innerJoin('p.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin('q.country', 'co')
      .innerJoin('q.factory', 'fa')
      .innerJoin('q.model', 'm')
      .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .groupBy('s.id')
      .addGroupBy('s.title')
      .orderBy('s.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        country,
        factory,
        collectionId,
        model,
        endDate,
      });

    const [rows, totalResult, totals] = await Promise.all([
      query.getRawMany(),

      // === Total rows count ===
      this.productRepo
        .createQueryBuilder('p')
        .innerJoin('p.bar_code', 'q')
        .innerJoin('q.model', 'm')
        .innerJoin('p.filial', 'f')
        .innerJoin('q.size', 's')
        .where(baseWhere.join(' AND '))
        .select('COUNT(DISTINCT s.id)', 'total')
        .setParameters({
          filialId,
          country,
          factory,
          collectionId,
          model,
          endDate,
        })
        .getRawOne(),

      // === Totals ===
      this.productRepo
        .createQueryBuilder('p')
        .select([
          `COALESCE(SUM(s.x * p.y * p.count), 0) as "totalKv"`,
          `COALESCE(SUM(p.count), 0) as "totalCount"`,
          `COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) as "totalPrice"`,
        ])
        .innerJoin('p.bar_code', 'q')
        .innerJoin('q.size', 's')
        .innerJoin('q.collection', 'c')
        .innerJoin('p.filial', 'f')
        .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
        .innerJoin('q.factory', 'fa')
        .where(baseWhere.join(' AND '))
        .setParameters({
          ...latestPriceSubQuery.getParameters(),
          filialId,
          country,
          factory,
          collectionId,
          model,
          endDate,
        })
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    return {
      items: rows.map((r) => ({
        ...r.size,
        totalCount: +(Number(r.totalCount).toFixed(2)),
        totalKv: +(Number(r.totalKv).toFixed(2)),
        totalKvPrice: +(Number(r.totalPrice).toFixed(2)),
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
          totalCount: +(Number(totals?.totalCount || 0).toFixed(2)),
          totalKv: +(Number(totals?.totalKv || 0).toFixed(2)),
          totalPrice: +(Number(totals?.totalPrice || 0).toFixed(2)),
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalNetProfitSum: 0,
        },
      },
    };
  }

  async sizesReportOrder(
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    model?: string,
    factory?: string,
    collectionId?: string,
    country?: string,
    year?: string,
    month?: string,
  ) {
    const skip = (page - 1) * limit;

    // === Compute full month date range ===
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      startDate = new Date(y, m - 1, 1, 0, 0, 0);        // 1st day 00:00:00
      endDate = new Date(y, m, 0, 23, 59, 59, 999);      // last day 23:59:59.999
    }

    // === Base filters ===
    const where = [`o.status = 'accepted'`];
    if (filialId) where.push('f.id = :filialId');
    if (country) where.push('co.id = :country');
    if (factory) where.push('fa.id = :factory');
    if (collectionId) where.push('c.id = :collectionId');
    if (model) where.push('m.id = :model');
    if (startDate && endDate) where.push('o."date" BETWEEN :startDate AND :endDate');

    // === Main data query ===
    const query = this.dataSource
      .createQueryBuilder()
      .select([
        `json_build_object('id', s.id, 'title', s.title) as size`,
        `COALESCE(SUM(o.kv), 0) as "totalKv"`,
        `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
        `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20, 2) as "totalPrice"`,
        `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20, 2) as "totalNetProfitPrice"`,
      ])
      .from('order', 'o')
      .innerJoin('qrbase', 'q', 'o."barCodeId" = q.id')
      .innerJoin('size', 's', 'q."sizeId" = s.id')
      .innerJoin('collection', 'c', 'q."collectionId" = c.id')
      .innerJoin('country', 'co', 'q."countryId" = co.id')
      .innerJoin('factory', 'fa', 'q."factoryId" = fa.id')
      .innerJoin('model', 'm', 'q."modelId" = m.id')
      .innerJoin('product', 'p', 'o."productId" = p.id')
      .innerJoin('filial', 'f', 'p."filialId" = f.id')
      .where(where.join(' AND '))
      .groupBy('s.id')
      .addGroupBy('s.title')
      .orderBy('s.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        filialId,
        country,
        factory,
        collectionId,
        model,
        startDate,
        endDate,
      });

    // === Parallel queries ===
    const [rows, totalResult, totals] = await Promise.all([
      query.getRawMany(),

      // Count total distinct sizes
      this.dataSource
        .createQueryBuilder()
        .from('order', 'o')
        .innerJoin('qrbase', 'q', 'o."barCodeId" = q.id')
        .innerJoin('size', 's', 'q."sizeId" = s.id')
        .innerJoin('product', 'p', 'o."productId" = p.id')
        .innerJoin('country', 'co', 'q."countryId" = co.id')
        .innerJoin('filial', 'f', 'p."filialId" = f.id')
        .innerJoin('model', 'm', 'q."modelId" = m.id')
        .where(where.join(' AND '))
        .select('COUNT(DISTINCT s.id)', 'total')
        .setParameters({ filialId, country, factory, collectionId, model, startDate, endDate })
        .getRawOne(),

      // Overall totals
      this.dataSource
        .createQueryBuilder()
        .select([
          `COALESCE(SUM(o.kv), 0) as "totalKv"`,
          `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
          `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20, 2) as "totalPrice"`,
          `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20, 2) as "totalNetProfitPrice"`,
        ])
        .from('order', 'o')
        .innerJoin('qrbase', 'q', 'o."barCodeId" = q.id')
        .innerJoin('size', 's', 'q."sizeId" = s.id')
        .innerJoin('collection', 'c', 'q."collectionId" = c.id')
        .innerJoin('country', 'co', 'q."countryId" = co.id')
        .innerJoin('model', 'm', 'q."modelId" = m.id')
        .innerJoin('product', 'p', 'o."productId" = p.id')
        .innerJoin('filial', 'f', 'p."filialId" = f.id')
        .where(where.join(' AND '))
        .setParameters({
          filialId,
          country,
          factory,
          collectionId,
          model,
          startDate,
          endDate,
        })
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    // === Return formatted data ===
    return {
      items: rows.map((r) => ({
        ...r.size,
        totalCount: +(Number(r.totalCount).toFixed(2)),
        totalKv: +(Number(r.totalKv).toFixed(2)),
        totalKvPrice: +(Number(r.totalPrice).toFixed(2)),
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
          totalCount: +(Number(totals?.totalCount || 0).toFixed(2)),
          totalKv: +(Number(totals?.totalKv || 0).toFixed(2)),
          totalPrice: +(Number(totals?.totalPrice || 0).toFixed(2)),
          totalNetProfitPrice: +(Number(totals?.totalNetProfitPrice || 0).toFixed(2)),
        },
      },
    };
  }
}
