import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { PackageCollectionPrice } from './package-collection-price.entity';
import { UpsertPackageCollectionPriceDto } from './dto';
import { PackageTransfer } from '../package-transfer/package-transfer.entity';

@Injectable()
export class PackageCollectionPriceService {
  constructor(
    @InjectRepository(PackageCollectionPrice)
    private readonly repo: Repository<PackageCollectionPrice>,
    @InjectRepository(PackageTransfer)
    private readonly packageRepo: Repository<PackageTransfer>,
    private readonly dataSource: DataSource,
  ) {}

  async getByPackage(packageId: string): Promise<PackageCollectionPrice[]> {
    return this.repo.find({
      where: { package: { id: packageId } },
      relations: { collection: true },
    });
  }

  async upsertMany(dto: UpsertPackageCollectionPriceDto): Promise<PackageCollectionPrice[]> {
    const pkg = await this.packageRepo.findOne({ where: { id: dto.packageId } });
    if (!pkg) {
      throw new NotFoundException(`Package ${dto.packageId} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PackageCollectionPrice);
      const results: PackageCollectionPrice[] = [];

      for (const item of dto.items) {
        const existing = await repo.findOne({
          where: {
            package: { id: dto.packageId },
            collection: { id: item.collectionId },
          },
        });

        if (existing) {
          existing.dealerPriceMeter = item.dealerPriceMeter;
          results.push(await repo.save(existing));
        } else {
          const created = repo.create({
            package: { id: dto.packageId } as PackageTransfer,
            collection: { id: item.collectionId } as any,
            dealerPriceMeter: item.dealerPriceMeter,
          });
          results.push(await repo.save(created));
        }
      }

      return results;
    });
  }

  /**
   * Ensures every collection in the provided list has a dealer price on
   * the package. Throws BadRequestException listing missing collection ids.
   */
  async assertAllCollectionsPriced(
    packageId: string,
    collectionIds: string[],
  ): Promise<void> {
    if (!collectionIds.length) return;

    const existing = await this.repo.find({
      where: {
        package: { id: packageId },
        collection: { id: In(collectionIds) },
      },
      relations: { collection: true },
    });

    const existingIds = new Set(existing.map((r) => r.collection.id));
    const missing = collectionIds.filter((id) => !existingIds.has(id));

    if (missing.length) {
      throw new BadRequestException(
        `Quyidagi collection(lar) uchun dealerPriceMeter kiritilmagan: ${missing.join(', ')}`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
