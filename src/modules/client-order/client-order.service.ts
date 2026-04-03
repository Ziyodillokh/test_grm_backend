import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { ClientOrder, OrderStatusEnum, PaymentTypeEnum } from './client-order.entity';
import { ClientOrderItem } from '../client-order-item/client-order-item.entity';
import { CreateClientOrderDto, UpdateClientOrderDto } from './dto';
import { QrBase } from '../qr-base/qr-base.entity';
import { ProductStatus } from '../../common/enums/product-status.enum';
import { Product } from '../product/product.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Kassa } from '../kassa/kassa.entity';

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

        if (!product) {
          throw new BadRequestException(`Product with ID "${item.product}" not found`);
        }

        // Validate product is published
        if (product.status !== ProductStatus.PUBLISHED) {
          throw new BadRequestException(`Product "${product.code}" is not published for sale`);
        }

        // Validate stock availability
        const stockCount = await em.count(Product, {
          where: {
            bar_code: { id: item.product },
            is_deleted: false,
            count: 1, // at least 1 in stock
          },
        });
        if (stockCount === 0) {
          throw new BadRequestException(`Product "${product.code}" is out of stock`);
        }

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

  async update(id: string, dto: UpdateClientOrderDto, user?: any): Promise<ClientOrder> {
    const order = await this.repo.findOne({
      where: { id },
      relations: ['user', 'client_order_items', 'client_order_items.product', 'cashflow'],
    });
    if (!order) throw new NotFoundException('ClientOrder not found');

    const oldStatus = order.order_status;
    const newStatus = dto.order_status || oldStatus;

    Object.assign(order, dto);
    const saved = await this.repo.save(order);

    // DONE → Cashflow yaratish
    if (newStatus === OrderStatusEnum.DONE && oldStatus !== OrderStatusEnum.DONE) {
      await this.createCashflowForOrder(saved, user);
    }

    // DONE dan boshqaga → Cashflow o'chirish
    if (oldStatus === OrderStatusEnum.DONE && newStatus !== OrderStatusEnum.DONE) {
      await this.removeCashflowForOrder(saved);
    }

    return saved;
  }

  private async createCashflowForOrder(order: ClientOrder, user?: any): Promise<void> {
    const em = this.repo.manager;
    const price = order.totalPrice;
    const isOnline = order.payment_type === PaymentTypeEnum.PAYME;

    // User ning filialidan ochiq kassani topish
    const filialId = user?.filial?.id;
    const kassa = await em.findOne(Kassa, {
      where: {
        isActive: true,
        ...(filialId && { filial: { id: filialId } }),
      },
      order: { startDate: 'DESC' },
    });
    if (!kassa) return;

    // Cashflow yaratish
    const cashflow = em.create(Cashflow, {
      price,
      type: 'Приход' as any,
      tip: 'cashflow' as any,
      title: `Интернет заказ #${order.sequence}`,
      comment: `Client order #${order.sequence}`,
      is_online: isOnline,
      kassa: { id: kassa.id },
      status: 'approved' as any,
    } as any);

    const saved = await em.save(Cashflow, cashflow);

    // Kassa totallariga qo'shish
    kassa.income = (kassa.income || 0) + price;
    kassa.sale = (kassa.sale || 0) + price;
    if (isOnline) kassa.plasticSum = (kassa.plasticSum || 0) + price;
    else kassa.in_hand = (kassa.in_hand || 0) + price;
    await em.save(Kassa, kassa);

    // ClientOrder ga cashflow bog'lash
    await em.update(ClientOrder, order.id, { cashflow: { id: saved.id } } as any);
  }

  private async removeCashflowForOrder(order: ClientOrder): Promise<void> {
    const em = this.repo.manager;
    if (!order.cashflow?.id) return;

    const cashflow = await em.findOne(Cashflow, {
      where: { id: order.cashflow.id },
      relations: ['kassa'],
    });
    if (!cashflow) return;

    // Kassa totallaridan ayirish
    const kassa = cashflow.kassa;
    if (kassa) {
      kassa.income = (kassa.income || 0) - cashflow.price;
      kassa.sale = (kassa.sale || 0) - cashflow.price;
      if (cashflow.is_online) kassa.plasticSum = (kassa.plasticSum || 0) - cashflow.price;
      else kassa.in_hand = (kassa.in_hand || 0) - cashflow.price;
      await em.save(Kassa, kassa);
    }

    // Cashflow hard delete
    await em.update(ClientOrder, order.id, { cashflow: null } as any);
    await em.delete(Cashflow, cashflow.id);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.repo.remove(order);
  }
}
