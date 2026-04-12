import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IPaginationOptions,
  paginate,
  Pagination,
} from 'nestjs-typeorm-paginate';
import { DataSource, EntityManager, Repository, UpdateResult } from 'typeorm';

import { Transfer } from './transfer.entity';
import { ChangePriceDto, CreateTransferBasketDto, CreateTransferDto, UpdateTransferDto } from './dto';
import { TransferStatus } from '../../common/enums';
import { Product } from '../product/product.entity';
import { applyStockDepletion } from '../product/utils/stock-depletion.util';
import { OrderBasketService } from '../order-basket/order-basket.service';
import { OrderBasket } from '../order-basket/order-basket.entity';
import { User } from '../user/user.entity';
import { PackageTransferService } from '../package-transfer/package-transfer.service';
import { PackageCollectionPrice } from '../package-collection-price/package-collection-price.entity';
import { Filial } from '../filial/filial.entity';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly orderBasketService: OrderBasketService,
    private readonly packageTransferService: PackageTransferService,
  ) {}

  async getAll(
    options: IPaginationOptions,
    where: any = {},
    search?: string,
  ): Promise<Pagination<Transfer>> {
    const qb = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.from', 'from')
      .leftJoinAndSelect('transfer.to', 'to')
      .leftJoinAndSelect('transfer.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('transfer.courier', 'courier')
      .leftJoinAndSelect('transfer.transferer', 'transferer')
      .leftJoinAndSelect('transfer.package', 'package')
      .orderBy('transfer.date', 'DESC');

    if (where.from) {
      qb.andWhere('from.id = :fromId', { fromId: where.from });
    }
    if (where.to) {
      qb.andWhere('to.id = :toId', { toId: where.to });
    }
    if (where.progress) {
      qb.andWhere('transfer.progress = :progress', { progress: where.progress });
    }
    if (search) {
      qb.andWhere(
        '(model.title ILIKE :search OR collection.title ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return paginate<Transfer>(qb, options);
  }

  async getById(id: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: {
        from: true,
        to: true,
        product: { bar_code: { model: true, collection: true, color: true, size: true } },
        courier: true,
        transferer: true,
        cashier: true,
        package: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  /**
   * Create one or more transfers. Unified transfer model (BUG D, E):
   * stock is **deducted from the source filial immediately** and held
   * in-progress. `acceptTransfer` later moves it to the destination;
   * `rejectTransfer` returns it to the source.
   */
  async create(
    data: CreateTransferDto[],
    userId: string,
  ): Promise<Transfer[]> {
    return this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(Transfer);
      const productRepo = manager.getRepository(Product);
      const results: Transfer[] = [];

      for (const dto of data) {
        const product = await productRepo.findOne({
          where: { id: dto.product },
          relations: { bar_code: { size: true } },
        });
        if (!product) {
          throw new NotFoundException(`Product ${dto.product} not found`);
        }

        const isMetric = !!product.bar_code?.isMetric;
        const requestedCount = Number(dto.count) || 0;
        if (requestedCount <= 0) {
          throw new BadRequestException('Transfer count must be positive');
        }

        // Validate availability
        if (isMetric) {
          if (+product.count < requestedCount || +product.y <= 0) {
            throw new BadRequestException(
              `Manba filialda mahsulot yetarli emas: ${product.code || product.id}`,
            );
          }
        } else {
          if (+product.count < requestedCount) {
            throw new BadRequestException(
              `Manba filialda mahsulot yetarli emas: ${product.code || product.id}`,
            );
          }
        }

        // Compute transferred kv
        const sizeKv =
          product.bar_code?.size?.x && product.bar_code?.size?.y
            ? Number(product.bar_code.size.x) * Number(product.bar_code.size.y)
            : 0;
        const transferredY = isMetric ? +product.y : 0; // metric: full roll moves
        const transferredKv = isMetric
          ? Number(product.bar_code?.size?.x || 0) * transferredY
          : sizeKv * requestedCount;

        // Deduct from source
        if (isMetric) {
          product.count = +product.count - requestedCount;
          product.y = 0; // the moving piece takes all the length
        } else {
          product.count = +product.count - requestedCount;
        }
        applyStockDepletion(product, isMetric);
        await productRepo.save(product);

        const transfer = transferRepo.create({
          ...dto,
          transferer: userId,
          progress: TransferStatus.PROGRESS,
          kv: transferredKv,
          comingPrice: +product.comingPrice || 0,
          oldComingPrice: +product.comingPrice || 0,
        } as unknown as Transfer);

        const saved = await transferRepo.save(transfer);
        results.push(saved);
      }

      return results;
    });
  }

  async createFromBasket(dto: CreateTransferBasketDto, user: any): Promise<Transfer[]> {
    // Load full user with filial
    const fullUser = await this.dataSource.getRepository(User).findOne({
      where: { id: user.id || user },
      relations: { filial: true },
    });
    if (!fullUser) {
      throw new BadRequestException('User not found');
    }

    const baskets: OrderBasket[] = await this.orderBasketService.findAllForTransfer(fullUser);
    if (!baskets.length) {
      throw new BadRequestException('Корзина пуста');
    }

    // Load dealer filial with manager
    const dealerFilial = await this.dataSource.getRepository(Filial).findOne({
      where: { id: dto.to },
      relations: { manager: true },
    });

    const transferDtos: CreateTransferDto[] = baskets.map((basket) => ({
      product: basket.product.id,
      count: basket.x,
      from: dto.from,
      to: dto.to,
      courier: dto.courier,
      isMetric: basket.isMetric,
    })) as unknown as CreateTransferDto[];

    const results = await this.create(transferDtos, fullUser.id);

    // Create/find PackageTransfer and link transfers to it
    if (dealerFilial) {
      const packageId = await this.createOrFindPackageForDealer(
        dealerFilial,
        fullUser,
        dto.courier,
      );

      // Build group string: "FirstName LastName-count-kv-HH:mm dd.MM.yyyy"
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

      let totalCount = 0;
      let totalKv = 0;
      for (const transfer of results) {
        totalCount += Number(transfer.count) || 0;
        totalKv += Number(transfer.kv) || 0;
      }

      const groupStr = `${fullUser.firstName || ''} ${fullUser.lastName || ''}-${totalCount}-${totalKv.toFixed(1)}-${timeStr}`.trim();

      // Link transfers to package and set group
      for (const transfer of results) {
        await this.transferRepository.update(transfer.id, {
          package: { id: packageId },
          group: groupStr,
        } as any);
      }

      // Update package running totals
      await this.packageTransferService.bulkCreateTransfers({
        count: totalCount,
        kv: totalKv,
        price: 0,
        netProfitSum: 0,
        package_transfer: packageId,
      });
    }

    await this.orderBasketService.clearTransferBasket(fullUser.id);

    return results;
  }

  /**
   * Create or find a PackageTransfer for a dealer.
   * Handles missing dealer.manager gracefully.
   */
  private async createOrFindPackageForDealer(
    dealer: Filial,
    user: User,
    courier: string,
  ): Promise<string> {
    try {
      return await this.packageTransferService.findOrCreate(dealer, user, courier);
    } catch {
      // If findOrCreate fails (e.g. dealer.manager is null), create directly
      const { packageTransferCodeGenerator } = require('../../infra/helpers');
      const pkgRepo = this.dataSource.getRepository('PackageTransfer');
      const existing = await pkgRepo.findOne({
        where: { dealer: { id: dealer.id }, status: 'progress' },
      });
      if (existing) return (existing as any).id;

      const created = pkgRepo.create({
        from: user.filial?.id || null,
        dealer: dealer.id,
        courier,
        title: 'TR-' + packageTransferCodeGenerator(),
        d_manager: dealer.manager?.id || user.id,
      } as any);
      const saved = await pkgRepo.save(created);
      return (saved as any).id;
    }
  }

  async update(
    id: string,
    dto: UpdateTransferDto,
  ): Promise<UpdateResult> {
    return this.transferRepository.update(id, dto as unknown as Transfer);
  }

  async changeProgress(
    from: string,
    to: string,
  ): Promise<UpdateResult> {
    return this.transferRepository
      .createQueryBuilder()
      .update()
      .set({ progress: to as unknown as TransferStatus })
      .where('progres = :from', { from })
      .execute();
  }

  /**
   * Accept transfers from a source filial to a destination filial.
   * For each in-progress transfer, materializes the product on the
   * destination filial — merging into an existing product row with the
   * same (bar_code, partiya, comingPrice, priceMeter) or creating a new
   * one. Source was already deducted at create-time.
   */
  async acceptTransfer(
    data: { from: string; to: string; include?: string[]; exclude?: string[] },
    user: any,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(Transfer);

      const qb = transferRepo
        .createQueryBuilder('transfer')
        .leftJoinAndSelect('transfer.product', 'product')
        .leftJoinAndSelect('product.bar_code', 'bar_code')
        .leftJoinAndSelect('bar_code.size', 'size')
        .leftJoinAndSelect('product.partiya', 'partiya')
        .leftJoinAndSelect('product.collection_price', 'collection_price')
        .where('transfer."fromId" = :from AND transfer."toId" = :to AND transfer.progres = :status', {
          from: data.from,
          to: data.to,
          status: TransferStatus.PROGRESS,
        });

      if (data.include?.length) {
        qb.andWhere('transfer.id IN (:...ids)', { ids: data.include });
      }
      if (data.exclude?.length) {
        qb.andWhere('transfer.id NOT IN (:...ids)', { ids: data.exclude });
      }

      const transfers = await qb.getMany();

      for (const transfer of transfers) {
        await this.materializeOnDestination(manager, transfer, data.to);
      }

      if (transfers.length) {
        await transferRepo
          .createQueryBuilder()
          .update()
          .set({
            progress: TransferStatus.ACCEPT,
            isChecked: true,
            cashier: user.id,
          } as unknown as Transfer)
          .whereInIds(transfers.map((t) => t.id))
          .execute();
      }
    });
  }

  /**
   * Reject a single in-progress transfer: return stock to the source filial.
   */
  async rejectTransfer(id: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(Transfer);
      const productRepo = manager.getRepository(Product);

      const transfer = await transferRepo.findOne({
        where: { id },
        relations: { product: { bar_code: { size: true } }, from: true },
      });
      if (!transfer) {
        throw new NotFoundException('Transfer not found');
      }

      if (transfer.progress === TransferStatus.ACCEPT) {
        throw new BadRequestException('Qabul qilingan transferni rad etib bo\'lmaydi');
      }
      if (transfer.progress === TransferStatus.REJECT) {
        return; // already rejected — idempotent
      }

      if (transfer.product) {
        const product = await productRepo.findOne({
          where: { id: transfer.product.id },
          relations: { bar_code: { size: true } },
        });
        if (product) {
          const isMetric = !!product.bar_code?.isMetric;
          const returnedCount = Number(transfer.count) || 0;

          if (isMetric) {
            product.count = +product.count + returnedCount;
            // Restore the roll length from the transfer's kv / size.x
            const sizeX = Number(product.bar_code?.size?.x || 0);
            if (sizeX > 0) {
              product.y = +product.y + Number(transfer.kv || 0) / sizeX;
            }
          } else {
            product.count = +product.count + returnedCount;
          }

          // Stock is back — clear depletion flags
          if ((isMetric && +product.y > 0) || (!isMetric && +product.count > 0)) {
            product.is_deleted = false;
            product.deletedDate = null;
          }

          await productRepo.save(product);
        }
      }

      await transferRepo.update(id, {
        progress: TransferStatus.REJECT,
        cashier: userId,
      } as unknown as Transfer);
    });
  }

  async remove(id: string): Promise<void> {
    const transfer = await this.transferRepository.findOne({ where: { id } });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    await this.transferRepository.delete(id);
  }

  // -----------------------------------------------------------------------
  // Dealer transfer endpoints (used by D-Manager frontend)
  // -----------------------------------------------------------------------

  /**
   * GET /transfer/dealer — returns transfers for a given package.
   * mode=list  → individual transfers with full product relations
   * mode=collection → aggregated by collection with pricing
   */
  async getDealerTransfers(query: {
    package_id: string;
    mode?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    if (query.mode === 'collection') {
      return this.getDealerTransfersCollection(query);
    }
    return this.getDealerTransfersList(query);
  }

  private async getDealerTransfersList(query: {
    package_id: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('transfer.transferer', 'transferer')
      .leftJoinAndSelect('transferer.avatar', 'transferer_avatar')
      .leftJoinAndSelect('transfer.courier', 'courier')
      .leftJoinAndSelect('courier.avatar', 'courier_avatar')
      .where('transfer."packageId" = :packageId', { packageId: query.package_id })
      .orderBy('transfer.group', 'ASC')
      .addOrderBy('transfer.date', 'DESC');

    if (query.search) {
      qb.andWhere(
        '(model.title ILIKE :search OR collection.title ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const result = await paginate<Transfer>(qb, {
      page: query.page || 1,
      limit: query.limit || 10,
    });

    // Frontend expects 'progres' (column name), not 'progress' (property name)
    for (const item of result.items as any[]) {
      (item as any).progres = item.progress;
    }

    return result;
  }

  private async getDealerTransfersCollection(query: {
    package_id: string;
    search?: string;
  }) {
    const pcpRepo = this.dataSource.getRepository(PackageCollectionPrice);

    // Get collection prices for this package
    const collectionPrices = await pcpRepo.find({
      where: { package: { id: query.package_id } },
      relations: { collection: true },
    });

    // Get all transfers for this package
    const qb = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.size', 'size')
      .where('transfer."packageId" = :packageId', { packageId: query.package_id });

    if (query.search) {
      qb.andWhere('collection.title ILIKE :search', { search: `%${query.search}%` });
    }

    const transfers = await qb.getMany();

    // Aggregate by collection
    const collectionMap = new Map<string, {
      title: string;
      total_kv: number;
      total_count: number;
      total_profit_sum: number;
    }>();

    for (const transfer of transfers) {
      const collId = transfer.product?.bar_code?.collection?.id;
      if (!collId) continue;

      const existing = collectionMap.get(collId) || {
        title: transfer.product.bar_code.collection.title || '',
        total_kv: 0,
        total_count: 0,
        total_profit_sum: 0,
      };
      existing.total_kv += Number(transfer.kv || 0);
      existing.total_count += Number(transfer.count || 0);
      collectionMap.set(collId, existing);
    }

    // Build items merging collection prices and transfer aggregates
    const seenIds = new Set<string>();
    const items = [];

    for (const cp of collectionPrices) {
      const collId = cp.collection.id;
      seenIds.add(collId);
      const agg = collectionMap.get(collId) || { title: cp.collection.title, total_kv: 0, total_count: 0, total_profit_sum: 0 };
      items.push({
        id: collId,
        title: agg.title || cp.collection.title,
        total_kv: agg.total_kv,
        total_count: agg.total_count,
        comingPrice: cp.dealerPriceMeter,
        total_profit_sum: agg.total_profit_sum,
        collection_prices: [cp],
      });
    }

    // Add collections that have transfers but no price set yet
    for (const [collId, agg] of collectionMap.entries()) {
      if (!seenIds.has(collId)) {
        items.push({
          id: collId,
          title: agg.title,
          total_kv: agg.total_kv,
          total_count: agg.total_count,
          comingPrice: 0,
          total_profit_sum: 0,
          collection_prices: [],
        });
      }
    }

    return {
      items,
      meta: {
        totalItems: items.length,
        itemCount: items.length,
        itemsPerPage: items.length,
        totalPages: 1,
        currentPage: 1,
      },
    };
  }

  /**
   * POST /transfer/give-price — set dealer price for a collection in a package
   */
  async givePrice(dto: ChangePriceDto): Promise<void> {
    const pcpRepo = this.dataSource.getRepository(PackageCollectionPrice);

    const existing = await pcpRepo.findOne({
      where: {
        package: { id: dto.package_id },
        collection: { id: dto.collection },
      },
    });

    if (existing) {
      existing.dealerPriceMeter = dto.price;
      await pcpRepo.save(existing);
    } else {
      const created = pcpRepo.create({
        package: { id: dto.package_id } as any,
        collection: { id: dto.collection } as any,
        dealerPriceMeter: dto.price,
      });
      await pcpRepo.save(created);
    }
  }

  /**
   * PATCH /transfer/reject/dealer-transfer/:id
   * Reject a single transfer from within a package (before accept).
   */
  async rejectDealerTransfer(transferId: string): Promise<void> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
      relations: { package: true },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    if (transfer.package) {
      await this.packageTransferService.cancelTransferFromPackage(
        transfer.package.id,
        transferId,
      );
    } else {
      throw new BadRequestException('Transfer is not part of a package');
    }
  }

  // -----------------------------------------------------------------------
  // Backward-compatible methods (used by legacy modules)
  // -----------------------------------------------------------------------

  /** Check transfer manager and return the product (used by order.service) */
  async checkTransferManager(transferId: string, cashierId: string): Promise<any> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
      relations: { product: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer.product;
  }

  /** Get totals by dealer (used by paper-report) */
  async totalsByDealer(filialId: string, month: number, year: number): Promise<any> {
    return this.transferRepository.find({
      where: { to: { id: filialId } },
      relations: { product: true, from: true, to: true },
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Place the transfer's payload on the destination filial. Merges into an
   * existing Product row with the same identity (bar_code + partiya +
   * comingPrice + priceMeter); otherwise clones a new Product row keeping
   * all pricing/partiya FKs intact.
   */
  private async materializeOnDestination(
    manager: EntityManager,
    transfer: Transfer,
    destinationFilialId: string,
  ): Promise<void> {
    const productRepo = manager.getRepository(Product);
    const source = transfer.product;
    if (!source) return;

    const isMetric = !!source.bar_code?.isMetric;
    const transferredCount = Number(transfer.count) || 0;
    const sizeX = Number(source.bar_code?.size?.x || 0);
    const transferredY = isMetric && sizeX > 0 ? Number(transfer.kv || 0) / sizeX : 0;

    // Look for an existing product on the destination that can absorb this transfer.
    const existing = await productRepo.findOne({
      where: {
        bar_code: { id: source.bar_code.id },
        filial: { id: destinationFilialId },
        partiya: source.partiya ? { id: source.partiya.id } : undefined,
        is_deleted: false,
      },
      relations: { bar_code: true },
    });

    if (
      existing &&
      Number(existing.comingPrice) === Number(source.comingPrice) &&
      Number(existing.priceMeter) === Number(source.priceMeter)
    ) {
      existing.count = +existing.count + transferredCount;
      if (isMetric) {
        existing.y = +existing.y + transferredY;
      }
      existing.is_deleted = false;
      existing.deletedDate = null;
      await productRepo.save(existing);
      return;
    }

    // Clone a new product row on the destination filial
    const clone: Partial<Product> = {
      code: source.code,
      count: transferredCount,
      price: source.price,
      secondPrice: source.secondPrice,
      priceMeter: source.priceMeter,
      comingPrice: source.comingPrice,
      draft_priceMeter: source.draft_priceMeter,
      draft_comingPrice: source.draft_comingPrice,
      x: source.x,
      y: isMetric ? transferredY : source.y,
      totalSize: source.totalSize,
      isInternetShop: false,
      is_deleted: false,
      partiya_title: source.partiya_title,
      bar_code: source.bar_code,
      filial: { id: destinationFilialId } as any,
      collection_price: source.collection_price,
      partiya: source.partiya,
    };

    const created = productRepo.create(clone as Product);
    await productRepo.save(created);
  }
}
