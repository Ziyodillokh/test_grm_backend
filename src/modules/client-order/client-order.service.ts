import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { ClientOrder } from './client-order.entity';
import { ClientOrderItem } from '../client-order-item/client-order-item.entity';
import { CreateClientOrderDto, UpdateClientOrderDto } from './dto';
import { QrBase } from '../qr-base/qr-base.entity';

@Injectable()
export class ClientOrderService {
  constructor(
    @InjectRepository(ClientOrder)
    private readonly repo: Repository<ClientOrder>,
    @InjectRepository(ClientOrderItem)
    private readonly itemRepo: Repository<ClientOrderItem>,
  ) {}

  async create(dto: CreateClientOrderDto): Promise<ClientOrder> {
    return this.repo.manager.transaction(async (em) => {
      if (!dto.client_order_items?.length) {
        throw new BadRequestException('Order items cannot be empty');
      }

      const order = em.create(ClientOrder, {
        ...dto,
        user: { id: dto.user },
      } as unknown as ClientOrder);

      await em.save(order);

      const items: ClientOrderItem[] = [];
      let totalPrice = 0;

      for (const item of dto.client_order_items) {
        if (item.count <= 0) {
          throw new BadRequestException('Count must be positive');
        }

        const product = await em.findOne(QrBase, { where: { id: item.product } });
        const itemPrice = product?.i_price ?? 0;

        const orderItem = em.create(ClientOrderItem, {
          count: item.count,
          product: { id: item.product },
          price: String(itemPrice),
          clientOrder: order,
        } as unknown as ClientOrderItem);

        totalPrice += itemPrice * item.count;
        items.push(orderItem);
      }

      await em.save(items);
      await em.update(ClientOrder, order.id, { totalPrice });

      return em.findOne(ClientOrder, {
        where: { id: order.id },
        relations: ['client_order_items', 'client_order_items.product'],
      });
    });
  }

  async findAll(
    options: IPaginationOptions,
  ): Promise<Pagination<ClientOrder>> {
    const qb = this.repo
      .createQueryBuilder('c_o')
      .leftJoinAndSelect('c_o.user', 'user')
      .orderBy('c_o.sequence', 'DESC');

    return paginate<ClientOrder>(qb, options);
  }

  async findAllByUser(
    userId: string,
    options: IPaginationOptions,
  ): Promise<Pagination<ClientOrder>> {
    return paginate(this.repo, options, {
      where: { user: { id: userId } },
      relations: {
        client_order_items: {
          product: {
            collection: true,
            model: true,
            size: true,
            factory: true,
            color: true,
            style: true,
            shape: true,
            country: true,
          },
        },
      },
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ClientOrder> {
    const order = await this.repo.findOne({
      where: { id },
      relations: ['user', 'client_order_items', 'client_order_items.product'],
    });

    if (!order) {
      throw new NotFoundException('ClientOrder not found');
    }

    return order;
  }

  async update(id: string, dto: UpdateClientOrderDto): Promise<ClientOrder> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    return this.repo.save(order);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.repo.remove(order);
  }
}
