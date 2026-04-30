import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { QrBase } from './qr-base.entity';
import { CreateQrBaseDto, UpdateQrBaseDto, QueryQrBaseDto } from './dto';
import UpdateInternetInfo from './dto/internet-info-update.dto';
import { CountryService } from '../country/country.service';
import { CollectionService } from '../collection/collection.service';
import { ColorService } from '../color/color.service';
import { ShapeService } from '../shape/shape.service';
import { SizeService } from '../size/size.service';
import { StyleService } from '../style/style.service';
import { ModelService } from '../model/model.service';
import { FactoryService } from '../factory/factory.service';

const BASE_RELATIONS = {
  collection: true,
  color: true,
  model: true,
  size: true,
  shape: true,
  style: true,
  country: true,
  factory: true,
} as const;

const MEDIA_RELATIONS = {
  imgUrl: true,
  videoUrl: true,
  other_images: true,
} as const;

@Injectable()
export class QrBaseService {
  private readonly logger = new Logger(QrBaseService.name);

  constructor(
    @InjectRepository(QrBase)
    private readonly qrBaseRepository: Repository<QrBase>,
    private readonly dataSource: DataSource,
    private readonly countryService: CountryService,
    private readonly collectionService: CollectionService,
    private readonly colorService: ColorService,
    private readonly shapeService: ShapeService,
    private readonly sizeService: SizeService,
    private readonly styleService: StyleService,
    private readonly modelService: ModelService,
    private readonly factoryService: FactoryService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * QrBase list query builder — JOIN va search filtrlari bilan.
   * findAll va findAllIMarket ikkalasi shu helperdan foydalanadi.
   */
  private buildListQuery(query: QueryQrBaseDto, includeMedia: boolean): SelectQueryBuilder<QrBase> {
    const qb = this.qrBaseRepository
      .createQueryBuilder('qb')
      .leftJoinAndSelect('qb.collection', 'collection')
      .leftJoinAndSelect('qb.color', 'color')
      .leftJoinAndSelect('qb.model', 'model')
      .leftJoinAndSelect('qb.size', 'size')
      .leftJoinAndSelect('qb.shape', 'shape')
      .leftJoinAndSelect('qb.style', 'style')
      .leftJoinAndSelect('qb.country', 'country')
      .leftJoinAndSelect('qb.factory', 'factory')
      .orderBy('qb.date', 'DESC');

    if (includeMedia) {
      qb.leftJoinAndSelect('qb.imgUrl', 'imgUrl')
        .leftJoinAndSelect('qb.videoUrl', 'videoUrl')
        .leftJoinAndSelect('qb.other_images', 'other_images');
    }

    if (query.status) {
      qb.andWhere('qb.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        `(
          qb.code ILIKE :s
          OR collection.title ILIKE :s
          OR model.title ILIKE :s
          OR color.title ILIKE :s
          OR size.title ILIKE :s
          OR shape.title ILIKE :s
          OR style.title ILIKE :s
          OR country.title ILIKE :s
          OR factory.title ILIKE :s
        )`,
        { s: `%${query.search}%` },
      );
    }

    return qb;
  }

  /**
   * UpdateInternetInfo dto'dagi UUID stringlarni TypeORM relation objectlariga aylantirish.
   */
  private mapRelationIds(dto: UpdateInternetInfo, isUpdate: boolean): Record<string, any> {
    const result: Record<string, any> = { ...dto };
    const relationKeys = [
      'imgUrl',
      'videoUrl',
      'collection',
      'color',
      'model',
      'size',
      'shape',
      'style',
      'country',
      'factory',
    ] as const;
    for (const key of relationKeys) {
      const value = (dto as any)[key];
      if (isUpdate) {
        if (value !== undefined) {
          result[key] = value ? { id: value } : null;
        }
      } else {
        result[key] = value ? { id: value } : undefined;
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findAll(
    options: IPaginationOptions,
    query: QueryQrBaseDto,
  ): Promise<Pagination<QrBase>> {
    return paginate<QrBase>(this.buildListQuery(query, false), options);
  }

  /**
   * GET /qr-base/i-market — list QrBase with full media relations for internet shop.
   * findAll bilan bir xil filtrlar; faqat media relationlar qo'shimcha yuklanadi.
   */
  async findAllIMarket(
    options: IPaginationOptions,
    query: QueryQrBaseDto,
  ): Promise<Pagination<QrBase>> {
    return paginate<QrBase>(this.buildListQuery(query, true), options);
  }

  async findOne(id: string, opts: { includeMedia?: boolean } = {}): Promise<QrBase> {
    const relations = opts.includeMedia
      ? { ...BASE_RELATIONS, ...MEDIA_RELATIONS }
      : { ...BASE_RELATIONS };
    const entity = await this.qrBaseRepository.findOne({
      where: { id },
      relations,
    });
    if (!entity) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
    return entity;
  }

  async findByCode(
    code: string,
    opts: { includeRelations?: boolean } = {},
  ): Promise<QrBase | null> {
    return this.qrBaseRepository.findOne({
      where: { code },
      relations: opts.includeRelations ? { ...BASE_RELATIONS } : undefined,
    });
  }

  /** @deprecated use findByCode(code, { includeRelations: true }) */
  async getOneByCode(code: string): Promise<QrBase | null> {
    return this.findByCode(code, { includeRelations: true });
  }

  /** @deprecated use findByCode(code) */
  async getOneCode(code: string): Promise<QrBase | null> {
    return this.findByCode(code);
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(dto: CreateQrBaseDto): Promise<QrBase> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      throw new BadRequestException(`QrBase with code "${dto.code}" already exists`);
    }

    const entity = this.qrBaseRepository.create(dto as unknown as QrBase);
    return this.qrBaseRepository.save(entity);
  }

  async update(id: string, dto: UpdateQrBaseDto): Promise<QrBase> {
    const entity = await this.findOne(id);
    const oldSizeId = entity.size?.id;
    Object.assign(entity, dto);
    const saved = await this.qrBaseRepository.save(entity);
    const newSizeId = saved.size?.id;
    if (oldSizeId !== newSizeId) {
      await this.recomputeProductSizes([id]);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const result = await this.qrBaseRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
  }

  async restore(id: string): Promise<void> {
    const result = await this.qrBaseRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
  }

  // ---------------------------------------------------------------------------
  // Internet Shop
  // ---------------------------------------------------------------------------

  async createInternetShop(dto: UpdateInternetInfo): Promise<QrBase> {
    const entity = this.qrBaseRepository.create(this.mapRelationIds(dto, false) as any);
    const saved = await this.qrBaseRepository.save(entity as unknown as QrBase);
    return this.findOne(saved.id, { includeMedia: true });
  }

  async updateInternetShop(id: string, dto: UpdateInternetInfo): Promise<QrBase> {
    const entity = await this.findOne(id);
    const oldSizeId = entity.size?.id;
    Object.assign(entity, this.mapRelationIds(dto, true));
    await this.qrBaseRepository.save(entity);
    const newSizeId = (entity as any).size?.id;
    if (oldSizeId !== newSizeId) {
      await this.recomputeProductSizes([id]);
    }
    return this.findOne(id, { includeMedia: true });
  }

  // ---------------------------------------------------------------------------
  // Cascade — Product.totalSize recompute
  // ---------------------------------------------------------------------------

  /**
   * Berilgan qrbase'larga bog'liq Product.totalSize qiymatlarini yangi size bo'yicha qayta hisoblaydi.
   *
   * Formula:
   *  - Metric: totalSize = (product.y * size.x) / 100      (product.y — santimetrlardagi sotilgan uzunlik)
   *  - Non-metric: totalSize = size.x * size.y * product.count
   *
   * Shuningdek Product.x va Product.y ham yangi size dan sinxronlash uchun yangilanadi
   * (non-metric uchun product.y = size.y; metric uchun product.y o'zgarmaydi — sotilgan miqdor).
   */
  private async recomputeProductSizes(
    qrbaseIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!qrbaseIds || qrbaseIds.length === 0) return;
    const runner = manager ?? this.dataSource.manager;
    await runner.query(
      `
      UPDATE product p
      SET
        "totalSize" = CASE
          WHEN qb."isMetric" = TRUE THEN (COALESCE(p.y, 0) * COALESCE(s.x, 0)) / 100
          ELSE COALESCE(s.x, 0) * COALESCE(s.y, 0) * COALESCE(p.count, 0)
        END,
        x = COALESCE(s.x, p.x),
        y = CASE WHEN qb."isMetric" = TRUE THEN p.y ELSE COALESCE(s.y, p.y) END
      FROM qrbase qb
      LEFT JOIN size s ON s.id = qb."sizeId"
      WHERE p."barCodeId" = qb.id
        AND qb.id = ANY($1)
      `,
      [qrbaseIds],
    );
  }

  // ---------------------------------------------------------------------------
  // Excel import — bulk upsert + cascade recompute
  // ---------------------------------------------------------------------------

  /**
   * Excel rowlardan unikal lookup titlelarini yig'adi.
   */
  private collectLookupTitles(rows: any[]): {
    countries: string[];
    factories: string[];
    collections: string[];
    models: string[];
    colors: string[];
    sizes: string[];
    shapes: string[];
    styles: string[];
  } {
    const norm = (v: any) => (v == null ? '' : String(v).trim());
    const setFor = (key: string) => {
      const out = new Set<string>();
      for (const r of rows) {
        const v = norm(r[key]);
        if (v) out.add(v);
      }
      return Array.from(out);
    };
    return {
      countries: setFor('country'),
      factories: setFor('factory'),
      collections: setFor('collection'),
      models: setFor('model'),
      colors: setFor('color'),
      sizes: setFor('size'),
      shapes: setFor('shape'),
      styles: setFor('style'),
    };
  }

  /**
   * Berilgan jadvaldan title bo'yicha (case-insensitive) bulk SELECT.
   * Map<lowercased title, id> qaytaradi.
   */
  private async bulkSelectByTitle(
    table: string,
    titles: string[],
    manager: EntityManager,
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (titles.length === 0) return out;
    const rows: { id: string; title: string }[] = await manager.query(
      `SELECT id, title FROM ${table} WHERE LOWER(title) = ANY($1)`,
      [titles.map((t) => t.toLowerCase())],
    );
    for (const r of rows) out.set(r.title.toLowerCase(), r.id);
    return out;
  }

  /**
   * Bulk create QR bases from Excel rows.
   * Excel = source of truth: bir xil code uchun mavjud yozuv to'liq update qilinadi.
   *
   * Optimizatsiyalar:
   *  - Lookup tablelar bulk SELECT (8 query, oldin har row uchun ketma-ket).
   *  - Mavjud qrbase'lar bitta SELECT bilan topiladi.
   *  - Hammasi bitta transaction ichida.
   *  - Size o'zgargan qrbase'larga bog'liq Product.totalSize bulk recompute qilinadi.
   *
   * Each row: { code, collection, model, color, size, country, factory, shape, style, isMetric }
   */
  async createFromExcelRows(
    rows: any[],
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; code?: string; message: string }[];
  }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; code?: string; message: string }[] = [];

    return this.dataSource.transaction(async (manager) => {
      // 1) Lookup tablelarni bulk yuklash (8 query)
      const titles = this.collectLookupTitles(rows);
      const [countriesMap, factoriesMap, collectionsMap, modelsMap, colorsMap, sizesMap, shapesMap, stylesMap] =
        await Promise.all([
          this.bulkSelectByTitle('country', titles.countries, manager),
          this.bulkSelectByTitle('factory', titles.factories, manager),
          this.bulkSelectByTitle('collection', titles.collections, manager),
          this.bulkSelectByTitle('model', titles.models, manager),
          this.bulkSelectByTitle('color', titles.colors, manager),
          this.bulkSelectByTitle('size', titles.sizes, manager),
          this.bulkSelectByTitle('shape', titles.shapes, manager),
          this.bulkSelectByTitle('style', titles.styles, manager),
        ]);

      // 2) Mavjud qrbase'larni topish (oldSizeId saqlash uchun)
      const codes = rows
        .map((r) => (r.code ? String(r.code).trim() : ''))
        .filter((c) => c.length > 0);
      const existingQrBases = codes.length
        ? await manager.query(
            `SELECT id, code, "sizeId" FROM qrbase WHERE code = ANY($1)`,
            [codes],
          )
        : [];
      const existingByCode = new Map<string, { id: string; sizeId: string | null }>();
      for (const q of existingQrBases) {
        existingByCode.set(q.code, { id: q.id, sizeId: q.sizeId });
      }

      const sizeChangedQrbaseIds: string[] = [];

      // 3) Per-row: lookup id'larni Map'dan olish, yo'qsa findOrCreate fallback
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        if (!row.code) {
          skipped++;
          continue;
        }

        const code = String(row.code).trim();

        try {
          const lookup = async (
            value: any,
            map: Map<string, string>,
            fallback: () => Promise<string>,
          ): Promise<string | null> => {
            if (value == null || String(value).trim() === '') return null;
            const key = String(value).trim().toLowerCase();
            const cached = map.get(key);
            if (cached) return cached;
            const created = await fallback();
            map.set(key, created);
            return created;
          };

          const countryId = await lookup(row.country, countriesMap, () =>
            this.countryService.findOrCreate(String(row.country)),
          );
          const factoryId = await lookup(row.factory, factoriesMap, () =>
            this.factoryService.findOrCreate(String(row.factory), countryId),
          );
          const collectionId = await lookup(row.collection, collectionsMap, () =>
            this.collectionService.findOrCreate(String(row.collection), factoryId),
          );
          const modelId =
            row.model && collectionId
              ? await lookup(row.model, modelsMap, () =>
                  this.modelService.findOrCreate(collectionId, String(row.model)),
                )
              : null;
          const colorId = await lookup(row.color, colorsMap, () =>
            this.colorService.findOrCreate(String(row.color)),
          );
          const sizeId = await lookup(row.size, sizesMap, () =>
            this.sizeService.findOrCreate(String(row.size)),
          );
          const shapeId = await lookup(row.shape, shapesMap, () =>
            this.shapeService.findOrCreate(String(row.shape)),
          );
          const styleId = await lookup(row.style, stylesMap, () =>
            this.styleService.findOrCreate(String(row.style)),
          );

          const isMetric = row.isMetric === true || row.isMetric === 'true';

          const existing = existingByCode.get(code);

          if (existing) {
            await manager.query(
              `
              UPDATE qrbase SET
                "countryId" = $1,
                "factoryId" = $2,
                "collectionId" = $3,
                "modelId" = $4,
                "colorId" = $5,
                "sizeId" = $6,
                "shapeId" = $7,
                "styleId" = $8,
                "isMetric" = $9
              WHERE id = $10
              `,
              [
                countryId,
                factoryId,
                collectionId,
                modelId,
                colorId,
                sizeId,
                shapeId,
                styleId,
                isMetric,
                existing.id,
              ],
            );
            if ((existing.sizeId ?? null) !== (sizeId ?? null)) {
              sizeChangedQrbaseIds.push(existing.id);
            }
            updated++;
          } else {
            const inserted: { id: string }[] = await manager.query(
              `
              INSERT INTO qrbase
                (code, "countryId", "factoryId", "collectionId", "modelId", "colorId", "sizeId", "shapeId", "styleId", "isMetric")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING id
              `,
              [
                code,
                countryId,
                factoryId,
                collectionId,
                modelId,
                colorId,
                sizeId,
                shapeId,
                styleId,
                isMetric,
              ],
            );
            existingByCode.set(code, { id: inserted[0].id, sizeId });
            created++;
          }
        } catch (err: any) {
          this.logger.error(
            `Excel import — qator ${rowNumber} (code=${code}): ${err?.message || err}`,
          );
          errors.push({
            row: rowNumber,
            code,
            message: err?.message || "Noma'lum xato",
          });
          skipped++;
        }
      }

      // 4) Cascade: size o'zgargan qrbase'larga bog'liq Product.totalSize ni qayta hisoblash
      if (sizeChangedQrbaseIds.length > 0) {
        await this.recomputeProductSizes(sizeChangedQrbaseIds, manager);
      }

      if (created === 0 && updated === 0 && errors.length > 0) {
        const first = errors[0];
        throw new BadRequestException(
          `Excel import muvaffaqiyatsiz: qator ${first.row} (code=${first.code || '—'}) — ${first.message}`,
        );
      }

      return { created, updated, skipped, errors };
    });
  }
}
