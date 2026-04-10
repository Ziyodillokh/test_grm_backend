import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { PartiyaCollectionPrice } from './partiya-collection-price.entity';
import { PartiyaCollectionPriceItemDto, UpsertPartiyaCollectionPriceDto } from './dto';
import { Partiya } from '../partiya/partiya.entity';

@Injectable()
export class PartiyaCollectionPriceService {
  constructor(
    @InjectRepository(PartiyaCollectionPrice)
    private readonly repo: Repository<PartiyaCollectionPrice>,
    @InjectRepository(Partiya)
    private readonly partiyaRepo: Repository<Partiya>,
    private readonly dataSource: DataSource,
  ) {}

  async getByPartiya(partiyaId: string): Promise<PartiyaCollectionPrice[]> {
    return await this.repo.find({
      where: { partiya: { id: partiyaId } },
      relations: { collection: true },
      order: { createdAt: 'ASC' },
    });
  }

  async getOne(partiyaId: string, collectionId: string): Promise<PartiyaCollectionPrice | null> {
    return await this.repo.findOne({
      where: { partiya: { id: partiyaId }, collection: { id: collectionId } },
      relations: { collection: true, partiya: true },
    });
  }

  /**
   * Bulk upsert — per partiya + collection unique. Used by UI when M-manager
   * enters per-collection factory/overhead prices before closing the partiya.
   */
  async upsertMany(dto: UpsertPartiyaCollectionPriceDto): Promise<PartiyaCollectionPrice[]> {
    const partiya = await this.partiyaRepo.findOne({ where: { id: dto.partiyaId } });
    if (!partiya) {
      throw new NotFoundException('Partiya not found');
    }

    return await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PartiyaCollectionPrice);
      const results: PartiyaCollectionPrice[] = [];

      for (const item of dto.items) {
        const existing = await repo.findOne({
          where: {
            partiya: { id: dto.partiyaId },
            collection: { id: item.collectionId },
          },
        });

        if (existing) {
          existing.factoryPricePerKv = item.factoryPricePerKv;
          existing.overheadPerKv = item.overheadPerKv;
          const saved = await repo.save(existing);
          results.push(saved);
        } else {
          const created = repo.create({
            partiya: { id: dto.partiyaId } as Partiya,
            collection: { id: item.collectionId } as any,
            factoryPricePerKv: item.factoryPricePerKv,
            overheadPerKv: item.overheadPerKv,
          });
          const saved = await repo.save(created);
          results.push(saved);
        }
      }

      return results;
    });
  }

  /**
   * Validation helper used by partiya-close flow: throws if any of the given
   * collection ids does not yet have a PartiyaCollectionPrice row for this partiya.
   */
  async assertAllCollectionsPriced(partiyaId: string, collectionIds: string[]): Promise<void> {
    if (collectionIds.length === 0) return;

    const rows = await this.repo.find({
      where: {
        partiya: { id: partiyaId },
        collection: { id: In(collectionIds) },
      },
      relations: { collection: true },
    });

    const pricedIds = new Set(rows.map((r) => r.collection?.id));
    const missing = collectionIds.filter((id) => !pricedIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Partiya yopib bo'lmaydi: quyidagi collection(lar) uchun narx kiritilmagan: ${missing.join(', ')}`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('PartiyaCollectionPrice not found');
    }
    await this.repo.delete(id);
  }
}
