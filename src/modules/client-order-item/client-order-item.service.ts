import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientOrderItem } from './client-order-item.entity';
import { CreateClientOrderItemDto, UpdateClientOrderItemDto } from './dto';
import { Product } from '@modules/product/product.entity';
import { ClientOrder } from '@modules/client-order/client-order.entity';
import { paginate } from 'nestjs-typeorm-paginate';
import { QrBase } from '@modules/qr-base/qr-base.entity';
import { Filial } from '@modules/filial/filial.entity';

@Injectable()
export class ClientOrderItemService {
  constructor(
    @InjectRepository(ClientOrderItem)
    private readonly clientOrderItemRepo: Repository<ClientOrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ClientOrder)
    private readonly clientOrderRepo: Repository<ClientOrder>,
  ) {}

  async create(dto: CreateClientOrderItemDto, clientOrderId: string): Promise<ClientOrderItem> {
    const clientOrder = await this.clientOrderRepo.findOne({ where: { id: clientOrderId } });
    if (!clientOrder) throw new NotFoundException(`ClientOrder not found`);

    const entity = this.clientOrderItemRepo.create({
      count: dto.count,
      clientOrder,
    });

    return this.clientOrderItemRepo.save(entity);
  }

  async findAll(id: string, query: { page: number; limit: number }) {
    const result = await paginate(this.clientOrderItemRepo, query, {
      where: { clientOrder: { id } },
      relations: {
        product: {
          collection: true,
          model: true,
          size: true,
          style: true,
          factory: true,
          country: true,
          shape: true,
          color: true,
          imgUrl: true
        },
      },
    });

    // order item’lardan qrbaseId larni yig'amiz
    const qrBaseIds = Array.from(
      new Set(result.items.map(i => i.product?.id).filter(Boolean)),
    ) as string[];

    const rows = await this.getFilialsByQrBaseIds(qrBaseIds);

    // tez map qilish uchun: qrBaseId -> filials[]
    const map = new Map<string, { id: string; name: string; count: number }[]>();

    for (const r of rows) {
      const arr = map.get(r.qrBaseId) ?? [];
      arr.push({ id: r.id, name: r.name, count: Number(r.count) });
      map.set(r.qrBaseId, arr);
    }

    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        filials: map.get(item.product?.id) ?? [],
      })),
    };

  }

  async findOne(id: string): Promise<ClientOrderItem> {
    const entity = await this.clientOrderItemRepo.findOne({
      where: { id },
      relations: ['product', 'clientOrder'],
    });
    if (!entity) throw new NotFoundException(`ClientOrderItem not found`);
    return entity;
  }

  async update(id: string, dto: UpdateClientOrderItemDto): Promise<ClientOrderItem> {
    const entity = await this.findOne(id);
    entity.count = dto.count;
    return this.clientOrderItemRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.clientOrderItemRepo.remove(entity);
  }

  private async getFilialsByQrBaseIds(qrBaseIds: string[]) {
    if (!qrBaseIds.length) return [];

    return this.clientOrderItemRepo.manager
      .createQueryBuilder()
      .select('q.id', 'qrBaseId')
      .addSelect('f.id', 'id')
      .addSelect('f.name', 'name')
      .addSelect('SUM(p.count)', 'count')
      .from(QrBase, 'q')
      .innerJoin(Product, 'p', 'p."barCodeId" = q.id AND p.is_deleted = false')
      .innerJoin(Filial, 'f', 'f.id = p."filialId"')
      .where('q.id IN (:...qrBaseIds)', { qrBaseIds })
      .groupBy('q.id')
      .addGroupBy('f.id')
      .addGroupBy('f.name')
      .getRawMany<{
        qrBaseId: string;
        id: string;
        name: string;
        count: string; // raw keladi
      }>();
  }
}
