import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IPaginationOptions,
  paginate,
  Pagination,
} from 'nestjs-typeorm-paginate';
import { Repository, UpdateResult } from 'typeorm';

import { Transfer } from './transfer.entity';
import { CreateTransferDto, UpdateTransferDto } from './dto';
import { TransferStatus } from '../../common/enums';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
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

  async create(
    data: CreateTransferDto[],
    userId: string,
  ): Promise<Transfer[]> {
    const results: Transfer[] = [];

    for (const dto of data) {
      const transfer = this.transferRepository.create({
        ...dto,
        transferer: userId,
        progress: TransferStatus.PROGRESS,
      } as unknown as Transfer);

      const saved = await this.transferRepository.save(transfer);
      results.push(saved);
    }

    return results;
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

  async acceptTransfer(
    data: { from: string; to: string; include?: string[]; exclude?: string[] },
    user: any,
  ): Promise<void> {
    const qb = this.transferRepository
      .createQueryBuilder()
      .update()
      .set({
        progress: TransferStatus.ACCEPT,
        isChecked: true,
        cashier: user.id,
      })
      .where('"fromId" = :from AND "toId" = :to AND progres = :status', {
        from: data.from,
        to: data.to,
        status: TransferStatus.PROGRESS,
      });

    if (data.include?.length) {
      qb.andWhere('id IN (:...ids)', { ids: data.include });
    }
    if (data.exclude?.length) {
      qb.andWhere('id NOT IN (:...ids)', { ids: data.exclude });
    }

    await qb.execute();
  }

  async rejectTransfer(id: string, userId: string): Promise<void> {
    await this.transferRepository.update(id, {
      progress: TransferStatus.REJECT,
      cashier: userId,
    } as unknown as Transfer);
  }

  async remove(id: string): Promise<void> {
    const transfer = await this.transferRepository.findOne({ where: { id } });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    await this.transferRepository.delete(id);
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
}
