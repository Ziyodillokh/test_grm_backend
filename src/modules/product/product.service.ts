import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CollectionPriceEnum, FilialTypeEnum } from '../../infra/shared/enum';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  private applyProductFilters(
    qb: any,
    query: QueryProductDto,
  ) {
    if (query.is_deleted !== undefined) {
      qb.andWhere('product.is_deleted = :isDeleted', { isDeleted: query.is_deleted === 'true' });
    } else {
      qb.andWhere('product.is_deleted = false');
    }

    // Faqat filial, warehouse va market tipidagi filiallar ko'rinadi (dealer yo'q)
    qb.andWhere('filial.type IN (:...filialTypes)', {
      filialTypes: [FilialTypeEnum.FILIAL, FilialTypeEnum.WAREHOUSE, FilialTypeEnum.MARKET],
    });
    qb.andWhere('product.deletedDate IS NULL');

    if (query.filialId) {
      qb.andWhere('filial.id = :filialId', { filialId: query.filialId });
    } else if (query.filial) {
      qb.andWhere('filial.id = :filialId', { filialId: query.filial });
    }

    if (query.search) {
      const words = query.search.trim().split(/\s+/);
      words.forEach((word, i) => {
        const param = `search${i}`;
        qb.andWhere(
          `(product.code ILIKE :${param} OR bar_code.code ILIKE :${param} OR model.title ILIKE :${param} OR collection.title ILIKE :${param} OR color.title ILIKE :${param} OR CONCAT(ROUND(size.x * 100), 'x', ROUND(size.y * 100)) ILIKE :${param})`,
          { [param]: `%${word}%` },
        );
      });
    }
  }

  async findAll(
    options: IPaginationOptions,
    query: QueryProductDto,
  ) {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.filial', 'filial')
      .innerJoinAndSelect('product.bar_code', 'bar_code')
      .innerJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('model.collection', 'modelCollection')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('collection.collection_prices', 'collection_prices')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.imgUrl', 'imgUrl')
      .orderBy('product.date', 'DESC');

    this.applyProductFilters(qb, query);

    const paginatedResult = await paginate<Product>(qb, options);

    // Totals — bir xil filterlar bilan
    const totalsQb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.filial', 'filial')
      .innerJoin('product.bar_code', 'bar_code')
      .innerJoin('bar_code.size', 'size')
      .leftJoin('bar_code.color', 'color')
      .leftJoin('bar_code.model', 'model')
      .leftJoin('bar_code.collection', 'collection')
      .select('SUM(product.count)', 'count')
      .addSelect(
        `SUM(CASE WHEN bar_code."isMetric" = true THEN product.y * size.x ELSE product.count * size.x * size.y END)`,
        'kv',
      )
      .addSelect(
        `SUM((CASE WHEN bar_code."isMetric" = true THEN product.y * size.x ELSE product.count * size.x * size.y END) * product."priceMeter")`,
        'totalSum',
      );

    this.applyProductFilters(totalsQb, query);

    const totals = await totalsQb.getRawOne();

    // Search bo'lganda — qaysi filiallarda natija borligini ham qaytarish
    let filials: { id: string; title: string; count: number }[] = [];
    if (query.search) {
      filials = await this.searchFilials(query.search);
    }

    return {
      ...paginatedResult,
      totals: {
        count: Number(totals?.count || 0),
        kv: Number(totals?.kv || 0),
        totalSum: Number(totals?.totalSum || 0),
      },
      searchFilials: filials,
    };
  }

  async searchFilials(search: string): Promise<{ id: string; title: string; count: number }[]> {
    if (!search) return [];
    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.filial', 'filial')
      .innerJoin('product.bar_code', 'bar_code')
      .innerJoin('bar_code.size', 'size')
      .leftJoin('bar_code.model', 'model')
      .leftJoin('bar_code.collection', 'collection')
      .leftJoin('bar_code.color', 'color')
      .select('filial.id', 'id')
      .addSelect('filial.title', 'title')
      .addSelect('COUNT(product.id)', 'count')
      .where('product.is_deleted = false')
      .andWhere('product.deletedDate IS NULL')
      .andWhere('filial.type IN (:...filialTypes)', {
        filialTypes: [FilialTypeEnum.FILIAL, FilialTypeEnum.WAREHOUSE, FilialTypeEnum.MARKET],
      });

    const words = search.trim().split(/\s+/);
    words.forEach((word, i) => {
      const param = `search${i}`;
      qb.andWhere(
        `(product.code ILIKE :${param} OR bar_code.code ILIKE :${param} OR model.title ILIKE :${param} OR collection.title ILIKE :${param} OR color.title ILIKE :${param} OR CONCAT(ROUND(size.x * 100), 'x', ROUND(size.y * 100)) ILIKE :${param})`,
        { [param]: `%${word}%` },
      );
    });

    const results = await qb
      .groupBy('filial.id')
      .addGroupBy('filial.title')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      count: Number(r.count),
    }));
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: {
        bar_code: {
          size: true,
          collection: { collection_prices: true },
        },
        filial: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return product;
  }

  async findByCode(code: string): Promise<Product | null> {
    return this.productRepository.findOne({ where: { code } });
  }

  async create(dto: CreateProductDto | CreateProductDto[], _isTransfer?: boolean): Promise<Product | Product[]> {
    if (Array.isArray(dto)) {
      const products = this.productRepository.create(dto as unknown as Product[]);
      return this.productRepository.save(products);
    }
    const product = this.productRepository.create(dto as unknown as Product);
    return this.productRepository.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.is_deleted = true;
    await this.productRepository.save(product);
    // Also set deletedDate via TypeORM soft-delete for consistency with BaseEntity
    await this.productRepository.softDelete(id);
  }

  async hardRemove(id: string): Promise<void> {
    const result = await this.productRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
  }

  async updateCount(id: string, count: number): Promise<Product> {
    const product = await this.findOne(id);
    product.count = count;
    return this.productRepository.save(product);
  }

  // -----------------------------------------------------------------------
  // Backward-compatible method aliases (old names used by legacy modules)
  // -----------------------------------------------------------------------

  /** @deprecated use findOne */
  async getOne(id: string): Promise<Product> {
    return this.findOne(id);
  }

  /** Change booking count on a product */
  async changeBookCount(data: { id: string; booking_count: number }): Promise<void> {
    await this.productRepository.update(data.id, { booking_count: data.booking_count });
  }

  /** Get remaining products for all filials (accounting) */
  async getRemainingProductsForAllFilial(query: any): Promise<any> {
    return this.productRepository.find({
      where: { is_deleted: false },
      relations: { bar_code: true, filial: true, collection_price: true },
    });
  }

  /**
   * @deprecated Buggy (WHERE clause does not work with relation path). Use
   * {@link propagateCollectionPrice} instead.
   */
  async updateProdByCollection(collectionId: string, data: Partial<Product>): Promise<void> {
    await this.productRepository
      .createQueryBuilder()
      .update(Product)
      .set(data as any)
      .where('bar_code.collection = :collectionId', { collectionId })
      .execute()
      .catch(() => {});
  }

  /**
   * Propagate a new/updated CollectionPrice to existing products (BUG C).
   *
   * Business rule: A collection's `priceMeter` must be identical across all
   * products of that collection within the filial bucket that matches the
   * CollectionPrice's `type`:
   *   cp.type = 'filial' → filial.type IN (filial, warehouse)
   *   cp.type = 'dealer' → filial.type = dealer
   *   cp.type = 'market' → filial.type = market
   *
   * When a new CollectionPrice row is created we update every matching
   * product's `priceMeter` and `collectionPriceId` (FK to the latest row).
   * `comingPrice` is NOT propagated here — that is partiya-specific.
   */
  async propagateCollectionPrice(
    collectionId: string,
    cpType: CollectionPriceEnum,
    priceMeter: number,
    collectionPriceId: string,
  ): Promise<void> {
    if (!collectionId || !collectionPriceId) return;

    const filialTypes: FilialTypeEnum[] =
      cpType === CollectionPriceEnum.filial
        ? [FilialTypeEnum.FILIAL, FilialTypeEnum.WAREHOUSE]
        : cpType === CollectionPriceEnum.dealer
          ? [FilialTypeEnum.DEALER]
          : cpType === CollectionPriceEnum.market
            ? [FilialTypeEnum.MARKET]
            : [];

    if (!filialTypes.length) return;

    await this.productRepository.query(
      `
        UPDATE "product"
        SET    "priceMeter"        = $1,
               "collectionPriceId" = $2
        WHERE  "barCodeId" IN (
                 SELECT "id" FROM "qrbase" WHERE "collectionId" = $3
               )
          AND  "filialId" IN (
                 SELECT "id" FROM "filial" WHERE "type" = ANY($4::text[])
               )
          AND  "is_deleted" = false
      `,
      [priceMeter, collectionPriceId, collectionId, filialTypes],
    );
  }

  /** Get internet product by index (data-sender) */
  async getInternetProductSingle(index: number): Promise<Product | null> {
    const results = await this.productRepository.find({
      where: { isInternetShop: true },
      skip: index,
      take: 1,
      relations: { bar_code: true, filial: true },
    });
    return results[0] || null;
  }

  /** Get product by QrBase and filial */
  async getByQrBase(filialId: string, qrBase: any): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { bar_code: { id: qrBase.id }, filial: { id: filialId } },
      relations: { bar_code: true, filial: true },
    });
  }
}
