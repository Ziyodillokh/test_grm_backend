import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
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

  async findAll(
    options: IPaginationOptions,
    query: QueryProductDto,
  ): Promise<Pagination<Product>> {
    const where: FindOptionsWhere<Product> = {};

    if (query.is_deleted !== undefined) {
      where.is_deleted = query.is_deleted === 'true';
    } else {
      where.is_deleted = false;
    }

    if (query.search) {
      where.code = ILike(`%${query.search}%`);
    }

    if (query.filialId) {
      where.filial = { id: query.filialId };
    } else if (query.filial) {
      where.filial = { id: query.filial };
    }

    return paginate<Product>(this.productRepository, options, {
      order: { date: 'DESC' },
      where,
      relations: {
        filial: true,
        bar_code: {
          size: true,
          color: true,
          style: true,
          model: { collection: true },
          collection: { collection_prices: true },
        },
      },
    });
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
