import { InjectRepository } from '@nestjs/typeorm';
import { ReInventory } from '@modules/re-inventory/re-inventory.entity';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { QrBase } from '@modules/qr-base/qr-base.entity';
import { Product } from '@modules/product/product.entity';
import { Country } from '@modules/country/country.entity';
import { Collection } from '@modules/collection/collection.entity';
import { Size } from '@modules/size/size.entity';
import { Shape } from '@modules/shape/shape.entity';
import { Style } from '@modules/style/style.entity';
import { Model } from '@modules/model/model.entity';
import { Color } from '@modules/color/color.entity';
import { Factory } from '@modules/factory/factory.entity';
import { ProcessInventoryDto } from '@modules/re-inventory/re-inventory.dto';
import { Filial } from '@modules/filial/filial.entity';
import { FilialReport } from '@modules/filial-report/filial-report.entity';
import { FilialReportStatusEnum, ProductReportEnum } from '@infra/shared/enum';


export class ReInventoryService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(ReInventory)
    private readonly reInventoryRepo: Repository<ReInventory>,
    @InjectRepository(FilialReport)
    private readonly filialReportRepo: Repository<FilialReport>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {
  }

  async processInventory(dto: ProcessInventoryDto) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { code, isMetric, value, filialId, id } = dto;

      // ===============================
      // 1) QRBASE ni lock bilan topish yoki yaratish
      // ===============================
      let barCode = await queryRunner.manager.findOne(QrBase, { where: { code }, relations: { size: true } });

      const [country, collection, size, shape, style, model, color, factory, filial] =
        await Promise.all([
          dto.countryId
            ? queryRunner.manager.findOne(Country, {
              where: { id: dto.countryId },
            })
            : null,
          dto.collectionId
            ? queryRunner.manager.findOne(Collection, {
              where: { id: dto.collectionId },
            })
            : null,
          dto.sizeId
            ? queryRunner.manager.findOne(Size, {
              where: { id: dto.sizeId },
            })
            : null,
          dto.shapeId
            ? queryRunner.manager.findOne(Shape, {
              where: { id: dto.shapeId },
            })
            : null,
          dto.styleId
            ? queryRunner.manager.findOne(Style, {
              where: { id: dto.styleId },
            })
            : null,
          dto.modelId
            ? queryRunner.manager.findOne(Model, {
              where: { id: dto.modelId },
            })
            : null,
          dto.colorId
            ? queryRunner.manager.findOne(Color, {
              where: { id: dto.colorId },
            })
            : null,
          dto.factoryId
            ? queryRunner.manager.findOne(Factory, {
              where: { id: dto.factoryId },
            })
            : null,
          dto.filialId
            ? queryRunner.manager.findOne(Filial, {
              where: { id: dto.filialId },
            })
            : null,
        ]);
      if (!barCode) {

        barCode = queryRunner.manager.create(QrBase, {
          code,
          isMetric,
          country,
          collection,
          size,
          shape,
          style,
          model,
          color,
          factory,
          is_active: true,
          is_accepted: true,
        });

        await queryRunner.manager.save(barCode);
      } else {
        // agar barcode allaqachon bor bo'lsa, ixtiyoriy:
        // barcode.isMetric = isMetric; // Agar o'zgartirish kerak bo'lsa, shu yerda qo'yasiz
        await queryRunner.manager.save(QrBase, {
          ...barCode,
          ...(size && { size }),
          ...(shape && { shape }),
          ...(style && { style }),
          ...(model && { model }),
          ...(color && { color }),
          ...(factory && { factory }),
          ...(country && { country }),
          ...(collection && { collection }),
          isMetric,
        });
      }

      if (barCode.isMetric && (barCode.size.y * 100) < dto.value) {
        throw new BadRequestException('Bu juda katta');
      }

      if (id) {
        await queryRunner.manager.update(Product, { id }, { bar_code: barCode, check_count: value });

        await queryRunner.commitTransaction();
        return {
          updated: [id],
        };
      }

      // ===========================================
      // 2) ISMETRIC = TRUE bo'lsa - UZUNLIK LOGIKASI
      // ===========================================
      if (barCode.isMetric) {
        /**
         * Qoidalar:
         *  - mavjud mahsulotni qidirishda:
         *      check_count = 0
         *      (y * 100) > 0
         *      (y * 100) <= value
         *  - mahsulot topilsa:
         *      faqat check_count = value (y va count o'zgarmaydi!)
         *  - mahsulot topilmasa:
         *      yangi product:
         *        count = 1
         *        y = 0
         *        check_count = value
         */

        const freeMetricProduct = await queryRunner.manager
          .createQueryBuilder(Product, 'p')
          .setLock('pessimistic_write')
          .leftJoin('p.bar_code', 'qr')
          .where('qr.id = :qrId', { qrId: barCode.id })
          .andWhere('(p.check_count IS NULL OR p.check_count = 0)')
          .andWhere('p.y IS NOT NULL AND (p.y * 100) > 0')
          .andWhere('(p.y * 100) <= :value', { value })
          .andWhere('p.filialId = :filialId', { filialId })
          .orderBy('p.y', 'DESC') // eng katta uzunlikni birinchi olamiz
          .getOne();

        if (freeMetricProduct) {
          // faqat check_count o'zgaradi
          freeMetricProduct.check_count = value;

          await queryRunner.manager.save(freeMetricProduct);

          await queryRunner.commitTransaction();

          return {
            barCodeId: barCode.id,
            isMetric: true,
            updatedProducts: [freeMetricProduct],
            createdProducts: [],
          };
        }

        // TOPILMAGAN HOLAT – yangi product
        const newMetricProduct = queryRunner.manager.create(Product, {
          bar_code: barCode,
          count: 1,
          y: 0,
          check_count: value,
          booking_count: 0,
          filial: filial,
          partiya_title: filial.name + ' ' + 'остатка',
        });

        await queryRunner.manager.save(newMetricProduct);
        await queryRunner.commitTransaction();

        return {
          barCodeId: barCode.id,
          isMetric: true,
          updatedProducts: [],
          createdProducts: [newMetricProduct],
        };
      }

      // ===========================================
      // 3) ISMETRIC = FALSE bo'lsa - DONA / ODDIY LOGIKA
      // ===========================================
      /**
       * Qoidalar:
       *  - mavjud mahsulotlarda:
       *      y va count tegilmaydi
       *      faqat check_count oshiriladi
       *      capacity = count - check_count
       *      eng katta count-lilar birinchi to'ladi
       *  - agar capacity yetmasa:
       *      yangi product:
       *          y = bar_code.size.y
       *          count = 0
       *          check_count = amountLeft
       */

      const products = await queryRunner.manager
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .leftJoin('p.bar_code', 'qr')
        .where('qr.id = :qrId', { qrId: barCode.id })
        .andWhere('p.filialId = :filialId', { filialId })
        .andWhere('p.is_deleted = false')
        .orderBy('p.count', 'DESC') // katta count-lilar birinchi
        .getMany();

      let amountLeft = value;
      const updatedProducts: Product[] = [];
      const createdProducts: Product[] = [];

      // mavjudlarni to'ldiramiz
      for (const product of products) {
        if (amountLeft <= 0) break;

        const currentCheck = product.check_count || 0;
        const capacity = product.count - currentCheck;
        const is_deficit = product.count === 0 && product.check_count > 0;

        if (capacity <= 0 && !is_deficit) continue;

        if (is_deficit) {
          product.check_count += amountLeft;
          amountLeft = 0;
        } else if (amountLeft >= capacity) {
          product.check_count = currentCheck + capacity;
          amountLeft -= capacity;
        } else {
          product.check_count = currentCheck + amountLeft;
          amountLeft = 0;
        }

        // y va count tegmaymiz!
        await queryRunner.manager.save(product);
        updatedProducts.push(product);
      }

      // agar hamon amountLeft > 0 bo'lsa – yangi product
      if (amountLeft > 0) {
        const sizeY =
          barCode.size && (barCode.size as any).y
            ? Number((barCode.size as any).y)
            : 0;


        const newProduct = queryRunner.manager.create(Product, {
          bar_code: barCode,
          y: sizeY,
          count: 0,
          check_count: amountLeft,
          booking_count: 0,
          filial,
        });

        await queryRunner.manager.save(newProduct);
        createdProducts.push(newProduct);
      }

      await queryRunner.commitTransaction();

      return {
        barCodeId: barCode.id,
        isMetric: false,
        updatedProducts,
        createdProducts,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Inventory transaction error:', error);
      throw new BadRequestException('Inventory processing failed');
    } finally {
      await queryRunner.release();
    }
  }
    
  async cloneToReInventory(filialReportId: string) {
    const filialReport = await this.filialReportRepo.findOne({
      where: { id: filialReportId },
      relations: { filial: true },
    });

    if (!filialReport) {
      throw new BadRequestException('Filial Report not found!');
    }

    const filialId = filialReport.filial.id;

    // Fetch all active products for the filial
    const products = await this.productRepository.find({
      where: {
        filial: { id: filialId },
        is_deleted: false,
      },
      relations: {
        bar_code: true,
      },
    });

    if (!products.length) {
      return { message: 'No products found to clone.' };
    }

    // Prepare ReInventory entities
    const reInventoryEntities = products.map((product) => {
      return this.reInventoryRepo.create({
        product: product,
        bar_code: product.bar_code,
        count: product.count,
        y: product.y,
        check_count: product.check_count, 
        comingPrice: product.comingPrice,
        filial_report: filialReport,
      });
    });

    // Save in chunks to avoid memory issues if there are many products
    await this.reInventoryRepo.save(reInventoryEntities, { chunk: 100 });

    return {
      message: 'Successfully cloned products to re-inventory',
      count: reInventoryEntities.length,
    };
  }


  async getAll({ page, limit }: { page: number, limit: number }, id: string, type: ProductReportEnum, search?: string) {
    const filial_report = await this.filialReportRepo.findOne({ where: { id }, relations: { filial: true } });

    if ([FilialReportStatusEnum.OPEN, FilialReportStatusEnum.ACCEPTED, FilialReportStatusEnum.REJECTED].includes(filial_report.status)) {
      console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      return this.getForReport(page, limit, filial_report.filial.id, type, search);
    } else {
      console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2222222222222222");
      return this.getForReportReInventory(id, page, limit, filial_report.filial.id, type, search);
    }
  }

  async getForReportGroupedByCollection(
    page: number,
    limit: number,
    filialId: string,
    type?: ProductReportEnum,
    search?: string,
  ) {
    if (!filialId) {
      throw new BadRequestException('Filial id must exist!');
    }

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.bar_code', 'bar_code')
      .leftJoin('bar_code.collection', 'collection')
      .leftJoin('bar_code.size', 'size')
      .where('product.filialId = :filialId', { filialId })
      .andWhere('product.is_deleted = false');

    // 🔹 Report type filters
    if (type === ProductReportEnum.SURPLUS) {
      query.andWhere(`
      CASE 
        WHEN bar_code.isMetric THEN (product.y * 100) < product.check_count
        ELSE product.count < product.check_count
      END
    `);
    } else if (type === ProductReportEnum.DEFICIT) {
      query.andWhere(`
      CASE 
        WHEN bar_code.isMetric THEN (product.y * 100) > product.check_count
        ELSE product.count > product.check_count
      END
    `);
    } else if (type === ProductReportEnum.INVENTORY) {
      query.andWhere('product.check_count > 0');
    } else {
      query.andWhere('product.count > 0 OR product.y > 0');
    }

    // 🔹 Search (optional)
    if (search) {
      query.andWhere(
        `LOWER(collection.title) ILIKE '%' || LOWER(:search) || '%'`,
        { search },
      );
    }

    // 🔹 Aggregation
    query
      .select([
        'collection.id AS "collectionId"',
        'collection.title AS "collectionTitle"',
        'SUM(product.count) AS "totalCount"',
        'SUM(product.y) AS "totalKv"',
      ])
      .groupBy('collection.id')
      .addGroupBy('collection.title')
      .orderBy('collection.title', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const items = await query.getRawMany();

    // 🔹 Count total groups
    const total = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.bar_code', 'bar_code')
      .leftJoin('bar_code.collection', 'collection')
      .where('product.filialId = :filialId', { filialId })
      .andWhere('product.is_deleted = false')
      .select('COUNT(DISTINCT collection.id)', 'count')
      .getRawOne();

    return {
      items,
      meta: {
        itemCount: Number(total.count),
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total.count / limit),
      },
    };
  }


  async getAllTotals(id: string, type?: ProductReportEnum) {
    const filial_report = await this.filialReportRepo.findOne({ where: { id }, relations: { filial: true } });

    if ([FilialReportStatusEnum.OPEN, FilialReportStatusEnum.ACCEPTED, FilialReportStatusEnum.REJECTED].includes(filial_report.status)) {
      return this.getReportProduct(filial_report.filial.id, type);
    }
    // **if end** //
    else  {
      return this.getReportReInventory(filial_report.id, type);
    }
  }

  // Utils for get inventories
  async getForReport(page: number, limit: number, filialId: string, type?: ProductReportEnum, search?: string) {
    if (!filialId) {
      throw new BadRequestException('Filial id must be exist!');
    }
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.filial', 'filial')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('product.partiya', 'partiya')
      .where('product.filialId = :filialId', { filialId })
      .andWhere('product.is_deleted = false');

    if (type === ProductReportEnum.SURPLUS) {
      query.andWhere(
        'CASE WHEN bar_code.isMetric THEN (product.y * 100) < product.check_count ELSE product.count < product.check_count END',
      );
    } else if (type === ProductReportEnum.DEFICIT) {
      query.andWhere(
        'CASE WHEN bar_code.isMetric THEN (product.y * 100) > product.check_count ELSE product.count > product.check_count END',
      );
    } else if (type === ProductReportEnum.INVENTORY) {
      query.andWhere('product.check_count > 0');
    } else {
      query.andWhere('product.count > 0');
      query.andWhere('product.y > 0');
    }

    if (search) {
      query.andWhere(
        `
  (SELECT COUNT(*)
   FROM (SELECT DISTINCT LOWER(word) AS word
         FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words
   WHERE CONCAT_WS(' ', collection.title, model.title, size.title, country.title, shape.title, style.title, color.title, bar_code.code) ILIKE
         '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                             FROM (SELECT LOWER(word) AS word
                                                   FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words)
`,
        { text: search },
      );
    }
    query.orderBy('product.updatedAt', 'DESC');

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        itemCount: total,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getForReportReInventory(id: string, page: number, limit: number, filialId: string, type?: ProductReportEnum, search?: string) {
    if (!filialId) {
      throw new BadRequestException('Filial id must be exist!');
    }
    const query = this.reInventoryRepo
      .createQueryBuilder('re_inventory')
      .leftJoinAndSelect('re_inventory.filial_report', 'filial_report')
      .leftJoinAndSelect('filial_report.filial', 'filial')
      .leftJoinAndSelect('re_inventory.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('re_inventory.product', 'product')
      .leftJoinAndSelect('product.partiya', 'partiya')
      .where('filial_report.id = :id', { id });

    if (type === ProductReportEnum.SURPLUS) {
      console.log(type);
      console.log(ProductReportEnum.SURPLUS);
      query.andWhere(
        'CASE WHEN bar_code.isMetric THEN (re_inventory.y * 100) < product.check_count ELSE re_inventory.count < re_inventory.check_count END',
      );
    } else if (type === ProductReportEnum.DEFICIT) {
      console.log(type);
      console.log(ProductReportEnum.DEFICIT);
      query.andWhere(
        'CASE WHEN bar_code.isMetric THEN (re_inventory.y * 100) > re_inventory.check_count ELSE re_inventory.count > re_inventory.check_count END',
      );
    } else if (type === ProductReportEnum.INVENTORY) {
      console.log(type);
      console.log(ProductReportEnum.INVENTORY);
      query.andWhere('re_inventory.check_count > 0');
    } else {
      console.log(type);
      console.log(null);
      query.andWhere('re_inventory.count > 0');
      query.andWhere('re_inventory.y > 0');
    }

    if (search) {
      query.andWhere(
        `
  (SELECT COUNT(*)
   FROM (SELECT DISTINCT LOWER(word) AS word
         FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words
   WHERE CONCAT_WS(' ', collection.title, model.title, size.title, country.title, shape.title, style.title, color.title, bar_code.code) ILIKE
         '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                             FROM (SELECT LOWER(word) AS word
                                                   FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words)
`,
        { text: search },
      );
    }
    query.orderBy('re_inventory.updatedAt', 'DESC');

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        itemCount: total,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  // need get price from collection price..
  async getReportProduct(id: string, type?: ProductReportEnum) {
    const params = [id];
    let query = '';

    switch (type) {
      case ProductReportEnum.SURPLUS:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN ((check_count::numeric / 100) - pe.y) ELSE "check_count" - "count" END * s.x * lp."priceMeter")::numeric AS total,
                   SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) - pe.y ELSE ("check_count" - "count") * (s.x * pe.y) END)::numeric          AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END)                                                    AS count
            FROM product pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe.is_deleted = false
                  AND pe."filialId" = $1
                  AND (("isMetric" = true AND "check_count" > pe."y") OR ("isMetric" = false AND "check_count" > pe."count"));
        `;
        break;

      case ProductReportEnum.DEFICIT:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN pe.y - check_count ELSE "count" - "check_count" END * s.x * lp."priceMeter")::numeric  AS total,
                   SUM(CASE WHEN "isMetric" = true THEN pe.y - (check_count::numeric / 100) ELSE ("count" - "check_count") * (s.x * pe.y) END)::numeric AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END)                                           AS count
            FROM product pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe.is_deleted = false
                  AND pe."filialId" = $1
                  AND (("isMetric" = true AND "check_count" < pe."y") OR ("isMetric" = false AND "check_count" < pe."count"));
        `;
        break;

      case ProductReportEnum.INVENTORY:
        query = `          
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) ELSE "check_count" * pe.y END * s.x * lp."priceMeter")::numeric(20, 2) AS total,
                   SUM((CASE WHEN "isMetric" = false then (check_count::numeric * pe.y) else ((check_count::numeric / 100)) END * s.x)::numeric(20, 2))::numeric(20, 2)          AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END)                                                                           AS count
            FROM product pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe.is_deleted = false AND pe."filialId" = $1 AND check_count > 0;
        `;
        break;

      default:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x * lp."priceMeter")::numeric AS total,
                   SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x)::numeric                   AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" END)                                    AS count
            FROM product pe
                      LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                      LEFT JOIN collection c on qb."collectionId" = c.id
                      LEFT JOIN size s ON qb."sizeId" = s.id
                      LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE  pe.is_deleted = false 
                   AND pe."filialId" = $1 
                   AND (("isMetric" = true AND 0 < pe."y") OR ("isMetric" = false AND 0 < pe."count"));
       `;
    }

    const result = await this.dataSource.query(query, params);
    return result[0];
  }

  // need get price from collection price..
  async getReportReInventory(id: string, type?: ProductReportEnum) {
    const params = [id];
    let query = '';

    switch (type) {
      case ProductReportEnum.SURPLUS:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN ((check_count::numeric / 100) - pe.y) ELSE "check_count" - "count" END * s.x * lp."priceMeter")::numeric AS total,
                   SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) - pe.y ELSE ("check_count" - "count") * (s.x * s.y) END)::numeric          AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END)                                                    AS count
            FROM re_inventory pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe."filialReportId" = $1
                  AND (("isMetric" = true AND "check_count" > pe."y") OR ("isMetric" = false AND "check_count" > pe."count"));
        `;
        break;

      case ProductReportEnum.DEFICIT:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN pe.y - check_count ELSE "count" - "check_count" END * s.x * lp."priceMeter")::numeric  AS total,
                   SUM(CASE WHEN "isMetric" = true THEN pe.y - (check_count::numeric / 100) ELSE ("count" - "check_count") * (s.x * s.y) END)::numeric AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END)                                           AS count
            FROM re_inventory pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe."filialReportId" = $1
                  AND (("isMetric" = true AND "check_count" < pe."y") OR ("isMetric" = false AND "check_count" < pe."count"));
        `;
        break;

      case ProductReportEnum.INVENTORY:
        query = `          
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) ELSE "check_count" * s.y END * s.x * lp."priceMeter")::numeric(20, 2) AS total,
                   SUM((CASE WHEN "isMetric" = false then (check_count::numeric * s.y) else ((check_count::numeric / 100)) END * s.x)::numeric(20, 2))::numeric(20, 2)          AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END)                                                                           AS count
            FROM re_inventory pe
                     LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                     LEFT JOIN collection c on qb."collectionId" = c.id
                     LEFT JOIN size s ON qb."sizeId" = s.id
                     LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE pe."filialReportId" = $1 AND check_count > 0;
        `;
        break;

      default:
        query = `
            WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                         cp."priceMeter",
                                                                         cp."comingPrice"
                                  FROM "collection-price" cp
                                  WHERE cp.type = 'filial'
                                  ORDER BY cp."collectionId", cp."date" DESC)
            SELECT SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x * lp."priceMeter")::numeric AS total,
                   SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x)::numeric                   AS volume,
                   SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END)                                    AS count
            FROM re_inventory pe
                      LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                      LEFT JOIN collection c on qb."collectionId" = c.id
                      LEFT JOIN size s ON qb."sizeId" = s.id
                      LEFT JOIN latest_price lp ON lp."collectionId" = c.id
            WHERE  pe."filialReportId" = $1 
                   AND (("isMetric" = true AND 0 < pe."y") OR ("isMetric" = false AND 0 < pe."count"));
       `;
    }

    const result = await this.dataSource.query(query, params);
    return result[0];
  }
}