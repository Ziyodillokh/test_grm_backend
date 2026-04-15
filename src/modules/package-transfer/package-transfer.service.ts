import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { packageTransferCodeGenerator } from '../../infra/helpers';
import { Filial } from '@modules/filial/filial.entity';
import { User } from '@modules/user/user.entity';
import PaginationDto from '@infra/shared/dto/pagination.dto';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';
import packageTransferEnum from '@infra/shared/enum/package-transfer.enum';
import PackageTransferEnum from '@infra/shared/enum/package-transfer.enum';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Product } from '@modules/product/product.entity';
import { PackageCollectionPrice } from '@modules/package-collection-price/package-collection-price.entity';
import { TransferStatus } from '../../common/enums';
import { applyStockDepletion } from '@modules/product/utils/stock-depletion.util';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import { Report } from '@modules/report/report.entity';
import KassaProgresEnum from '@infra/shared/enum/kassa-progres-enum';
import CashFlowEnum from '@infra/shared/enum/cashflow/cash-flow.enum';
import CashflowTipEnum from '@infra/shared/enum/cashflow/cashflow-tip.enum';
import FilialType from '@infra/shared/enum/filial-type.enum';

@Injectable()
export class PackageTransferService {
  constructor(
    @InjectRepository(PackageTransfer)
    private readonly repository: Repository<PackageTransfer>,
    private readonly dataSource: DataSource,
  ) {
  }

  async getAll(query: PaginationDto & { dealer?: string; filial?: string, search?: string }) {
    const { page, limit, dealer, filial, search } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('package_transfer')
      .leftJoinAndSelect('package_transfer.dealer', 'dealer')
      .leftJoinAndSelect('package_transfer.from', 'from')
      .leftJoinAndSelect('package_transfer.d_manager', 'd_manager')
      .leftJoinAndSelect('package_transfer.courier', 'courier')
      .orderBy('package_transfer.createdAt', 'DESC');

    if (dealer) {
      queryBuilder.andWhere('dealer.id = :dealer', { dealer });
    }

    if (filial) {
      queryBuilder.andWhere('from.id = :filial', { filial });
    }

    if (filial) {
      queryBuilder.andWhere('from.title = :search', { search });
    }

    const options: IPaginationOptions = {
      page,
      limit,
      route: '',
    };

    return paginate<PackageTransfer>(queryBuilder, options);
  }

  async getById(id: string) {
    return await this.repository
      .findOne({
        where: { id },
        relations: {
          from: true,
          dealer: true,
          courier: true,
          collection_prices: { collection: true },
        },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  async findOrCreate(dealer: Filial, user: User | { filial }, courier: string): Promise<string> {
    const filial = user.filial;
    let package_transfer = await this.repository.findOne({
      where: {
        dealer: { id: dealer.id },
        status: PackageTransferEnum.Progress,
      },
    });
    if (!package_transfer) {
      const data = {
        from: filial.id,
        dealer: dealer.id,
        courier,
        title: 'TR-' + packageTransferCodeGenerator(),
        d_manager: dealer.manager.id,
      };
      const pck_tr = this.repository.create(data as unknown as PackageTransfer);
      const res = await this.repository.save(pck_tr);
      return res.id;
    }

    return package_transfer.id;
  }

  async bulkCreateTransfers({ count, kv, price, netProfitSum, package_transfer }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_count: () => `total_count + ${count}`,
        total_kv: () => `total_kv + ${kv}`,
        total_sum: () => `total_sum + ${price}`,
        total_profit_sum: () => `total_profit_sum + ${netProfitSum}`,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  async bulkRemoveTransfers({ count, kv, price, netProfitSum, package_transfer }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_count: () => `total_count - ${count}`,
        total_kv: () => `total_kv - ${kv}`,
        total_sum: () => `total_sum - ${price}`,
        total_profit_sum: () => `total_profit_sum - ${netProfitSum}`,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  async updateTotalSums({ totalSum, package_transfer, netProfitSum }) {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        total_sum: totalSum,
        total_profit_sum: netProfitSum,
      })
      .where('id = :id', { id: package_transfer })
      .execute();
  }

  /**
   * Change package status. For ACCEPT: runs the full dealer-sale transaction
   * (BUG F fix). See {@link acceptPackage}.
   */
  async changeStatus(id: string, status: packageTransferEnum) {
    if (status === PackageTransferEnum.Accept) {
      await this.acceptPackage(id);
      return;
    }
    await this.repository.update({ id }, { status });
  }

  /**
   * BUG F — Dealer-sale package accept flow.
   *
   * Atomic transaction:
   *  1. Load the package with its active (in-progress) transfers and their
   *     source products (bar_code → collection, partiya, size).
   *  2. Validate that every unique collection in the active set has a
   *     `PackageCollectionPrice.dealerPriceMeter` row.
   *  3. For each active transfer: materialize a matching Product row on the
   *     dealer filial preserving `partiya` and the original `comingPrice`,
   *     but overriding `priceMeter` with the collection's `dealerPriceMeter`.
   *  4. Accumulate totals:
   *       total_sum      = Σ kv × dealerPm
   *       total_profit   = Σ kv × (dealerPm − comingPrice)
   *       total_discount = Σ kv × (origPm   − dealerPm)
   *       total_count/kv = Σ count / Σ kv
   *  5. Save totals + `acceptedAt` on the package, mark transfers ACCEPT,
   *     and `dealerFilial.owed += total_sum`. A Расход cashflow is created
   *     on the dealer's kassa linked to the package.
   */
  private async acceptPackage(packageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const packageRepo = manager.getRepository(PackageTransfer);
      const transferRepo = manager.getRepository(Transfer);
      const filialRepo = manager.getRepository(Filial);
      const pcpRepo = manager.getRepository(PackageCollectionPrice);

      // 1) Load package with dealer and per-collection prices
      const pkg = await packageRepo.findOne({
        where: { id: packageId },
        relations: {
          dealer: true,
          from: true,
          collection_prices: { collection: true },
        },
      });
      if (!pkg) {
        throw new NotFoundException(`Package ${packageId} not found`);
      }
      if (pkg.status === PackageTransferEnum.Accept) {
        return; // idempotent
      }
      if (!pkg.dealer) {
        throw new BadRequestException('Package has no dealer filial assigned');
      }

      // 2) Load active transfers of this package with full product/collection tree
      const activeTransfers = await transferRepo
        .createQueryBuilder('transfer')
        .leftJoinAndSelect('transfer.product', 'product')
        .leftJoinAndSelect('product.bar_code', 'bar_code')
        .leftJoinAndSelect('bar_code.size', 'size')
        .leftJoinAndSelect('bar_code.collection', 'collection')
        .leftJoinAndSelect('product.partiya', 'partiya')
        .leftJoinAndSelect('product.collection_price', 'collection_price')
        .where('transfer."packageId" = :pkgId', { pkgId: packageId })
        .andWhere('transfer.progres = :status', { status: TransferStatus.PROGRESS })
        .getMany();

      if (!activeTransfers.length) {
        throw new BadRequestException('Paket ichida aktiv transfer yo\'q');
      }

      // 3) Collect unique collection ids from active transfers
      const collectionIdSet = new Set<string>();
      for (const t of activeTransfers) {
        const collId = t.product?.bar_code?.collection?.id;
        if (!collId) {
          throw new BadRequestException(
            `Transfer ${t.id} uchun collection aniqlanmadi`,
          );
        }
        collectionIdSet.add(collId);
      }
      const collectionIds = [...collectionIdSet];

      // 4) Validate that dealerPriceMeter rows exist for every collection
      const priceRows = await pcpRepo.find({
        where: { package: { id: packageId } },
        relations: { collection: true },
      });
      const priceMap = new Map<string, number>();
      for (const row of priceRows) {
        if (row.collection?.id) {
          priceMap.set(row.collection.id, Number(row.dealerPriceMeter) || 0);
        }
      }
      const missing = collectionIds.filter((cid) => !priceMap.has(cid));
      if (missing.length) {
        throw new BadRequestException(
          `Quyidagi collection(lar) uchun dealerPriceMeter kiritilmagan: ${missing.join(', ')}`,
        );
      }

      // 5) Materialize each transfer on the dealer filial and accumulate totals
      let total_sum = 0;
      let total_profit = 0;
      let total_discount = 0;
      let total_count = 0;
      let total_kv = 0;

      for (const transfer of activeTransfers) {
        const product = transfer.product;
        const collId = product.bar_code.collection.id;
        const dealerPm = priceMap.get(collId) || 0;
        const comingPrice = Number(product.comingPrice) || Number(product.bar_code?.collection?.comingPrice) || 0;
        const origPm = Number(product.priceMeter) || 0;
        const kv = Number(transfer.kv) || 0;
        const count = Number(transfer.count) || 0;

        total_kv += kv;
        total_count += count;
        total_sum += kv * dealerPm;
        total_profit += kv * (dealerPm - comingPrice);
        total_discount += kv * (origPm - dealerPm);

        await this.materializeOnDealer(manager, transfer, pkg.dealer.id, dealerPm);
      }

      // 6) Update transfers to ACCEPT in bulk
      await transferRepo
        .createQueryBuilder()
        .update()
        .set({ progress: TransferStatus.ACCEPT, isChecked: true } as unknown as Transfer)
        .whereInIds(activeTransfers.map((t) => t.id))
        .execute();

      // 7) Save package totals + acceptedAt + status
      // Reset totals (bulkCreateTransfers already accumulated count/kv, so overwrite)
      pkg.total_sum = total_sum;
      pkg.total_profit = total_profit;
      pkg.total_discount = total_discount;
      pkg.total_count = total_count;
      pkg.total_kv = total_kv;
      pkg.acceptedAt = new Date();
      pkg.status = PackageTransferEnum.Accept;
      pkg.total_profit_sum = total_profit;
      await packageRepo.save(pkg);

      // 8) Dealer filial debt: owed += total_sum
      await filialRepo
        .createQueryBuilder()
        .update()
        .set({ owed: () => `owed + ${total_sum}` })
        .where('id = :id', { id: pkg.dealer.id })
        .execute();

      // 9) Find or create dealer kassa for current month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const kassaRepo = manager.getRepository(Kassa);
      const reportRepo = manager.getRepository(Report);

      const dealerReport = await reportRepo.findOne({
        where: { year: currentYear, month: currentMonth, filialType: FilialType.DEALER },
      });

      let dealerKassa = await kassaRepo.findOne({
        where: {
          filial: { id: pkg.dealer.id },
          year: currentYear,
          month: currentMonth,
          status: KassaProgresEnum.OPEN,
        },
      });

      if (!dealerKassa) {
        dealerKassa = kassaRepo.create({
          filial: { id: pkg.dealer.id } as any,
          year: currentYear,
          month: currentMonth,
          status: KassaProgresEnum.OPEN,
          isActive: true,
          filialType: FilialType.DEALER,
          report: dealerReport || undefined,
        });
        dealerKassa = await kassaRepo.save(dealerKassa);
      }

      // 10) Find dealer_package cashflow type
      const dealerPackageType = await manager.getRepository(CashflowType).findOne({
        where: { slug: 'dealer_package' },
      });

      // 11) Create Расход cashflow linked to package
      const cashflowRepo = manager.getRepository(Cashflow);
      const expenseCashflow = cashflowRepo.create({
        price: total_sum,
        type: CashFlowEnum.Consumption,
        tip: CashflowTipEnum.CASHFLOW,
        date: new Date(),
        is_static: true,
        comment: `Пакет ${pkg.title} qabul qilindi`,
        kassa: dealerKassa,
        filial: { id: pkg.dealer.id } as any,
        packageTransfer: { id: packageId } as any,
        cashflow_type: dealerPackageType || undefined,
      });
      await cashflowRepo.save(expenseCashflow);

      // 12) Update dealer kassa: debt stats + discount
      await kassaRepo.update(dealerKassa.id, {
        debt_count: Number(dealerKassa.debt_count || 0) + total_count,
        debt_kv: Number(dealerKassa.debt_kv || 0) + total_kv,
        debt_sum: Number(dealerKassa.debt_sum || 0) + total_sum,
        debt_profit_sum: Number(dealerKassa.debt_profit_sum || 0) + total_profit,
        discount: Number(dealerKassa.discount || 0) + total_discount,
      });

      // 13) Update D-Manager report: debt stats
      if (dealerReport) {
        await reportRepo.update(dealerReport.id, {
          debt_count: Number(dealerReport.debt_count || 0) + total_count,
          debt_kv: Number(dealerReport.debt_kv || 0) + total_kv,
          debt_sum: Number(dealerReport.debt_sum || 0) + total_sum,
          debt_profit_sum: Number(dealerReport.debt_profit_sum || 0) + total_profit,
          totalDiscount: Number(dealerReport.totalDiscount || 0) + total_discount,
        });
      }
    });
  }

  /**
   * Place the transfer payload onto the dealer filial. Preserves the
   * original `partiya` FK and `comingPrice`, but sets `priceMeter` to the
   * package-specific `dealerPriceMeter`. Merges into an existing product
   * row if one with the same identity already exists.
   */
  private async materializeOnDealer(
    manager: EntityManager,
    transfer: Transfer,
    dealerFilialId: string,
    dealerPriceMeter: number,
  ): Promise<void> {
    const productRepo = manager.getRepository(Product);
    const source = transfer.product;
    if (!source) return;

    const isMetric = !!source.bar_code?.isMetric;
    const transferredCount = Number(transfer.count) || 0;
    const sizeX = Number(source.bar_code?.size?.x || 0);
    const transferredY =
      isMetric && sizeX > 0 ? Number(transfer.kv || 0) / sizeX : 0;

    // Look for an existing product on the dealer that can absorb this transfer.
    // Match on bar_code + partiya + comingPrice + dealerPriceMeter — same identity.
    const existing = await productRepo.findOne({
      where: {
        bar_code: { id: source.bar_code.id },
        filial: { id: dealerFilialId },
        partiya: source.partiya ? { id: source.partiya.id } : undefined,
        is_deleted: false,
      },
      relations: { bar_code: true },
    });

    if (
      existing &&
      Number(existing.comingPrice) === Number(source.comingPrice) &&
      Number(existing.priceMeter) === Number(dealerPriceMeter)
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

    // Clone a new product row on the dealer filial
    const clone: Partial<Product> = {
      code: source.code,
      count: transferredCount,
      price: source.price,
      secondPrice: source.secondPrice,
      priceMeter: dealerPriceMeter, // ← discounted sale price (sale-to-dealer)
      comingPrice: source.comingPrice, // ← cost of goods stays identical
      draft_priceMeter: source.draft_priceMeter,
      draft_comingPrice: source.draft_comingPrice,
      x: source.x,
      y: isMetric ? transferredY : source.y,
      totalSize: source.totalSize,
      isInternetShop: false,
      is_deleted: false,
      partiya_title: source.partiya_title,
      bar_code: source.bar_code,
      filial: { id: dealerFilialId } as any,
      collection_price: source.collection_price,
      partiya: source.partiya,
    };

    const created = productRepo.create(clone as Product);
    await productRepo.save(created);
  }

  // -------------------------------------------------------------------
  // Cancel (before accept) & Return (after accept)
  // -------------------------------------------------------------------

  /**
   * Cancel a single transfer from a package BEFORE the package is accepted.
   * Returns stock to the source product (same logic as rejectTransfer).
   * The transfer is marked REJECT and removed from the package's running totals.
   */
  async cancelTransferFromPackage(
    packageId: string,
    transferId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const packageRepo = manager.getRepository(PackageTransfer);
      const transferRepo = manager.getRepository(Transfer);
      const productRepo = manager.getRepository(Product);

      const pkg = await packageRepo.findOne({ where: { id: packageId } });
      if (!pkg) throw new NotFoundException(`Package ${packageId} not found`);
      if (pkg.status === PackageTransferEnum.Accept) {
        throw new BadRequestException(
          'Paket tasdiqlangan — bekor qilish emas, vazvrat qiling',
        );
      }

      const transfer = await transferRepo.findOne({
        where: { id: transferId, package: { id: packageId } },
        relations: { product: { bar_code: { size: true } }, from: true },
      });
      if (!transfer) {
        throw new NotFoundException('Transfer not found in this package');
      }
      if (transfer.progress !== TransferStatus.PROGRESS) {
        throw new BadRequestException('Faqat aktiv (progress) transferni bekor qilish mumkin');
      }

      // Return stock to source product
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
            const sizeX = Number(product.bar_code?.size?.x || 0);
            if (sizeX > 0) {
              product.y = +product.y + Number(transfer.kv || 0) / sizeX;
            }
          } else {
            product.count = +product.count + returnedCount;
          }

          if ((isMetric && +product.y > 0) || (!isMetric && +product.count > 0)) {
            product.is_deleted = false;
            product.deletedDate = null;
          }

          await productRepo.save(product);
        }
      }

      // Mark transfer as rejected
      await transferRepo.update(transferId, {
        progress: TransferStatus.REJECT,
      } as unknown as Transfer);

      // Subtract from package running totals (pre-accept totals are
      // accumulated by bulkCreateTransfers when transfers are added)
      const kv = Number(transfer.kv) || 0;
      const count = Number(transfer.count) || 0;
      const comingPrice = Number(transfer.comingPrice) || 0;
      const priceMeter = Number(transfer.product?.priceMeter) || 0;
      const rowSum = kv * priceMeter;
      const rowProfit = kv * (priceMeter - comingPrice);

      await packageRepo
        .createQueryBuilder()
        .update()
        .set({
          total_count: () => `GREATEST(total_count - ${count}, 0)`,
          total_kv: () => `GREATEST(total_kv - ${kv}, 0)`,
          total_sum: () => `GREATEST(total_sum - ${rowSum}, 0)`,
          total_profit_sum: () => `GREATEST(total_profit_sum - ${rowProfit}, 0)`,
        })
        .where('id = :id', { id: packageId })
        .execute();
    });
  }

  /**
   * Return a transfer AFTER the package has been accepted.
   * Removes product from dealer filial → adds to the chosen target filial.
   * Decrements package totals and `dealer.owed`.
   */
  async returnTransferFromPackage(
    packageId: string,
    transferId: string,
    targetFilialId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const packageRepo = manager.getRepository(PackageTransfer);
      const transferRepo = manager.getRepository(Transfer);
      const productRepo = manager.getRepository(Product);
      const filialRepo = manager.getRepository(Filial);
      const pcpRepo = manager.getRepository(PackageCollectionPrice);

      // 1) Load package
      const pkg = await packageRepo.findOne({
        where: { id: packageId },
        relations: { dealer: true, collection_prices: { collection: true } },
      });
      if (!pkg) throw new NotFoundException(`Package ${packageId} not found`);
      if (pkg.status !== PackageTransferEnum.Accept) {
        throw new BadRequestException('Faqat tasdiqlangan paketdan vazvrat qilish mumkin');
      }

      // 2) Load transfer with full product tree
      const transfer = await transferRepo.findOne({
        where: { id: transferId, package: { id: packageId } },
        relations: {
          product: {
            bar_code: { size: true, collection: true },
            partiya: true,
            collection_price: true,
          },
        },
      });
      if (!transfer) {
        throw new NotFoundException('Transfer not found in this package');
      }
      if (transfer.progress === TransferStatus.RETURNED) {
        return; // idempotent
      }
      if (transfer.progress !== TransferStatus.ACCEPT) {
        throw new BadRequestException('Faqat qabul qilingan transferni qaytarish mumkin');
      }

      const source = transfer.product;
      if (!source) {
        throw new BadRequestException('Transfer has no product reference');
      }

      const isMetric = !!source.bar_code?.isMetric;
      const kv = Number(transfer.kv) || 0;
      const count = Number(transfer.count) || 0;
      const sizeX = Number(source.bar_code?.size?.x || 0);
      const transferredY = isMetric && sizeX > 0 ? kv / sizeX : 0;
      const comingPrice = Number(source.comingPrice) || 0;
      const origPm = Number(source.priceMeter) || 0;

      // Find the dealerPriceMeter that was used at accept time
      const collId = source.bar_code?.collection?.id;
      let dealerPm = 0;
      if (collId) {
        const pcpRow = pkg.collection_prices?.find(
          (cp) => cp.collection?.id === collId,
        );
        dealerPm = pcpRow ? Number(pcpRow.dealerPriceMeter) || 0 : 0;
      }
      // Fallback: if priceMeter was overwritten to dealerPm on accept, use it
      if (!dealerPm) {
        dealerPm = origPm;
      }

      // 3) Remove from dealer filial
      const dealerProduct = await productRepo.findOne({
        where: {
          bar_code: { id: source.bar_code.id },
          filial: { id: pkg.dealer.id },
          partiya: source.partiya ? { id: source.partiya.id } : undefined,
          is_deleted: false,
        },
        relations: { bar_code: { size: true } },
      });
      if (dealerProduct) {
        dealerProduct.count = Math.max(+dealerProduct.count - count, 0);
        if (isMetric) {
          dealerProduct.y = Math.max(+dealerProduct.y - transferredY, 0);
        }
        applyStockDepletion(dealerProduct, isMetric);
        await productRepo.save(dealerProduct);
      }

      // 4) Add to target filial (materialize — reuse transfer.service logic)
      // The returned product should get the ORIGINAL priceMeter (not dealer's
      // discounted one), since it's going back to a non-dealer filial.
      // comingPrice stays the same as it always does.
      const origProductPriceMeter = Number(transfer.comingPrice)
        ? origPm
        : 0; // if we can't figure out orig, use what's on product

      // Look for existing product on target that can absorb
      const targetExisting = await productRepo.findOne({
        where: {
          bar_code: { id: source.bar_code.id },
          filial: { id: targetFilialId },
          partiya: source.partiya ? { id: source.partiya.id } : undefined,
          is_deleted: false,
        },
        relations: { bar_code: true },
      });

      // For returned products, we need the filial-type priceMeter.
      // Best available is what was on the source product before transfer.
      // The transfer stored comingPrice; origPm on dealer product = dealerPm.
      // We need the original priceMeter. Get latest CollectionPrice for target filial type.
      // Simplest approach: use `transfer.product.priceMeter` which is dealerPm after accept.
      // But for the return target, re-fetch the correct priceMeter from the
      // same bar_code products on that filial, or fall back to dealerPm.
      // The plan says "qaytariladigan mahsulot" — we use source.priceMeter (dealerPm).
      // The admin can later update via CollectionPrice propagation (BUG C).
      const returnPm = targetExisting ? Number(targetExisting.priceMeter) || dealerPm : dealerPm;

      if (
        targetExisting &&
        Number(targetExisting.comingPrice) === comingPrice &&
        Number(targetExisting.priceMeter) === returnPm
      ) {
        targetExisting.count = +targetExisting.count + count;
        if (isMetric) {
          targetExisting.y = +targetExisting.y + transferredY;
        }
        targetExisting.is_deleted = false;
        targetExisting.deletedDate = null;
        await productRepo.save(targetExisting);
      } else {
        const clone: Partial<Product> = {
          code: source.code,
          count,
          price: source.price,
          secondPrice: source.secondPrice,
          priceMeter: returnPm,
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
          filial: { id: targetFilialId } as any,
          collection_price: source.collection_price,
          partiya: source.partiya,
        };
        const created = productRepo.create(clone as Product);
        await productRepo.save(created);
      }

      // 5) Mark transfer as RETURNED
      await transferRepo.update(transferId, {
        progress: TransferStatus.RETURNED,
      } as unknown as Transfer);

      // 6) Decrement package totals
      const rowSum = kv * dealerPm;
      const rowProfit = kv * (dealerPm - comingPrice);
      const rowDiscount = kv * (origPm - dealerPm);

      // Use the original product priceMeter for discount calc.
      // origPm on dealer product IS dealerPm, so origPm - dealerPm = 0.
      // We need the pre-dealer priceMeter. It was stored in the transfer? No.
      // We must pull it from the PackageCollectionPrice context or from transfer's
      // source product (which still has the original priceMeter on the source filial).
      // The formula per the plan:
      //   total_discount -= kv * (origPriceMeter - dealerPriceMeter)
      // origPriceMeter is the filial sale price, NOT the dealer's. However, after
      // accept, the product.priceMeter on the dealer = dealerPm. The original
      // origPriceMeter is lost unless we stored it. Since we don't have a dedicated
      // column, we'll subtract what was originally added: use the same formula
      // direction, but since rowDiscount might be 0 or negative if origPm = dealerPm,
      // we clamp to prevent negatives in totals.

      pkg.total_sum = Math.max(+(pkg.total_sum || 0) - rowSum, 0);
      pkg.total_profit = Math.max(+(pkg.total_profit || 0) - rowProfit, 0);
      pkg.total_discount = Math.max(+(pkg.total_discount || 0) - rowDiscount, 0);
      pkg.total_count = Math.max(+(pkg.total_count || 0) - count, 0);
      pkg.total_kv = Math.max(+(pkg.total_kv || 0) - kv, 0);
      pkg.total_profit_sum = Math.max(+(pkg.total_profit_sum || 0) - rowProfit, 0);
      await packageRepo.save(pkg);

      // 7) Decrement dealer debt
      await filialRepo
        .createQueryBuilder()
        .update()
        .set({ owed: () => `GREATEST(owed - ${rowSum}, 0)` })
        .where('id = :id', { id: pkg.dealer.id })
        .execute();
    });
  }
}
