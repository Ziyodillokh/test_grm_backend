import { InjectRepository } from '@nestjs/typeorm';
import { ReInventory } from '@modules/re-inventory/re-inventory.entity';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  async processInventory(dto: ProcessInventoryDto, userId?: string) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { code, isMetric, value, filialId } = dto;

      // Filialda faqat OPEN holatdagi filial_report bo'lishi kerak
      const openReport = await queryRunner.manager.findOne(FilialReport, {
        where: {
          filial: { id: filialId },
          status: FilialReportStatusEnum.OPEN,
        },
        relations: { filial: true },
      });
      if (!openReport) {
        throw new BadRequestException(
          'Filialda aktiv (OPEN) qayta ro\'yxat topilmadi — scan qilish mumkin emas',
        );
      }

      // ===============================
      // 1) QRBASE ni lock bilan topish yoki yaratish
      // ===============================
      let barCode = await queryRunner.manager.findOne(QrBase, { where: { code }, relations: { size: true } });

      const [country, collection, size, shape, style, model, color, factory, filial] =
        await Promise.all([
          dto.countryId ? queryRunner.manager.findOne(Country, { where: { id: dto.countryId } }) : null,
          dto.collectionId ? queryRunner.manager.findOne(Collection, { where: { id: dto.collectionId } }) : null,
          dto.sizeId ? queryRunner.manager.findOne(Size, { where: { id: dto.sizeId } }) : null,
          dto.shapeId ? queryRunner.manager.findOne(Shape, { where: { id: dto.shapeId } }) : null,
          dto.styleId ? queryRunner.manager.findOne(Style, { where: { id: dto.styleId } }) : null,
          dto.modelId ? queryRunner.manager.findOne(Model, { where: { id: dto.modelId } }) : null,
          dto.colorId ? queryRunner.manager.findOne(Color, { where: { id: dto.colorId } }) : null,
          dto.factoryId ? queryRunner.manager.findOne(Factory, { where: { id: dto.factoryId } }) : null,
          dto.filialId ? queryRunner.manager.findOne(Filial, { where: { id: dto.filialId } }) : null,
        ]);

      if (!barCode) {
        barCode = queryRunner.manager.create(QrBase, {
          code, isMetric, country, collection, size, shape, style, model, color, factory,
          is_active: true, is_accepted: true,
        });
        await queryRunner.manager.save(barCode);
      } else {
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

      // Metric uzunlik validation
      if (barCode.isMetric && barCode.size && (Number(barCode.size.y) * 100) < Number(value)) {
        throw new BadRequestException('Bu juda katta — shtrixkod uzunligidan oshib ketdi');
      }

      const now = new Date();
      const auditPatch: Partial<ReInventory> = userId
        ? { last_checked_by: { id: userId } as any, last_checked_at: now }
        : { last_checked_at: now };

      // ===========================================
      // 2) METRIC — strict match
      // ===========================================
      if (barCode.isMetric) {
        // Faqat aniq tenglik (y*100 == value) bo'lgan re_inventory rowlar match hisoblanadi
        const matched = await queryRunner.manager
          .createQueryBuilder(ReInventory, 'ri')
          .setLock('pessimistic_write')
          .where('ri."filialReportId" = :rid', { rid: openReport.id })
          .andWhere('ri."barCodeId" = :bcid', { bcid: barCode.id })
          .andWhere('ri.check_count = 0')
          .andWhere('(ri.y * 100) = :val', { val: Number(value) })
          .orderBy('ri.y', 'DESC')
          .getOne();

        if (matched) {
          matched.check_count = Number(value);
          Object.assign(matched, auditPatch);
          await queryRunner.manager.save(matched);
          await queryRunner.commitTransaction();
          return { barCodeId: barCode.id, isMetric: true, updated: [matched.id], created: [] };
        }

        // Tenglik yo'q — yangi re_inventory rowi (Ortiqcha)
        const newRi = queryRunner.manager.create(ReInventory, {
          bar_code: barCode,
          count: 1,
          y: 0,
          check_count: Number(value),
          comingPrice: 0,
          filial_report: openReport,
          ...auditPatch,
        });
        await queryRunner.manager.save(newRi);
        await queryRunner.commitTransaction();
        return { barCodeId: barCode.id, isMetric: true, updated: [], created: [newRi.id] };
      }

      // ===========================================
      // 3) NON-METRIC — fill capacity, then new row
      // ===========================================
      const rows = await queryRunner.manager
        .createQueryBuilder(ReInventory, 'ri')
        .setLock('pessimistic_write')
        .where('ri."filialReportId" = :rid', { rid: openReport.id })
        .andWhere('ri."barCodeId" = :bcid', { bcid: barCode.id })
        .orderBy('ri.count', 'DESC')
        .getMany();

      let amountLeft = Number(value);
      const updated: string[] = [];
      const created: string[] = [];

      for (const ri of rows) {
        if (amountLeft <= 0) break;
        const currentCheck = Number(ri.check_count || 0);
        const cnt = Number(ri.count || 0);
        const capacity = cnt - currentCheck;
        if (capacity <= 0) continue;

        if (amountLeft >= capacity) {
          ri.check_count = currentCheck + capacity;
          amountLeft -= capacity;
        } else {
          ri.check_count = currentCheck + amountLeft;
          amountLeft = 0;
        }
        Object.assign(ri, auditPatch);
        await queryRunner.manager.save(ri);
        updated.push(ri.id);
      }

      if (amountLeft > 0) {
        const sizeY = barCode.size?.y ? Number(barCode.size.y) : 0;
        const newRi = queryRunner.manager.create(ReInventory, {
          bar_code: barCode,
          count: 0,
          y: sizeY,
          check_count: amountLeft,
          comingPrice: 0,
          filial_report: openReport,
          ...auditPatch,
        });
        await queryRunner.manager.save(newRi);
        created.push(newRi.id);
      }

      await queryRunner.commitTransaction();
      return { barCodeId: barCode.id, isMetric: false, updated, created };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Inventory transaction error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Inventory processing failed');
    } finally {
      await queryRunner.release();
    }
  }
    
  async cloneToReInventory(filialReportId: string) {
    // Alias for backwards compatibility
    return this.cloneSnapshotForReport(filialReportId);
  }

  /**
   * Pereuchot ochilganda snapshot olish:
   * - Har bir is_deleted=false product uchun ReInventory rowi yaratiladi
   * - count va y saqlanadi (snapshot), check_count=0 (scan boshlanadi)
   * - Product.check_count ham 0 ga reset qilinadi (yangi pereuchot boshlangani uchun)
   */
  async cloneSnapshotForReport(filialReportId: string) {
    const filialReport = await this.filialReportRepo.findOne({
      where: { id: filialReportId },
      relations: { filial: true },
    });

    if (!filialReport) {
      throw new BadRequestException('Filial Report not found!');
    }

    const filialId = filialReport.filial.id;

    // Active products
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
      return { message: 'No products found to clone.', count: 0 };
    }

    const reInventoryEntities = products.map((product) => {
      return this.reInventoryRepo.create({
        product: product,
        bar_code: product.bar_code,
        count: product.count,
        y: product.y,
        check_count: 0, // snapshot uchun — scan boshida 0
        comingPrice: product.comingPrice,
        filial_report: filialReport,
      });
    });

    await this.reInventoryRepo.save(reInventoryEntities, { chunk: 100 });

    // Active productlarning check_count ni 0 ga reset qilish
    await this.productRepository.update(
      { filial: { id: filialId }, is_deleted: false },
      { check_count: 0 },
    );

    return {
      message: 'Successfully cloned products to re-inventory',
      count: reInventoryEntities.length,
    };
  }


  async getAll({ page, limit }: { page: number, limit: number }, id: string, type: ProductReportEnum, search?: string) {
    const filial_report = await this.filialReportRepo.findOne({ where: { id }, relations: { filial: true } });
    if (!filial_report) throw new NotFoundException('Filial report not found');
    // Har doim re_inventory jadvalidan o'qiymiz (snapshot muzlatilgan)
    return this.getForReportReInventory(id, page, limit, filial_report.filial.id, type, search);
  }

  /**
   * Re_inventory row uchun check_count yangilash (M-manager edit)
   */
  async updateCheckCount(id: string, check_count: number, userId?: string) {
    const ri = await this.reInventoryRepo.findOne({
      where: { id },
      relations: { filial_report: true, bar_code: { size: true } },
    });
    if (!ri) throw new NotFoundException('Re-inventory row not found');
    if (ri.filial_report.status !== FilialReportStatusEnum.OPEN) {
      throw new BadRequestException('Faqat ochiq (OPEN) qayta ro\'yxatdagi rowni tahrirlash mumkin');
    }
    if (check_count < 0) {
      throw new BadRequestException('check_count 0 dan kichik bo\'lishi mumkin emas');
    }
    if (ri.bar_code?.isMetric && ri.bar_code?.size && check_count > Number(ri.bar_code.size.y) * 100) {
      throw new BadRequestException('Shtrixkod uzunligidan oshib ketdi');
    }

    ri.check_count = check_count;
    ri.last_checked_at = new Date();
    if (userId) ri.last_checked_by = { id: userId } as any;
    await this.reInventoryRepo.save(ri);
    return { id: ri.id, check_count: ri.check_count };
  }

  /**
   * Matched row uchun check_count=0 (reset). Ortiqcha (product=null) row — butkul delete.
   */
  async removeItem(id: string, userId?: string) {
    const ri = await this.reInventoryRepo.findOne({
      where: { id },
      relations: { filial_report: true, product: true },
    });
    if (!ri) throw new NotFoundException('Re-inventory row not found');
    if (ri.filial_report.status !== FilialReportStatusEnum.OPEN) {
      throw new BadRequestException('Faqat ochiq (OPEN) qayta ro\'yxatdagi rowni o\'chirish mumkin');
    }

    if (ri.product?.id) {
      // Matched row — check_count=0 ga tushuriladi (snapshot saqlanishi uchun)
      ri.check_count = 0;
      ri.last_checked_at = new Date();
      if (userId) ri.last_checked_by = { id: userId } as any;
      await this.reInventoryRepo.save(ri);
      return { id: ri.id, reset: true };
    }
    // Ortiqcha row — butkul delete
    await this.reInventoryRepo.delete(ri.id);
    return { id: ri.id, deleted: true };
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


  async getAllTotals(id: string, type?: ProductReportEnum, search?: string) {
    const filial_report = await this.filialReportRepo.findOne({ where: { id }, relations: { filial: true } });
    if (!filial_report) throw new NotFoundException('Filial report not found');
    // Har doim re_inventory'dan — snapshot OPEN paytida olinadi
    return this.getReportReInventory(filial_report.id, type, search);
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
      .leftJoinAndSelect('partiya.factory', 'factory')
      .leftJoinAndSelect('partiya.partiya_no', 'partiya_no')
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
      .leftJoinAndSelect('partiya.factory', 'factory')
      .leftJoinAndSelect('partiya.partiya_no', 'partiya_no')
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
  async getReportProduct(id: string, type?: ProductReportEnum, search?: string) {
    const params: any[] = [id];

    // base CTE + select + from/joins are shared — only aggregate expressions & type filter differ
    const priceCte = `
      WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                   cp."priceMeter",
                                                                   cp."comingPrice"
                            FROM "collection-price" cp
                            WHERE cp.type = 'filial'
                            ORDER BY cp."collectionId", cp."date" DESC)
    `;

    const joinSearchTables = search ? `
      LEFT JOIN model m  ON qb."modelId"   = m.id
      LEFT JOIN country cn ON qb."countryId" = cn.id
      LEFT JOIN shape sh  ON qb."shapeId"  = sh.id
      LEFT JOIN style st  ON qb."styleId"  = st.id
      LEFT JOIN color cl  ON qb."colorId"  = cl.id
    ` : '';

    let aggregate = '';
    let extraWhere = '';
    switch (type) {
      case ProductReportEnum.SURPLUS:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN ((check_count::numeric / 100) - pe.y) ELSE "check_count" - "count" END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) - pe.y ELSE ("check_count" - "count") * (s.x * pe.y) END)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND "check_count" > pe."y") OR ("isMetric" = false AND "check_count" > pe."count"))`;
        break;
      case ProductReportEnum.DEFICIT:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN pe.y - check_count ELSE "count" - "check_count" END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN pe.y - (check_count::numeric / 100) ELSE ("count" - "check_count") * (s.x * pe.y) END)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND "check_count" < pe."y") OR ("isMetric" = false AND "check_count" < pe."count"))`;
        break;
      case ProductReportEnum.INVENTORY:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) ELSE "check_count" * pe.y END * s.x * lp."priceMeter")::numeric(20, 2) AS total,
          SUM((CASE WHEN "isMetric" = false then (check_count::numeric * pe.y) else ((check_count::numeric / 100)) END * s.x)::numeric(20, 2))::numeric(20, 2) AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END) AS count
        `;
        extraWhere = `AND check_count > 0`;
        break;
      default:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND 0 < pe."y") OR ("isMetric" = false AND 0 < pe."count"))`;
    }

    let searchClause = '';
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      searchClause = `AND LOWER(CONCAT_WS(' ', c.title, m.title, s.title, cn.title, sh.title, st.title, cl.title, qb.code)) ILIKE $${params.length}`;
    }

    const query = `
      ${priceCte}
      SELECT ${aggregate}
      FROM product pe
        LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
        LEFT JOIN collection c ON qb."collectionId" = c.id
        LEFT JOIN size s ON qb."sizeId" = s.id
        ${joinSearchTables}
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
      WHERE pe.is_deleted = false
        AND pe."filialId" = $1
        ${extraWhere}
        ${searchClause};
    `;

    const result = await this.dataSource.query(query, params);
    return result[0];
  }

  // need get price from collection price..
  async getReportReInventory(id: string, type?: ProductReportEnum, search?: string) {
    const params: any[] = [id];

    const priceCte = `
      WITH latest_price AS (SELECT DISTINCT ON (cp."collectionId") cp."collectionId",
                                                                   cp."priceMeter",
                                                                   cp."comingPrice"
                            FROM "collection-price" cp
                            WHERE cp.type = 'filial'
                            ORDER BY cp."collectionId", cp."date" DESC)
    `;

    const joinSearchTables = search ? `
      LEFT JOIN model m  ON qb."modelId"   = m.id
      LEFT JOIN country cn ON qb."countryId" = cn.id
      LEFT JOIN shape sh  ON qb."shapeId"  = sh.id
      LEFT JOIN style st  ON qb."styleId"  = st.id
      LEFT JOIN color cl  ON qb."colorId"  = cl.id
    ` : '';

    let aggregate = '';
    let extraWhere = '';
    switch (type) {
      case ProductReportEnum.SURPLUS:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN ((check_count::numeric / 100) - pe.y) ELSE "check_count" - "count" END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) - pe.y ELSE ("check_count" - "count") * (s.x * s.y) END)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND "check_count" > pe."y") OR ("isMetric" = false AND "check_count" > pe."count"))`;
        break;
      case ProductReportEnum.DEFICIT:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN pe.y - check_count ELSE "count" - "check_count" END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN pe.y - (check_count::numeric / 100) ELSE ("count" - "check_count") * (s.x * s.y) END)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND "check_count" < pe."y") OR ("isMetric" = false AND "check_count" < pe."count"))`;
        break;
      case ProductReportEnum.INVENTORY:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN (check_count::numeric / 100) ELSE "check_count" * s.y END * s.x * lp."priceMeter")::numeric(20, 2) AS total,
          SUM((CASE WHEN "isMetric" = false then (check_count::numeric * s.y) else ((check_count::numeric / 100)) END * s.x)::numeric(20, 2))::numeric(20, 2) AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END) AS count
        `;
        extraWhere = `AND check_count > 0`;
        break;
      default:
        aggregate = `
          SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x * lp."priceMeter")::numeric AS total,
          SUM(CASE WHEN "isMetric" = true THEN pe.y ELSE count * pe.y END * s.x)::numeric AS volume,
          SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END) AS count
        `;
        extraWhere = `AND (("isMetric" = true AND 0 < pe."y") OR ("isMetric" = false AND 0 < pe."count"))`;
    }

    let searchClause = '';
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      searchClause = `AND LOWER(CONCAT_WS(' ', c.title, m.title, s.title, cn.title, sh.title, st.title, cl.title, qb.code)) ILIKE $${params.length}`;
    }

    const query = `
      ${priceCte}
      SELECT ${aggregate}
      FROM re_inventory pe
        LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
        LEFT JOIN collection c ON qb."collectionId" = c.id
        LEFT JOIN size s ON qb."sizeId" = s.id
        ${joinSearchTables}
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
      WHERE pe."filialReportId" = $1
        ${extraWhere}
        ${searchClause};
    `;

    const result = await this.dataSource.query(query, params);
    return result[0];
  }
}