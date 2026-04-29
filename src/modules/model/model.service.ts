import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { DataSource, EntityManager, FindOptionsWhere, ILike, Repository } from 'typeorm';

import { Model } from './model.entity';
import { CreateModelDto, UpdateModelDto } from './dto';
import { Product } from '@modules/product/product.entity';
import { Order } from '@modules/order/order.entity';

@Injectable()
export class ModelService {
  constructor(
    @InjectRepository(Model)
    private readonly modelRepository: Repository<Model>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getAll(options: IPaginationOptions, where?: FindOptionsWhere<Model>): Promise<Pagination<Model>> {
    return paginate<Model>(this.modelRepository, options, {
      order: {
        title: 'ASC',
      },
      relations: {
        collection: true,
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
        ...(where.collection && { collection: where.collection }),
      },
    });
  }

  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.modelRepository
      .createQueryBuilder('e')
      .leftJoin('collection', 'p', 'p.id = e."collectionId"')
      .leftJoin('qrbase', 'qb', 'qb."modelId" = e.id')
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

    const countQb = this.modelRepository
      .createQueryBuilder('e')
      .leftJoin('collection', 'p', 'p.id = e."collectionId"');
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

  async getAllModel() {
    return await this.modelRepository.find({
      order: {
        title: 'ASC',
      },
      relations: {
        collection: true,
      },
    });
  }

  async getOne(id: string) {
    return await this.modelRepository.findOne({
      where: { id },
      relations: { collection: true },
    });
  }

  // async getOneExcel(id: string) {
  //   return await this.modelRepository.findOne({
  //     where: { id },
  //     relations: { productsExcel: { partiya: true } },
  //   });
  // }

  // async productByExcel(id: string, partiyaId) {
  //   const data = await this.modelRepository.findOne({
  //     relations: {
  //       productsExcel: { color: true, style: true, size: true, shape: true, partiya: true },
  //       collection: true,
  //     },
  //     where: { id, productsExcel: { partiya: { id: partiyaId } } },
  //   });
  //
  //   if(!data?.productsExcel){
  //     data.productsExcel = []
  //   }
  //
  //   return data;
  // }

  async getOneByName(title: string) {
    return await this.modelRepository
      .findOne({
        where: { title },
        relations: { collection: true },
      })
      .catch(() => {
        throw new NotFoundException('Model not found');
      });
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase').update().set({ is_active: false })
      .where('modelId = :id', { id }).execute();

    return await this.modelRepository.delete(id).catch(() => {
      throw new NotFoundException('Model not found');
    });
  }

  async change(value: UpdateModelDto, id: string) {
    const data = {
      collection: value.collection,
      title: value.title,
    };
    return await this.modelRepository
      .createQueryBuilder()
      .update()
      .set(data as unknown as Model)
      .where('id = :id', { id })
      .execute();
  }

  async create(value: CreateModelDto) {
    const [model] = await this.modelRepository.find({
      where: {
        collection: {
          id: value.collection,
        },
        title: ILike(`%${value.title}%`),
      },
    });
    if (model)
      throw new BadRequestException('Model already exist!');

    return this.modelRepository
      .createQueryBuilder()
      .insert()
      .into(Model)
      .values(value as unknown as Model)
      .returning('id')
      .execute();
  }

  async findOrCreate(collection: string, title: string) {
    title = title.toUpperCase().trim()
    const response = await this.modelRepository.findOne({
      where: { title: ILike(`%${title}%`), collection: { id: collection } },
      relations: { collection: true },
    });

    if (!response) {
      const value = { title, collection };

      const responsee = this.modelRepository
        .createQueryBuilder()
        .insert()
        .into(Model)
        .values(value as unknown as Model)
        .returning('id')
        .execute();

      return (await responsee).raw[0].id;
    }
    return response.id;
  }

  async findAndReturnId(collection: string, title: string) {
    const response = await this.modelRepository.findOne({
      where: { title, collection: { title: collection } },
      relations: { collection: true },
    });

    return response?.id || null;
  }

  async getModels(
    collectionId?: string,
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    factory?: string,
    country?: string,
    year?: string,
    month?: string, // 👈 added month/year filters
  ) {
    const skip = (page - 1) * limit;

    // === Calculate the last day of the given month/year ===
    let endDate: string | null = null;
    if (year && month) {
      // Example: 2025-02 → last day = 2025-02-28 or 29
      const lastDay = new Date(+year, +month, 0); // month is 1-based in JS Date
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
    if (endDate) baseWhere.push(`p.date <= :endDate`); // 👈 date filter added

    // === Main query ===
    const query = this.productRepo
      .createQueryBuilder('p')
      .select([
        `json_build_object('id', m.id, 'title', m.title) as model`,
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
      .groupBy('m.id')
      .addGroupBy('m.title')
      .orderBy('m.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        country,
        factory,
        collectionId,
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
        .where(baseWhere.join(' AND '))
        .select('COUNT(DISTINCT m.id)', 'total')
        .setParameters({ filialId, country, factory, collectionId, endDate })
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
          endDate,
        })
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    return {
      items: rows.map((r) => ({
        ...r.model,
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

  async getModelsReport(
    collectionId?: string,
    page: number = 1,
    limit: number = 10,
    filialId?: string,
    factory?: string,
    country?: string,
    year?: string,
    month?: string,
  ) {
    const skip = (page - 1) * limit;

    // === Compute date range (start & end of given month/year) ===
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      startDate = new Date(y, m - 1, 1, 0, 0, 0);         // 01.MM.YYYY 00:00:00
      endDate = new Date(y, m, 0, 23, 59, 59, 999);       // last day of month 23:59:59.999
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

    // === Base WHERE conditions ===
    const baseWhere = ['o.status = \'accepted\''];
    if (filialId) baseWhere.push('f.id = :filialId');
    if (country) baseWhere.push('co.id = :country');
    if (factory) baseWhere.push('fa.id = :factory');
    if (collectionId) baseWhere.push('c.id = :collectionId');
    if (startDate && endDate) baseWhere.push('o."date" BETWEEN :startDate AND :endDate');

    // === Main query ===
    const query = this.orderRepo
      .createQueryBuilder('o')
      .select([
        `json_build_object('id', m.id, 'title', m.title) as model`,
        `COALESCE(SUM(o.kv), 0) as "totalKv"`,
        `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
        `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalKvPrice"`,
        `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
      ])
      .innerJoin('o.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin('q.country', 'co')
      .innerJoin('q.factory', 'fa')
      .innerJoin('q.model', 'm')
      .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
      .innerJoin('o.product', 'p')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .groupBy('m.id')
      .addGroupBy('m.title')
      .orderBy('m.title', 'ASC')
      .offset(skip)
      .limit(limit)
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        factory,
        country,
        collectionId,
        startDate,
        endDate,
      });

    // === Execute main + totals + total count in parallel ===
    const [rows, totalResult, totals] = await Promise.all([
      query.getRawMany(),

      // Total rows
      this.orderRepo
        .createQueryBuilder('o')
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.model', 'm')
        .innerJoin('q.collection', 'c')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .innerJoin('q.country', 'co')
        .innerJoin('q.factory', 'fa')
        .where(baseWhere.join(' AND '))
        .select('COUNT(DISTINCT m.id)', 'total')
        .setParameters({ filialId, factory, country, collectionId, startDate, endDate })
        .getRawOne(),

      // Totals
      this.orderRepo
        .createQueryBuilder('o')
        .select([
          `COALESCE(SUM(o.kv), 0) as "totalKv"`,
          `COALESCE(SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE o.x END), 0) as "totalCount"`,
          `COALESCE(SUM(o.price + o."plasticSum"), 0)::NUMERIC(20,2) as "totalKvPrice"`,
          `COALESCE(SUM(o."netProfitSum"), 0)::NUMERIC(20,2) as "totalNetProfitPrice"`,
        ])
        .innerJoin('o.bar_code', 'q')
        .innerJoin('q.size', 's')
        .innerJoin('q.collection', 'c')
        .innerJoin('q.country', 'co')
        .innerJoin('q.factory', 'fa')
        .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
        .innerJoin('o.product', 'p')
        .innerJoin('p.filial', 'f')
        .where(baseWhere.join(' AND '))
        .setParameters({
          ...latestPriceSubQuery.getParameters(),
          filialId,
          factory,
          country,
          collectionId,
          startDate,
          endDate,
        })
        .getRawOne(),
    ]);

    const total = Number(totalResult?.total || 0);

    // === Return structured response ===
    return {
      items: rows.map((r) => ({
        ...r.model,
        totalCount: +(Number(r.totalCount || 0).toFixed(2)),
        totalKv: +(Number(r.totalKv || 0).toFixed(2)),
        totalKvPrice: +(Number(r.totalKvPrice || 0).toFixed(2)),
        totalNetProfitPrice: +(Number(r.totalNetProfitPrice || 0).toFixed(2)),
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
          totalNetProfitPrice: +(Number(totals?.totalNetProfitPrice || 0).toFixed(2)),
          totalSellCount: 0,
          totalSellKv: 0,
          totalSellPrice: 0,
          totalNetProfitSum: 0,
        },
      },
    };
  }
}
