import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { DataSource, EntityManager, FindOptionsWhere, ILike, In, MoreThanOrEqual, Repository } from 'typeorm';

import { Collection } from './collection.entity';
import { CreateCollectionDto, UpdateCollectionDto } from './dto';
import { prodSearch } from '../product/utils';
import { User } from '../user/user.entity';
import FilialType from '../../infra/shared/enum/filial-type.enum';
import * as dayjs from 'dayjs';
import { CollectionPrice } from '@modules/collection-price/collection-price.entity';
import { Factory } from '@modules/factory/factory.entity';
import { UserRoleEnum } from '@infra/shared/enum';

@Injectable()

export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Factory)
    private readonly factoryRepository: Repository<Factory>,
    private readonly entityManager: EntityManager,
    private readonly dataSource: DataSource,
  ) {}

  async getAllWithCounts(options: IPaginationOptions, where: { title?: string }) {
    const qb = this.collectionRepository
      .createQueryBuilder('e')
      .leftJoin('factory', 'p', 'p.id = e."factoryId"')
      .leftJoin('qrbase', 'qb', 'qb."collectionId" = e.id AND qb."deletedDate" IS NULL')
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

    const countQb = this.collectionRepository
      .createQueryBuilder('e')
      .leftJoin('factory', 'p', 'p.id = e."factoryId"');
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

  async getAll(options: IPaginationOptions, where?: FindOptionsWhere<Collection>): Promise<Pagination<Collection>> {
    return paginate<Collection>(this.collectionRepository, options, {
      order: {
        title: 'ASC',
      },
      relations: {
        factory: true,
        country: true,
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      },
    });
  }

  async getAllInternetShop(
    options: IPaginationOptions,
    where?: FindOptionsWhere<Collection>,
  ): Promise<Pagination<Collection>> {
    return await paginate<Collection>(this.collectionRepository, options, {
      order: {
        title: 'ASC',
      },
      relations: {
        model: { qrBase: { color: true } },
      },
      where: {
        ...(where && where),
        model: { qrBase: { products: { isInternetShop: true } } },
      },
    });
  }

  async getAllData() {
    return await this.collectionRepository.find({
      order: {
        title: 'ASC',
      },
      relations: {
        model: true,
      },
    });
  }

  async getOne(id: string) {
    return await this.collectionRepository
      .findOne({
        where: { id },
        relations: {
          model: true,
          country: true,
          factory: true,
        },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  // async getOneExcel(id: string) {
  //   return await this.collectionRepository
  //     .findOne({
  //       where: { id },
  //       relations: {
  //         productsExcel: { partiya: true },
  //       },
  //     })
  //     .catch(() => {
  //       throw new NotFoundException('data not found');
  //     });
  // }

  async getOneByName(title: string) {
    return await this.collectionRepository
      .findOne({
        where: { title },
      })
      .catch(() => {
        throw new NotFoundException('collection not found');
      });
  }

  async getByIds(ids: string[]) {
    if (!ids?.length) return [];
    return await this.collectionRepository.find({
      where: { id: In(ids) },
    });
  }

  async deleteOne(id: string) {
    await this.entityManager
      .getRepository('qrbase')
      .createQueryBuilder('qrbase')
      .update()
      .set({ is_active: false })
      .where('collectionId = :id', { id })
      .execute();

    return await this.collectionRepository.delete(id).catch(() => {
      throw new NotFoundException('collection not found');
    });
  }

  async change(value: UpdateCollectionDto, id: string) {
    if (value.factory) {
      const factory = await this.factoryRepository.findOne({
        where: { id: value.factory },
        relations: { country: true },
      });

      if (!factory)
        throw new BadRequestException('Factory topilmadi!');

      value.factory = factory.id;
      value.country = factory?.country?.id || null;
    }
    const data = await this.collectionRepository.update({ id }, value as unknown as Collection);
    if(value.factory){
      await this.collectionRepository.query(`update qrbase set "factoryId" = $1 where "collectionId" = $2`, [value.factory, id])
    }

    return data;
  }

  async create(value: CreateCollectionDto) {
    const factory = await this.factoryRepository.findOne({
      where: { id: value.factory },
      relations: { country: true },
    });
    const data = this.collectionRepository.create({
      title: value.title,
      factory: factory || null,
      country: factory?.country || null,
    });
    return await this.collectionRepository.save(data);
  }

  async remainingProductsByCollection(query: {
    filial?: string;
    collection?: string;
    model?: string;
    country?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const params: any[] = [];
    const where: string[] = [];

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
    const offset = (page - 1) * limit;

    if (query.filial && query.filial !== 'null') {
      where.push(`p."filialId" = $${params.length + 1}`);
      params.push(query.filial);
    }

    if (query.collection && query.collection !== 'null') {
      where.push(`c.id = $${params.length + 1}`);
      params.push(query.collection);
    }

    if (query.model && query.model !== 'null') {
      where.push(`q."modelId" = $${params.length + 1}`);
      params.push(query.model);
    }

    if (query.country && query.country !== 'null') {
      where.push(`q."countryId" = $${params.length + 1}`);
      params.push(query.country);
    }

    if (query.search && query.search !== 'null') {
      where.push(`c.title ILIKE '%' || $${params.length + 1} || '%'`);
      params.push(query.search);
    }

    // 📆 Date filtering
    if (query.startDate && query.endDate) {
      where.push(`p.date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(query.startDate, query.endDate);
    } else if (query.startDate) {
      where.push(`p.date >= $${params.length + 1}`);
      params.push(query.startDate);
    } else if (query.endDate) {
      where.push(`p.date <= $${params.length + 1}`);
      params.push(query.endDate);
    }

    // ✅ Active, valid products only
    where.push(`p.count > 0`);
    where.push(`p.y > 0`);
    where.push(`p.is_deleted = false`);

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    console.log('whereSQL ===========>', whereSQL);

    // ✅ Count query for pagination meta
    const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT c.id
      FROM collection c
      LEFT JOIN qrbase q ON q."collectionId" = c.id
      LEFT JOIN size sz ON sz.id = q."sizeId"
      LEFT JOIN product p ON p."barCodeId" = q.id
      ${whereSQL}
      GROUP BY c.id
    ) AS subquery
  `;

    const countResult = await this.collectionRepository.query(countSql, params);
    const totalItems = Number(countResult[0]?.total || 0);

    // ✅ Main paginated data query
    const sql = `
    SELECT
      c.id,
      c.title,
      COALESCE(SUM(p.count), 0)::INTEGER AS "totalCount",
      COALESCE(SUM(p.count * p.y * sz.x), 0)::NUMERIC(20, 2) AS "totalKv",
      jsonb_agg(cp) as "collectionPrices"
    FROM collection c
    LEFT JOIN qrbase q ON q."collectionId" = c.id
    LEFT JOIN size sz ON sz.id = q."sizeId"
    LEFT JOIN product p ON p."barCodeId" = q.id
    LEFT JOIN "collection-price" cp ON c.id = cp."collectionId"
    ${whereSQL}
    GROUP BY c.id, c.title
    ORDER BY c.title
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

    params.push(limit, offset);

    const items = await this.collectionRepository.query(sql, params);

    // ✅ Meta for frontend
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        itemCount: items.length,
        totalItems,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }
  //
  async remainingProductsByFactory(query: {
    filial?: string;
    collection?: string;
    model?: string;
    country?: string;
    year?: string;
    month?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [];
    const where: string[] = [];

    // 🏢 Filial filter
    if (query.filial && query.filial !== 'null') {
      where.push(`p."filialId" = $${params.length + 1}`);
      params.push(query.filial);
    }

    // 🎨 Collection filter
    if (query.collection && query.collection !== 'null') {
      where.push(`c.id = $${params.length + 1}`);
      params.push(query.collection);
    }

    // 🔧 Model filter
    if (query.model && query.model !== 'null') {
      where.push(`q."modelId" = $${params.length + 1}`);
      params.push(query.model);
    }

    // 🌍 Country filter
    if (query.country && query.country !== 'null') {
      where.push(`q."countryId" = $${params.length + 1}`);
      params.push(query.country);
    }

    // 📅 Yil + Oy => yil boshidan shu oyning shu kunigacha
    if (query.year && query.month) {
      const year = Number(query.year);
      const month = Number(query.month);
      const startDate = dayjs(`${year}-01-01`).startOf('day').format('YYYY-MM-DD');

      let endDate: string;
      const today = dayjs();
      if (today.year() === year && today.month() + 1 === month) {
        endDate = today.format('YYYY-MM-DD');
      } else {
        endDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
          .endOf('month')
          .format('YYYY-MM-DD');
      }

      where.push(`p.date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(startDate);
      params.push(endDate);
    }

    // ❗ Qo'lda berilgan startDate / endDate mavjud bo'lsa
    else if (query.startDate && query.endDate) {
      where.push(`p.date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(query.startDate);
      params.push(query.endDate);
    } else if (query.startDate) {
      where.push(`p.date >= $${params.length + 1}`);
      params.push(query.startDate);
    } else if (query.endDate) {
      where.push(`p.date <= $${params.length + 1}`);
      params.push(query.endDate);
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
    WITH factory_collections AS (
      SELECT
        f.id as factory_id,
        f.title as factory_title,
        c.id as collection_id,
        c.title as collection_title,
        -- Har bir collection uchun jami KV
        COALESCE(SUM(p.count * sz.x * p.y), 0)::NUMERIC(20, 2) AS collection_kv,
        -- Collection price meter
        COALESCE(MAX(cp."priceMeter"), 0)::NUMERIC(20, 2) AS price_meter,
        -- Collection uchun jami count
        COALESCE(SUM(p.count), 0)::INTEGER AS collection_count
      FROM factory f
        LEFT JOIN qrbase q ON q."factoryId" = f.id
        LEFT JOIN size sz ON sz.id = q."sizeId"
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN "collection-price" cp ON cp."collectionId" = c.id
        LEFT JOIN product p ON p."barCodeId" = q.id
      ${whereSQL}
      GROUP BY f.id, f.title, c.id, c.title
    ),
    factory_totals AS (
      SELECT
        factory_id,
        factory_title,
        -- Har bir factory jami KV (barcha collectionlar yig'indisi)
        SUM(collection_kv) AS total_kv,
        -- Har bir factory jami price (collection_kv * price_meter)
        SUM(collection_kv * price_meter) AS total_price,
        -- Har bir factory jami count
        SUM(collection_count) AS total_count,
        -- Collection details
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'collection_id', collection_id,
            'collection_title', collection_title,
            'collection_kv', collection_kv,
            'price_meter', price_meter,
            'collection_price', (collection_kv * price_meter),
            'collection_count', collection_count
          )
        ) AS collections
      FROM factory_collections
      WHERE collection_id IS NOT NULL
      GROUP BY factory_id, factory_title
    )
    SELECT
      factory_id as id,
      factory_title as title,
      total_count::INTEGER AS "totalCount",
      total_kv::NUMERIC(20, 2) AS "totalKv",
      total_price::NUMERIC(20, 2) AS "totalPrice",
      collections
    FROM factory_totals
    ORDER BY factory_title;
  `;

    return await this.collectionRepository.query(sql, params);
  }

  async remainingProductsByCollectionTransfer({
    limit = 10,
    page = 1,
    collection,
    filial,
    search,
    _user,
  }): Promise<Pagination<Collection>> {
    if (search) {
      const products =
        (await this.collectionRepository.query(
          prodSearch({
            text: search,
            filialId: filial,
            base: _user?.role && _user?.role > 2,
            offset: (+page - 1) * +limit,
            limit: limit,
            total: false,
            shop: false,
            collection,
          }),
        )) || [];

      const total =
        (await this.collectionRepository.query(
          prodSearch({
            text: search,
            filialId: filial,
            base: _user?.role && _user?.role > 2,
            offset: (+page - 1) * +limit,
            limit: limit,
            total: true,
            shop: false,
            collection,
          }),
        )) || [];

      return {
        items: products,
        meta: {
          totalItems: +total[0].count,
          itemCount: products.length,
          itemsPerPage: +limit,
          totalPages: Math.ceil(+total[0].count / +limit),
          currentPage: +page,
        },
      };
    }

    const where = {
      ...(collection && { id: collection }),
      model: {
        qrBase: {
          products: {
            ...(filial && { filial: { id: filial } }),
            count: MoreThanOrEqual(1),
            y: MoreThanOrEqual(1),
          },
        },
      },
    };

    const data2 = await paginate<Collection>(
      this.collectionRepository,
      { limit, page },
      {
        relations: { model: { qrBase: { products: { filial: true }, color: true, model: { collection: true } } } },
        where,
      },
    );

    let result = [];
    for (let i = 0; i < data2.items.length; i++) {
      let remainingSum = 0,
        remainingSize = 0,
        remainingCount = 0,
        products = [];
      for (let j = 0; j < data2.items[i].model.length; j++) {
        const items = data2.items[i].model[j].qrBase[j].products;
        remainingSum += items.length ? items.map((p) => +p.price * p.count).reduce((a, b) => a + b) : 0;
        remainingSize += items.length ? items.map((p) => +p.totalSize).reduce((a, b) => a + b) : 0;
        remainingCount += items.length ? items.map((p) => p.count).reduce((a, b) => a + b) : 0;
        collection && products.push(...items);
      }
      if (collection) {
        (data2.meta as any).totalItems = products.length;
      }
      collection
        ? products.length && (result = products)
        : result.push({
            remainingCount,
            remainingSize,
            remainingSum,
            title: data2.items[i].title,
            id: data2.items[i].id,
          });
    }

    return {
      items: result,
      meta: data2?.meta,
      links: data2?.links,
    };
  }

  async findOrCreate(title, factoryId) {
    title = title
      .toLowerCase()
      .trim()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const factory = await this.factoryRepository.findOne({
      where: { id: factoryId },
      relations: { country: true },
    });

    const response = await this.collectionRepository.findOne({
      where: { title, ...(factory && { factory: { id: factoryId } }) },
    });

    if (!response) {
      const res = await this.create({ title });
      return res.id;
    }
    return response.id;
  }

  async findAndReturnId(title) {
    const response = await this.collectionRepository.findOne({
      where: { title },
    });

    return response?.id || null;
  }

  async remainingCollections(
    options: IPaginationOptions,
    user: User,
    country: string,
    filial?: string,
    year?: number,
    month?: number,
    search?: string,
  ) {
    const isDealer =
      user?.filial?.type === FilialType.DEALER || [UserRoleEnum.D_MANAGER, UserRoleEnum.DEALER].includes(user.position.role);

    const type = isDealer ? 'dealer' : user.position.role === UserRoleEnum.I_MANAGER ? 'market' : 'filial';
    const dealerId = user.filial?.id;

    const page = +options.page || 1;
    const limit = +options.limit || 10;
    const offset = (page - 1) * limit;

    // 📆 Sana filtrlari
    let start: Date | undefined;
    let end: Date | undefined;

    if (year && month) {
      start = dayjs(`${year}-01-01`).startOf('day').toDate();

      const today = dayjs();
      end =
        today.year() === year && today.month() + 1 === month
          ? today.endOf('day').toDate()
          : dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
              .endOf('month')
              .toDate();
    }

    const idQuery = this.collectionRepository
      .createQueryBuilder('collection')
      .innerJoin('collection.qrBase', 'qb')
      .innerJoin('qb.products', 'p')
      .innerJoin('qb.size', 's')
      .leftJoin('qb.country', 'cr')
      .leftJoin('collection.collection_prices', 'cp', 'cp."type" = :type', { type })
      .select('collection.id', 'id')
      .where('p.count > 0 AND p.y > 0')
      .groupBy('collection.id')
      .having('SUM(s.x * p.y * p.count) > 0');

    if (country) {
      idQuery.andWhere('cr.id = :countryId', { countryId: country });
    }

    if (start && end) {
      idQuery.andWhere('p.date BETWEEN :start AND :end', { start, end });
    }

    if (filial) {
      idQuery.andWhere('p."filialId" = :filialId', { filialId: filial });
    }

    if (search) {
      idQuery.andWhere('collection.title ILIKE :search', { search: `%${search}%` });
    }

    if (isDealer && dealerId) {
      idQuery.andWhere('cp."dealerId" = :dealerId', { dealerId });
    }

    const ids = await idQuery.orderBy('collection.title', 'ASC').offset(offset).limit(limit).getRawMany();

    const total = await idQuery.clone().getCount();

    const idList = ids.map((row) => row.id);
    if (!idList.length) {
      return {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: limit,
          totalPages: 0,
          currentPage: page,
        },
      };
    }

    const items = await this.collectionRepository
      .createQueryBuilder('collection')
      .innerJoin('collection.qrBase', 'qb')
      .innerJoin('qb.products', 'p')
      .innerJoin('qb.size', 's')
      .leftJoin('collection.collection_prices', 'cp', 'cp."type" = :type', { type })
      .select([
        'collection.id AS id',
        'collection.title AS title',
        `ROUND(SUM(COALESCE(s.x, 0) * COALESCE(p.y, 0) * COALESCE(p.count, 0)), 2) AS "totalKv"`,
        `SUM(COALESCE(p.count, 0)) AS "totalCount"`,
        `COALESCE(jsonb_agg(DISTINCT cp) FILTER (WHERE cp.id IS NOT NULL), '[]') AS "collection_prices"`,
      ])
      .where('collection.id IN (:...ids)', { ids: idList })
      .groupBy('collection.id')
      .addGroupBy('collection.title')
      .orderBy('collection.title', 'ASC')
      .getRawMany();

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async mergeReferences(oldId: string, newTitle: string) {
    const Repo = this.dataSource.getRepository(Collection);
    const oldCollection = await Repo.findOne({
      where: { id: oldId },
      relations: ['model', 'model.qrBase'],
    });
    if (!oldCollection) throw new Error('Old collection not found');

    const existing = await Repo.findOne({
      where: { title: newTitle },
      relations: ['model', 'model.qrBase'],
    });
    if (!existing) {
      await Repo.update({ id: oldId }, { title: newTitle });
      return { message: 'Collection title updated.' };
    }

    const client = this.dataSource.createQueryRunner();
    await client.connect();
    await client.startTransaction();

    try {
      // 1️⃣ Merge models
      for (const oldModel of oldCollection.model) {
        const duplicate = existing.model.find(
          (m) => m.title.toLowerCase() === oldModel.title.toLowerCase(),
        );

        if (duplicate) {
          // Reassign QR bases/products from oldModel → duplicate
          await client.manager.query(
            `UPDATE "qrbase" SET "modelId" = $1 WHERE "modelId" = $2`,
            [duplicate.id, oldModel.id],
          );

          // ✅ Reassign files from oldModel → duplicate
          await client.manager.query(
            `UPDATE "file" SET "modelId" = $1 WHERE "modelId" = $2`,
            [duplicate.id, oldModel.id],
          );

          // Now safe to delete old model
          await client.manager.delete('model', { id: oldModel.id });
        } else {
          // Just move model under the new collection
          await client.manager.update(
            'model',
            { id: oldModel.id },
            { collection: existing.id },
          );
        }
      }

      if (existing) {
        await client.manager.delete(CollectionPrice, { collection: { id: oldId } });
      }

      // 3️⃣ Reassign other FK references to collection
      const refs = await client.query(`
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.constraint_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
        AND rc.constraint_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'collection'
    `);

      for (const ref of refs) {
        const table = ref.table_name;
        const column = ref.column_name;
        await client.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
          [existing.id, oldId],
        );
      }

      // 4️⃣ Delete old collection
      await client.manager.delete('collection', oldId);

      await client.commitTransaction();
      return { message: 'Merged collections, models, prices and references successfully.' };
    } catch (err) {
      await client.rollbackTransaction();
      throw err;
    } finally {
      await client.release();
    }
  }

  async updateInfos(id: string, { country, factory }) {
    const data = {
      ...(country && { country }),
      ...(factory && { factory }),
    };
    await this.collectionRepository.update({ id }, data as unknown as Collection);

    return 'Updated';
  }

  async getCollections(page: number = 1, limit: number = 10, filial?: string, factory?: string) {
    const skip = (page - 1) * limit;

    const baseQuery = this.collectionRepository
      .createQueryBuilder('c')
      .leftJoin('c.qrBase', 'q')
      .leftJoin('q.size', 'sz')
      .leftJoin('q.products', 'p')
      .leftJoin('c.collection_prices', 'cp')
      .leftJoin('p.orders', 'o')
      .where(`p.filialId ${filial ? '= :filial' : 'IS NOT NULL'}`, { filial })
      .andWhere(`q.factoryId ${factory ? '= :factory' : 'IS NOT NULL'}`, { factory })
      .select('c.id', 'id')
      .addSelect('c.title', 'title')
      .addSelect('COALESCE(SUM(p.count), 0)', 'totalCount')
      .addSelect('COALESCE(SUM(p.count * p.y * sz.x), 0)', 'totalKv')
      .addSelect(
        `(
        COALESCE(SUM(p.count * p.y * sz.x), 0)
        * COALESCE((jsonb_agg(cp) -> 0 ->> 'priceMeter')::NUMERIC, 0)
      )`,
        'totalPrice',
      )
      .addSelect('COALESCE(COUNT(o), 0)', 'totalSellCount')
      .addSelect('COALESCE(SUM(o.kv), 0)', 'totalSellKv')
      .addSelect(
        '(COALESCE(SUM(o.price), 0) + COALESCE(SUM(o."plasticSum"), 0))',
        'totalSellPrice',
      )
      .groupBy('c.id')
      .addGroupBy('c.title')
      .having(`
      COALESCE(SUM(p.count * p.y * sz.x), 0) <> 0
      OR COALESCE(SUM(o.kv), 0) <> 0
      OR COALESCE(SUM(o.price), 0) <> 0
      OR COALESCE(SUM(o."plasticSum"), 0) <> 0
      OR COALESCE(SUM(o."netProfitSum"), 0) <> 0
    `)
      .orderBy('c.title', 'ASC');

    // Wrap as subquery for pagination
    const query = this.collectionRepository
      .createQueryBuilder()
      .select('*')
      .from('(' + baseQuery.getQuery() + ')', 'sub')
      .setParameters(baseQuery.getParameters())
      .offset(skip)
      .limit(limit);

    const [items, total] = await Promise.all([
      query.getRawMany(),
      query.getCount(),
    ]);

    // 🔹 Transform result
    const data = items.map(row => ({
      collection: {
        id: row.id,
        title: row.title,
      },
      totalCount: Number(row.totalCount),
      totalKv: Number(row.totalKv),
      totalPrice: Number(row.totalPrice),
      totalSellCount: Number(row.totalSellCount),
      totalSellKv: Number(row.totalSellKv),
      totalSellPrice: Number(row.totalSellPrice),
    }));

    const totalsQuery = this.collectionRepository
      .createQueryBuilder('c')
      .leftJoin('c.qrBase', 'q')
      .leftJoin('q.size', 'sz')
      .leftJoin('q.products', 'p')
      .leftJoin('c.collection_prices', 'cp')
      .leftJoin('p.orders', 'o')
      .where(`p.filialId ${filial ? '= :filial' : 'IS NOT NULL'}`, { filial })
      .andWhere(`q.factoryId ${factory ? '= :factory' : 'IS NOT NULL'}`, { factory })
      .select('COALESCE(SUM(p.count), 0)', 'totalCount')
      .addSelect('COALESCE(SUM(p.count * p.y * sz.x), 0)', 'totalKv')
      .addSelect(
        `(
        COALESCE(SUM(p.count * p.y * sz.x), 0)
        * COALESCE((jsonb_agg(cp) -> 0 ->> 'priceMeter')::NUMERIC, 0)
      )`,
        'totalPrice',
      )
      .addSelect('COALESCE(COUNT(o), 0)', 'totalSellCount')
      .addSelect('COALESCE(SUM(o.kv), 0)', 'totalSellKv')
      .addSelect(
        '(COALESCE(SUM(o.price), 0) + COALESCE(SUM(o."plasticSum"), 0))',
        'totalSellPrice',
      );

    const totalsResult = await totalsQuery.getRawOne();

    return {
      data,
      meta: {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
      totals: {
        totalCount: Number(totalsResult.totalCount),
        totalKv: Number(totalsResult.totalKv),
        totalPrice: Number(totalsResult.totalPrice),
        totalSellCount: Number(totalsResult.totalSellCount),
        totalSellKv: Number(totalsResult.totalSellKv),
        totalSellPrice: Number(totalsResult.totalSellPrice),
      },
    };
  }

}
