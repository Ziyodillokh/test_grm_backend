import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { KassaService } from '../kassa/kassa.service';
import { FilialService } from '../filial/filial.service';
import { ProductService } from '../product/product.service';
import { CollectionService } from '../collection/collection.service';
import { ClientOrderService } from '../client-order/client-order.service';
import { paginateArray } from 'src/infra/helpers';
import { EntityManager } from 'typeorm';
import { OrderCashflowDto } from './dto';
import { OrderService } from '../order/order.service';

@Injectable()
export class AccountingService {
  constructor(
    private readonly kassaService: KassaService,
    @Inject(forwardRef(()=> FilialService))
    private readonly filialService: FilialService,
    private readonly productService: ProductService,
    private readonly collectionService: CollectionService,
    private readonly clientOrderService: ClientOrderService,
    private readonly orderService: OrderService,
    private readonly entityManager: EntityManager,
  ) {}

  async getRemainingProducts(query) {
    const data = await this.productService.getRemainingProductsForAllFilial(query);
    const remainingSize = data.map((p) => p.remainingSize).reduce((a, b) => a + b);
    const remainingSum = data.map((p) => p.remainingSum).reduce((a, b) => a + b);
    return { remainingSize, remainingSum };
  }

  async getRemainingProductsByCollection(query) {
    return await this.collectionService.remainingProductsByCollection(query);
  }

  async getInternetShopSum(where) {
    const qb = this.entityManager
      .getRepository('order')
      .createQueryBuilder('order')
      .leftJoin('order.product', 'product')
      .leftJoin('order.kassa', 'kassa')
      .leftJoin('kassa.filial', 'filial')
      .select('COALESCE(SUM(order.price + order.plastic), 0)', 'internetShopSum')
      .where('product.isInternetShop = :isInternetShop', { isInternetShop: true })
      .andWhere('order.status IN (:...statuses)', { statuses: ['accepted', 'returned'] });

    if (where?.filial) {
      qb.andWhere('filial.id = :filial', { filial: where.filial });
    }

    if (where?.startDate && where?.endDate) {
      const from = new Date(where.startDate);
      const to = new Date(where.endDate);
      from.setHours(0, 0, 0, 1);
      to.setHours(23, 59, 59, 999);
      qb.andWhere('order.date BETWEEN :startDate AND :endDate', { startDate: from, endDate: to });
    } else if (where?.startDate) {
      const from = new Date(where.startDate);
      from.setHours(0, 0, 0, 1);
      qb.andWhere('order.date >= :startDate', { startDate: from });
    } else if (where?.endDate) {
      const to = new Date(where.endDate);
      to.setHours(23, 59, 59, 999);
      qb.andWhere('order.date <= :endDate', { endDate: to });
    }

    const result = await qb.getRawOne();
    return { internetShopSum: Number(result?.internetShopSum) || 0 };
  }

  async getTotal() {
    const result = await this.entityManager
      .getRepository('kassa_report')
      .createQueryBuilder('kr')
      .select('COALESCE(SUM(kr.totalPlasticSum), 0)', 'terminal')
      .addSelect('COALESCE(SUM(kr.totalSale), 0)', 'summ')
      .where('kr.status != :status', { status: 'closed' })
      .getRawOne();

    return {
      terminal: Number(result?.terminal) || 0,
      summ: Number(result?.summ) || 0,
    };
  }

  async getKassaActions(where: OrderCashflowDto) {
    const query = { endDate: where?.endDate, startDate: where?.startDate };
    if (!query.endDate) {
      let tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      query.endDate = tomorrow;
    }
    if (!query.startDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      query.startDate = today;
    }
    let from = new Date(query.startDate);
    let to = new Date(query.endDate);

    from.setHours(0, 0, 0, 1);
    to.setHours(23, 59, 59, 999);

    const order = this.entityManager
      .getRepository('order')
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.seller', 'createdBy')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.kassa', 'kassa')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('model.collection', 'collection')
      .leftJoin('kassa.filial', 'filial')
      .where('order.isActive != :progres', { progres: 'progress' });

    const cashflow = this.entityManager
      .getRepository('cashflow')
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('cashflow.kassa', 'kassa')
      .leftJoin('kassa.filial', 'filial');

    if (where.type === 'income') {
      order.where('LOWER(order.isActive) LIKE LOWER(:progres)', { progres: '%ccep%' });
      cashflow.where('LOWER(cashflow.type) LIKE LOWER(:progres)', { progres: '%их%' });
    }

    if (where.type === 'expense') {
      order.where('LOWER(order.isActive) LIKE LOWER(:type)', { type: '%ejec%' });
      cashflow.where('LOWER(cashflow.type) LIKE LOWER(:type)', { type: '%сх%' });
    }

    if (where.filial) {
      order.andWhere('filial.id = :filial', { filial: where.filial });
      cashflow.andWhere('filial.id = :filial', { filial: where.filial });
    }

    if (where.endDate && where.startDate) {
      order.andWhere('order.date BETWEEN :startDate AND :endDate', { startDate: from, endDate: to });
      cashflow.andWhere('cashflow.date BETWEEN :startDate AND :endDate', { startDate: from, endDate: to });
    } else if (where.startDate) {
      order.andWhere('order.date >= :startDate', { startDate: from });
      cashflow.andWhere('cashflow.date >= :startDate', { startDate: from });
    } else if (where.endDate) {
      order.andWhere('order.date <= :endDate', { endDate: to });
      cashflow.andWhere('cashflow.date <= :endDate', { endDate: to });
    }

    const orders = await order.getManyAndCount();
    const cashflows = await cashflow.getManyAndCount();

    const items = paginateArray([...orders[0], ...cashflows[0]], where.page, where.limit);
    const result = {
      items: items,
      meta: {
        totalItems: orders[1] + cashflows[1],
        itemCount: items.length,
        itemsPerPage: where?.limit,
        totalPages: Math.ceil((orders[1] + cashflows[1]) / where.limit),
        currentPage: where.page,
      },
    };

    return result;
  }
}
