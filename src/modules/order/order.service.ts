import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import {
  Between,
  DataSource,
  EntityManager,
  Equal,
  FindOptionsWhere,
  InsertResult,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';

import { Order } from './order.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { CreateProductDto } from '../product/dto';
import { ProductService } from '../product/product.service';
import { KassaService } from '../kassa/kassa.service';
import { ActionService } from '../action/action.service';
import { CashFlowEnum, CashflowStatusEnum } from 'src/infra/shared/enum';
import { CashflowService } from '../cashflow/cashflow.service';
import { Product } from '../product/product.entity';
import { GRMGateway } from '../web-socket/web-socket.gateway';
import { FilialService } from '../filial/filial.service';
import { OrderBasketService } from '../order-basket/order-basket.service';
import { User } from '../user/user.entity';
import { calcProdProfit } from './utils/functions';
import { TransferService } from '../transfer/transfer.service';
import { UserRoleEnum } from '../../infra/shared/enum';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashflowTypeService } from '../cashflow-type/cashflow-type.service';
import { SellerReportService } from '../seller-report/seller-report.service';
import * as dayjs from 'dayjs';
import { Client } from '../client/client.entity';
import { ClientService } from '../client/client.service';
import { OrderEnum } from '@infra/shared/enum';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
//
@Injectable()

export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(forwardRef(() => GRMGateway))
    private readonly grmGetaway: GRMGateway,
    private readonly productService: ProductService,
    @Inject(forwardRef(() => KassaService))
    private readonly kassaService: KassaService,
    private readonly actionService: ActionService,
    @Inject(forwardRef(() => CashflowService))
    private readonly cashFlowService: CashflowService,
    private readonly cashFlowTypeService: CashflowTypeService,
    private readonly connection: DataSource,
    private readonly entityManager: EntityManager,
    private readonly filialService: FilialService,
    private readonly orderBasketService: OrderBasketService,
    private readonly transferService: TransferService,
    private readonly sellerReportService: SellerReportService,
    private readonly clientService: ClientService,
    private readonly dataSource: DataSource,
  ) {
  }

  async getAll(options: IPaginationOptions, where?: FindOptionsWhere<Order>): Promise<Pagination<Order>> {
    return paginate<Order>(this.orderRepository, options, {
      relations: {
        seller: true,
        product: {
          collection_price: true,
          bar_code: {
            model: true,
            collection: true,
            color: true,
            size: true,
            shape: true,
            style: true,
          },
          filial: true,
        },
        kassa: true,
      },
      where,
      order: { date: 'DESC' },
    });
  }

  async getById(id: string) {
    const data = await this.orderRepository
      .findOne({
        where: { id },
        relations: {
          casher: true,
          seller: true,
          product: {
            bar_code: {
              model: true,
              collection: true,
              color: true,
            },
            filial: true,
          },
          kassa: true,
        },
      })
      .catch(() => {
        throw new NotFoundException('Ma\'lumot topilmadi');
      });
    return data;
  }

  async getByUser(userId: string, options: IPaginationOptions, filters?: { month?: number; year?: number }) {
    const year = filters?.year ?? dayjs().year();
    const month = filters?.month;

    let dateFilter = {};
    if (month) {
      const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
        .startOf('month')
        .toDate();
      const endDate = dayjs(startDate).endOf('month').toDate();

      dateFilter = {
        date: Between(startDate, endDate),
      };
    }

    return paginate(this.orderRepository, options, {
      where: {
        seller: { id: userId },
        ...dateFilter,
      },
      order: {
        date: 'desc',
      },
      relations: {
        product: {
          bar_code: {
            color: true,
            shape: true,
            size: true,
          },
        },
      },
    });
  }

  async getByKassa(id: string, options: IPaginationOptions, where?: FindOptionsWhere<Order>) {
    return paginate<Order>(this.orderRepository, options, {
      relations: {
        seller: { avatar: true },
        bar_code: true,
        product: {
          collection_price: true,
          bar_code: {
            model: true,
            collection: {
              collection_prices: true,
            },
            color: true,
            size: true,
            shape: true,
            style: true,
            country: true,
          },
          filial: true,
        },
        kassa: true,
      },
      where: {
        ...where,
        kassa: { id },
      },
      order: { date: 'DESC' },
    });
  }

  async getByKassaWithCach(id: string) {
    const data = await this.orderRepository
      .find({
        relations: { kassa: true, casher: true, seller: true, product: true },
        where: { kassa: { id } },
        order: { date: 'desc' },
      })
      .catch(() => {
        throw new NotFoundException('Ma\'lumot topilmadi');
      });
    const dataCashflow = await this.cashFlowService.getByKassa(id);

    return [data, dataCashflow];
  }

  async deleteOne(id: string) {
    return await this.orderRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        relations: { kassa: true, product: { bar_code: true } },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (OrderEnum.Accept === order.status) {
        const kassa = await this.kassaService.getById(order.kassa.id);

        if (order.x) {
          kassa.totalSize = kassa.totalSize - order.x * order.product.y;
        } else {
          kassa.totalSize = kassa.totalSize - order.product.x * order.product.y;
        }

        kassa.plasticSum = kassa.plasticSum - order.plasticSum;
        kassa.additionalProfitTotalSum = kassa.additionalProfitTotalSum - order.additionalProfitSum;
        kassa.netProfitTotalSum = kassa.netProfitTotalSum - order.netProfitSum;

        await manager.save(kassa);
      }

      const product = order.product;
      if (product.bar_code.isMetric) {
        if (order.x) {
          product.x += order.x;
        }
      } else {
        product.count += order.x;
      }

      await manager.save(product);

      const result = await manager.softDelete(Order, id);

      if (result.affected === 0) {
        throw new NotFoundException('Buyurtma topilmadi yoki allaqachon o\'chirilgan');
      }

      return result;
    });
  }

  async restore(id: string) {
    return await this.orderRepository.manager.transaction(async (manager) => {
      // find soft delete order
      const order = await manager.findOne(Order, {
        where: { id },
        relations: { kassa: true, product: { bar_code: true } },
        withDeleted: true,
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!order.deletedDate) {
        throw new BadRequestException('Buyurtma allaqachon faol');
      }

      const product = order.product;
      if (product.bar_code.isMetric) {
        if (order.x && product.x < order.x) {
          throw new BadRequestException('Tiklash uchun mahsulot yetarli emas');
        }
      } else {
        if (product.count < 1) {
          throw new BadRequestException('Mahsulot tugagan');
        }
      }

      await manager.restore(Order, id);

      if (OrderEnum.Accept === order.status) {
        const kassa = await this.kassaService.getById(order.kassa.id);

        if (order.x) {
          kassa.totalSize = kassa.totalSize + order.x * order.product.y;
        } else {
          kassa.totalSize = kassa.totalSize + order.product.x * order.product.y;
        }

        kassa.plasticSum = kassa.plasticSum + order.plasticSum;
        kassa.additionalProfitTotalSum = kassa.additionalProfitTotalSum + order.additionalProfitSum;
        kassa.netProfitTotalSum = kassa.netProfitTotalSum + order.netProfitSum;

        await manager.save(kassa);
      }

      if (product.bar_code.isMetric) {
        if (order.x) {
          product.x -= order.x;
        }
      } else {
        product.count -= order.x;
      }

      await manager.save(product);

      const restoredOrder = await manager.findOne(Order, {
        where: { id },
        relations: { kassa: true, product: { bar_code: true } },
      });

      return restoredOrder;
    });
  }

  async change(value: UpdateOrderDto, id: string) {
    if (value.price) {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: { kassa: true, product: { bar_code: { size: true }, collection_price: true } },
      });
      const kassa = await this.kassaService.getById(order.kassa.id);

      if (order.product.bar_code.isMetric) {
        if (value.x) {
          value.additionalProfitSum =
            value.price - (order.product?.collection_price?.priceMeter || 0) * value.x * order.product.y;
        }
      } else {
        value.additionalProfitSum =
          value.price - (order.product?.collection_price?.priceMeter || 0) * order.product.bar_code.size.kv;
      }

      if (order.status === OrderEnum.Accept) {
        kassa.additionalProfitTotalSum = kassa.additionalProfitTotalSum - order.additionalProfitSum;
        kassa.additionalProfitTotalSum = kassa.additionalProfitTotalSum + value.additionalProfitSum;

        if (value.plasticSum) {
          kassa.plasticSum = kassa.plasticSum - order.plasticSum;
          kassa.plasticSum = kassa.plasticSum + value.plasticSum;
        }

        await this.saveRepo(kassa);
      }
    }
    return await this.orderRepository
      .createQueryBuilder()
      .update()
      .set(value as unknown as Order)
      .where('id = :id', { id })
      .execute();
  }

  async create(value: CreateOrderDto, id: string) {
    const product = await this.productService.getOne(value.product);
    let additionalProfitSum, netProfitSum;
    if (product.count < 1) {
      throw new HttpException('Mahsulot yetarli emas', HttpStatus.BAD_REQUEST);
    }
    const user = await this.entityManager
      .getRepository('users')
      .findOne({ where: { id: id }, relations: { filial: true, position: true } })
      .catch(() => {
        throw new BadRequestException('Foydalanuvchi topilmadi!');
      });

    if (user.filial.need_get_report) {
      throw new BadRequestException(`Sizda tugatilinmagan hisob kitob mavjud!`);
    }

    let filial = user?.filial?.id;
    if (user.position.role > UserRoleEnum.F_MANAGER) {
      filial = product.filial.id;
    }
    let kassa: any = await this.kassaService.GetOpenKassa(filial);
    if (!kassa) {
      kassa = await this.kassaService.create({ filial });
    }

    if (filial !== product.filial.id) {
      throw new BadRequestException('Siz ishlamayotgan filialda mahsulot sota olmaysiz!');
    }

    if (value.isMetric) {
      if (product.y < value.x / 100) throw new BadRequestException('Mahsulot metri yetarli emas!');
      const cost = value.x / 100;
      product.y = product.y - cost;
      // product.setTotalSize();
      // product.calculateProductPrice();
      additionalProfitSum =
        value.price +
        (value?.plasticSum || 0) -
        (product?.collection_price?.priceMeter || 0) * (cost * product.bar_code.size.x);
      netProfitSum = ((product?.collection_price?.priceMeter || 0) - product.comingPrice) * cost * product.bar_code.size.x;
      value.kv = cost * product.bar_code.size.x;
    } else {
      if (product.count < value.x) throw new BadRequestException('Mahsulot soni yetarli emas!');
      product.count = +product.count - +value.x;
      // product.setTotalSize();
      additionalProfitSum =
        value.price + (value?.plasticSum || 0) - (product?.collection_price?.priceMeter || 0) * product.bar_code.size.kv;
      netProfitSum = ((product?.collection_price?.priceMeter || 0) - product.comingPrice) * product.bar_code.size.kv;
      value.kv = product.bar_code.size.kv * value.x;
    }

    product.bar_code.isMetric = value.isMetric;
    await this.saveRepo(product);

    const data = {
      ...value,
      seller: id,
      additionalProfitSum,
      netProfitSum,
      kassa: value.kassa || kassa.id,
      bar_code: product.bar_code.id,
    };

    const insertResult = await this.orderRepository
      .createQueryBuilder()
      .insert()
      .into(Order)
      .values(data as unknown as Order)
      .returning('*')
      .execute();

    const cashflow_type = await this.cashFlowTypeService.getOneBySlug('order');
    await this.cashFlowService.createPending({
      tip: CashflowTipEnum.ORDER,
      order: insertResult.identifiers[0].id,
      cashflow_type: cashflow_type.id,
      kassa: data.kassa,
      type: CashFlowEnum.InCome,
      price: value.price + (value.plasticSum || 0),
      seller: id,
    }, id);

    return insertResult;
  }

  async createWithBasket(
    price: number,
    plasticSum: number,
    user: User,
    comment: string,
    isDebt?: boolean,
    clientId?: string,
  ): Promise<InsertResult> {
    return await this.entityManager.transaction(async (manager) => {
      if (!user.filial) {
        throw new BadRequestException('Sotish uchun foydalanuvchi filialga biriktirilgan bo\'lishi kerak.');
      }

      // if (user.filial.need_get_report) {
      //   throw new BadRequestException(`Sizda tugatilinmagan hisob kitob mavjud!`);
      // }

      if (isDebt && plasticSum > 0) {
        throw new BadRequestException('Qarzni yopish uchun plastik summa qo\'sha olmaysiz!');
      }
      const totalPrice = price + plasticSum;
      const kassa = await this.kassaService.GetOpenKassa(user.filial.id);
      const sellerReport = await this.sellerReportService.getCurrentReport(user);

      const baskets = await this.orderBasketService.findAll(user);
      if (!baskets.length) {
        throw new BadRequestException('Savatda mahsulot mavjud emas.');
      }

      const orderBaskets = calcProdProfit(baskets, totalPrice, plasticSum);
      const productMap = await this.loadProducts(orderBaskets);

      this.ensureStockAvailability(orderBaskets, productMap);
      const orders = await Promise.all(
        orderBaskets.map((basket) =>
          this.prepareOrderFromBasket(basket, productMap.get(basket.product), {
            sellerId: user.id,
            kassaId: kassa.id,
            reportId: sellerReport.id,
            comment,
            isDebt,
            clientId,
          }),
        ),
      );

      const orderRepository = manager.getRepository(Order);
      const savedOrders = await orderRepository.save(orders as unknown as Order[], {
        chunk: Math.ceil(orders.length / 20),
      });

      const cashflow_type = await this.cashFlowTypeService.getOneBySlug('order');
      for (const savedOrder of savedOrders) {
        await this.cashFlowService.createPending({
          tip: CashflowTipEnum.ORDER,
          order: (savedOrder as any).id,
          cashflow_type: cashflow_type.id,
          kassa: kassa.id,
          type: CashFlowEnum.InCome,
          price: (savedOrder as any).price + ((savedOrder as any).plasticSum || 0),
          seller: user.id,
        }, user.id);
      }

      await this.orderBasketService.bulkDelete(user.id);

      return { generatedMaps: [], identifiers: [], raw: [1] };
    });
  }

  async checkOrder(id: string, casher: string, kassa_id?: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: {
        kassa: { filial: true },
        product: {
          bar_code: {
            model: true,
            collection: true,
            color: true,
            size: true,
          },
          filial: true,
        },
        seller: true,
        casher: true,
        bar_code: true,
        client: true,
      },
    });

    if (!order) {
      throw new BadRequestException(`Bu order mavjud emas!`);
    }

    if (order.status === OrderEnum.Accept)
      throw new BadRequestException('Allaqachon qabul qilingan!');

    if (!order?.product) {
      throw new BadRequestException(`Bu orderni mahsuloti mavjud emas!`);
    }

    if (!order?.product?.filial) {
      throw new BadRequestException(`Bu orderni mahsulotini filiali mavjud emas!`);
    }

    const kassa = await this.kassaService.getById(kassa_id || order.kassa.id);
    if (kassa_id) {
      order.date = kassa.endDate as unknown as string || order.date;
    }

    if (order.isDebt) {
      await this.clientRepository.update({ id: order.client.id }, { owed: order.client.owed + (order.price + order.plasticSum) });
    }

    const response = await this.orderRepository
      .createQueryBuilder()
      .update()
      .set({ status: OrderEnum.Accept, casher, date: order.date, kassa: kassa.id } as unknown as Order)
      .where('id = :id', { id })
      .execute();

    const pendingCashflow = await this.cashFlowService.findPendingByOrderId(id);
    if (pendingCashflow) {
      if (kassa_id) {
        await this.cashFlowService.updateCashflowKassa(pendingCashflow.id, kassa.id);
      }
      await this.cashFlowService.approveCashflow(pendingCashflow.id, casher);
    } else {
      // Fallback: create and approve immediately (for backward compatibility)
      const cashflow_type = await this.cashFlowTypeService.getOneBySlug('order');
      await this.cashFlowService.create(
        {
          tip: CashflowTipEnum.ORDER,
          order: id,
          cashflow_type: cashflow_type.id,
          kassa: kassa.id,
          casher: casher,
          type: CashFlowEnum.InCome,
          title: '',
          comment: '',
          price: order.price + order.plasticSum,
          report: null,
        },
        casher,
      );
    }

    const action = await this.actionService.create(
      {
        ...order,
        status: OrderEnum.Accept,
      },
      casher,
      order.kassa.filial.id,
      'accept_order',
    );
    await this.grmGetaway.Action(action.raw[0]?.id);
    await this.grmGetaway.sendBossOrder(order);

    return response;
  }

  async rejectOrder(id: string, casher: User) {
    const data = await this.orderRepository.findOne({
      where: { id },
      relations: { product: { bar_code: true }, kassa: { filial: true }, cashflow: true, client: true },
    });

    if (!data) {
      throw new BadRequestException(`Bu order mavjud emas!`);
    }

    if (!data?.product) {
      throw new BadRequestException(`Bu orderni mahsuloti mavjud emas!`);
    }

    if (!data?.kassa?.filial) {
      throw new BadRequestException(`Bu orderni mahsulotini filiali mavjud emas!`);
    }

    if (data.status === OrderEnum.Reject) throw new BadRequestException('Allaqachon rad etilgan');

    // REJECT faqat PENDING statusdagi orderlarni rad etishi mumkin
    if (data.status !== OrderEnum.Progress) {
      throw new BadRequestException('Faqat kutilayotgan (Progress) orderni rad etish mumkin!');
    }

    const product = data.product;

    // Stock qaytarish
    if (product.bar_code.isMetric) {
      product.y = Math.abs(+data.x) / 100 + Math.abs(product.y);
    } else {
      product.count += data.x;
    }

    product.is_deleted = false;
    product.deletedDate = null;
    await this.saveRepo(product);

    // PENDING cashflowlarni REJECTED qilish — hech qanday kassa/report ga yozilmaydi
    const cashflows = await this.cashFlowService.findByOrderId(id);
    for (const cf of cashflows) {
      if (cf.status === CashflowStatusEnum.PENDING) {
        await this.cashFlowService.rejectCashflow(cf.id);
      }
    }

    const action = await this.actionService.create(
      {
        ...data,
        status: OrderEnum.Reject,
      },
      casher.id,
      data.kassa.filial.id,
      'reject_order',
    );

    await this.grmGetaway.Action(action.raw[0].id);
    return await this.orderRepository.update({ id }, { status: OrderEnum.Reject });
  }

  async returnOrder(id: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: {
        product: {
          bar_code: {
            model: true,
            color: true,
            collection: true,
            size: true,
          },
          collection_price: true,
          filial: true,
          partiya: true,
        },
        kassa: true,
        seller: { avatar: true },
        bar_code: true,
      },
    });

    if (!order) {
      throw new BadRequestException(`Bu order mavjud emas!`);
    }

    if (!order?.product) {
      throw new BadRequestException(`Bu orderni mahsuloti mavjud emas!`);
    }

    if (!order?.product?.filial) {
      throw new BadRequestException(`Bu orderni mahsulotini filiali mavjud emas!`);
    }

    if (order.status === OrderEnum.Cancel) throw new BadRequestException('Allaqachon qaytarilgan!');

    // CANCEL faqat APPROVED (Accept) orderlarni qaytarishi mumkin
    if (order.status !== OrderEnum.Accept) {
      throw new BadRequestException('Faqat tasdiqlangan orderni qaytarish mumkin!');
    }

    // 1. Stock qaytarish
    order.product.is_deleted = false;
    order.product.deletedDate = null;
    await this.returnProduct(order.product, order.x, order.x);

    // 2. Yangi Расход cashflow yaratish (APPROVED statusda)
    const kassa = await this.kassaService.GetOpenKassa(order.product.filial.id);
    const returnCashflowType = await this.cashFlowTypeService.getOneBySlug('return');

    await this.cashFlowService.createReturnCashflow({
      price: order.price + order.plasticSum,
      kassa: kassa.id,
      order: order.id,
      cashflow_type: returnCashflowType?.id,
      comment: 'Возврат',
      title: `${order?.product?.bar_code?.collection?.['title'] || ''} | ${order?.product?.bar_code?.model?.title || ''} | ${
        order?.product?.bar_code?.size?.title || ''
      } | x${order.x}`,
      in_hand_amount: order.price,
      kv: order.kv,
    }, userId);

    // 3. Order statusini Cancel qilish
    await this.orderRepository.update({ id: order.id }, { status: OrderEnum.Cancel });

    // 4. Asosiy cashflow (Приход) ni CANCELLED qilish
    const cashflows = await this.cashFlowService.findByOrderId(id);
    for (const cf of cashflows) {
      if (cf.status === CashflowStatusEnum.APPROVED && cf.type === CashFlowEnum.InCome) {
        await this.cashflowRepository.update({ id: cf.id }, { status: CashflowStatusEnum.CANCELLED });
      }
    }

    const action = await this.actionService.create(
      { ...order, status: OrderEnum.Cancel },
      userId,
      order.product.filial.id,
      'return_order',
    );

    await this.grmGetaway.Action(action.raw[0].id);

    return 'ok';
  }

  async addCashFlow(
    price: number,
    kassa: string,
    title: string,
    type: CashFlowEnum,
    id: string,
    comment?,
    order_id?: string,
  ) {
    const cashflow_type = await this.cashFlowTypeService.getOneBySlug('return');
    await this.cashFlowService.create(
      {
        price,
        comment: comment || 'Возврат товара',
        casher: '',
        kassa,
        title,
        type,
        order: order_id,
        tip: CashflowTipEnum.ORDER,
        cashflow_type: cashflow_type.id,
        report: null,
      },
      id,
    );
  }

  async returnProduct(product: Product, count: number, x?: number) {
    if (product?.bar_code?.isMetric) {
      await this.createCopyProduct(product, x / 100);
    } else {
      product.count += count;
      await this.connection.transaction(async (manager: EntityManager) => {
        await manager.save(product);
      });
    }
  }

  async saveRepo(data: any) {
    await this.connection.transaction(async (manager: EntityManager) => {
      await manager.save(data);
    });
  }

  async createCopyProduct(product: Product, x: number) {
    const newProduct: CreateProductDto = {
      bar_code: product.bar_code.id,
      code: product.code,
      count: 1,
      date: product.date,
      filial: product.filial.id,
      price: (product?.collection_price?.priceMeter || 0) * product.y * x,
      comingPrice: product.comingPrice,
      priceMeter: product?.collection_price?.priceMeter || 0,
      totalSize: x * product.bar_code.size.x * product.count,
      x: product.bar_code.size.x,
      y: x,
      partiya: product?.partiya?.id || null,
      secondPrice: product?.collection_price?.secondPrice || 0,
      collection_price: product?.collection_price?.id || null,
      partiya_title: product.partiya_title,
    };

    await this.productService.create([newProduct], true);
  }

  async getStats(query) {
    let result = this.entityManager
      .createQueryBuilder('Order', 'o')
      .select('DATE_TRUNC(\'day\', o.date)', 'day')
      .addSelect('SUM(o.kv)', 'kv')
      .addSelect('SUM(o.price)', 'price')
      .groupBy('day, o.date')
      .orderBy('o.date', 'DESC');

    if (query.startDate && query.endDate) {
      result.where('o.date >= :fromDate AND o.date <= :toDate', { fromDate: query.startDate, toDate: query.endDate });
    } else if (query.startDate) {
      result.where('o.date >= :fromDate', { fromDate: query.startDate });
    } else if (query.endDate) {
      result.where('o.date <= :toDate', { toDate: query.endDate });
    }
    if (query.filial) {
      result
        .leftJoin('o.product', 'product')
        .leftJoin('product.filial', 'filial')
        .andWhere('filial.id = :id', { id: query.filial });
    }

    return await result.getRawMany();
  }

  async acceptInternetShopOrder(value: CreateOrderDto, cashier: User, transferId: string) {
    const mutableValue = { ...value, product: await this.transferService.checkTransferManager(transferId, cashier.id) };
    const order = await this.create(mutableValue as any, cashier.id);
    await this.checkOrder(order.raw[0].id, cashier.id);
    return 'Ok';
  }

  async getDiscount(where) {
    const orders = await this.orderRepository.find({
      where: {
        ...where,
        additionalProfitSum: LessThan(0),
        status: Equal('accept'),
      },
    });

    return orders.reduce((acc, curr) => acc + curr.additionalProfitSum, 0);
  }

  async getAdditionalTotalProfitSumm(where) {
    const orders = await this.orderRepository.find({
      where: {
        ...where,
        additionalProfitSum: MoreThan(0),
        status: Equal('accept'),
      },
    });

    return orders.reduce((acc, curr) => acc + curr.additionalProfitSum, 0);
  }

  async getProfitSums(where) {
    function flattenWhereConditions(where, parentKey = '') {
      const result = {};
      for (const key in where) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (typeof where[key] === 'object' && where[key] !== null) {
          Object.assign(result, flattenWhereConditions(where[key], newKey));
        } else {
          result[newKey] = where[key];
        }
      }
      return result;
    }

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.product', 'product')
      .leftJoin('order.kassa', 'kassa')
      .leftJoin('product.filial', 'filial')
      .select('SUM(CASE WHEN order.additionalProfitSum < 0 THEN order.additionalProfitSum ELSE 0 END)', 'discountSum')
      .addSelect(
        'SUM(CASE WHEN order.additionalProfitSum > 0 THEN order.additionalProfitSum ELSE 0 END)',
        'additionalProfitTotalSum',
      )
      .addSelect('SUM(product.comingPrice * order.kv)', 'comingSum')
      .addSelect('SUM(product.priceMeter * order.kv)', 'additionalSum')
      .where(where);

    // Add other conditions from the `where` parameter
    // for (const key in where) {
    //   if (key === 'filial' && where[key].id) {
    //     queryBuilder.andWhere("filial.id = :filialId", { filialId: where[key].id });
    //   } else {
    //     // Flattening nested where conditions for other properties
    //     const flatWhere = flattenWhereConditions(where);
    //     for (const flatKey in flatWhere) {
    //       queryBuilder.andWhere(`${flatKey} = :${flatKey}`, { [flatKey]: flatWhere[flatKey] });
    //     }
    //   }
    // }

    const result = await queryBuilder.getRawOne();

    return {
      discountSum: parseFloat(result.discountSum) || 0,
      additionalProfitTotalSum: parseFloat(result.additionalProfitTotalSum) || 0,
      comingSumBase: parseFloat(result.comingSum) || 0,
      additionalSum: parseFloat(result['additionalSum']) || 0,
    };
  }

  async getCountOrdersShop(where) {
    const count = await this.orderRepository.count({
      where,
    });

    const countAll = await this.orderRepository.count();

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const countWeek = await this.orderRepository.count({
      where: {
        ...where,
        date: MoreThanOrEqual(lastWeek),
      },
    });

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const countMonth = await this.orderRepository.count({
      where: {
        ...where,
        date: MoreThanOrEqual(lastMonth),
      },
    });

    return {
      all: { count, percentage: count / (countAll / 100) },
      week: { count: countWeek, percentage: countWeek / (countAll / 100) },
      month: { count: countMonth, percentage: countMonth / (countAll / 100) },
    };
  }

  async getSellerStatsById(sellerId: string, startDate: string, endDate: string) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'orderCount')
      .addSelect('SUM(order.kv)', 'totalKv')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere('order.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getRawOne();

    return {
      orderCount: Number(result.orderCount || 0),
      totalKv: Number(result.totalKv || 0),
    };
  }

  async moveProcessOrdersToOpenKassa() {
    const orders = await this.orderRepository.find({
      where: { status: OrderEnum.Progress },
      relations: ['kassa', 'kassa.filial'],
    });

    for (const order of orders) {
      const filial = order.kassa?.filial;

      if (!filial || !filial.id) {
        console.warn(`Order ID ${order.id} filial not found`);
        continue;
      }

      const openKassa = await this.kassaService.getOpenKassaByFilialId(filial.id);

      if (!openKassa) {
        console.warn(`No open kassa found for filial ID: ${filial.id}`);
        continue;
      }

      // Faqat boshqa kassada bo‘lsa update qilamiz
      if (!order.kassa || order.kassa.id !== openKassa.id) {
        await this.orderRepository.update(order.id, {
          kassa: { id: openKassa.id },
        });

      }
    }

    return { message: 'Moved all progress orders to open kassas' };
  }

  async moveProcessOrdersByKassaId(kassaId: string) {
    // Step 1: Find the source kassa by the given ID
    const sourceKassa = await this.kassaService.getById(kassaId);
    if (!sourceKassa) {
      throw new Error(`Kassa with ID ${kassaId} not found`);
    }

    // Step 2: Get only the orders in 'Progress' status that belong to the given kassa
    const orders = await this.orderRepository.find({
      where: {
        status: OrderEnum.Progress,
        kassa: { id: kassaId },
      },
      relations: ['kassa', 'kassa.filial'],
    });

    // Step 3: If no such orders are found, return early
    if (orders.length === 0) {
      return { message: 'No orders found to move' };
    }

    // Step 4: Get the filial from one of the orders' kassas
    const filial = orders[0].kassa?.filial;
    if (!filial) {
      throw new Error(`Filial not found for kassa ID ${kassaId}`);
    }

    // Step 5: Find an open kassa within the same filial
    const openKassa = await this.kassaService.getOpenKassaByFilialId(filial.id);
    if (!openKassa) {
      throw new Error(`No open kassa found for filial ID ${filial.id}`);
    }

    // Step 6: If the open kassa is the same as the current one, no need to move orders
    if (openKassa.id === kassaId) {
      return { message: 'Source kassa is the only open kassa in this filial' };
    }

    const updatedOrderIds = [];

    // Step 7: Reassign each order to the open kassa and save the update
    for (const order of orders) {
      order.kassa = openKassa;
      const updatedOrder = await this.orderRepository.save(order);
      updatedOrderIds.push(updatedOrder.id);
    }

    // Step 8: Return summary of the update
    return {
      message: 'success',
      sourceKassaId: kassaId,
      targetKassaId: openKassa.id,
      filialId: filial.id,
      updatedOrderIds: updatedOrderIds,
      totalUpdated: updatedOrderIds.length,
    };
  }

  // Helpers:
  private async loadProducts(orderBaskets: any[]): Promise<Map<string, Product>> {
    const uniqueIds = [...new Set(orderBaskets.map((b) => b.product))];
    const products = await Promise.all(uniqueIds.map((id) => this.productService.getOne(id)));
    return new Map(products.map((p) => [p.id, p]));
  }

  private ensureStockAvailability(orderBaskets: any[], productMap: Map<string, Product>) {
    for (const basket of orderBaskets) {
      const product = productMap.get(basket.product);
      if (!product) throw new BadRequestException(`Product not found: ${basket.product}`);

      const available = basket.isMetric ? product.y : product.count;
      const availableBasket = basket.isMetric ? basket.x / 100 : basket.x;

      if (available < availableBasket) {
        throw new BadRequestException(`Insufficient stock for product ${product.code}`);
      }
    }
  }

  private async prepareOrderFromBasket(
    basket: any,
    product: Product,
    context: {
      sellerId: string;
      kassaId: string;
      reportId: string;
      comment?: string;
      isDebt?: boolean;
      clientId?: string;
    },
  ) {
    const size = product.bar_code.size;
    const collection = product.bar_code.collection?.collection_prices?.[0] || { priceMeter: 0, comingPrice: 0 };
    const priceMeter = +collection.priceMeter || 0;
    const comingPrice = product.comingPrice || +collection.comingPrice || 0;

    let kv = 0;
    let additionalProfitSum = 0;
    let netProfitSum = 0;

    if (basket.isMetric) {
      const meters = basket.x / 100;
      product.y -= meters;
      kv = meters * size.x;
    } else {
      product.count -= basket.x;
      kv = basket.x * size.kv;
    }

    const cost = kv * priceMeter;
    const revenue = basket.price + basket.plasticSum;

    additionalProfitSum = Math.max(revenue - cost, 0);
    if (cost > revenue) {
      netProfitSum = Math.max((priceMeter - comingPrice) * kv, 0);
    } else {
      netProfitSum = Math.max(revenue - (comingPrice * kv), 0);
    }

    if (product.y < 0.2 || product.count < 1) {
      product.is_deleted = true;
    }

    product.bar_code.isMetric = basket.isMetric;
    await this.saveRepo(product);

    return {
      product: basket.product,
      x: basket.x,
      kv,
      isMetric: basket.isMetric,
      price: basket.price,
      plasticSum: basket.plasticSum,
      discountSum: basket.discountSum,
      discountPercentage: basket.discountPercentage,
      seller: context.sellerId,
      kassa: context.kassaId,
      report: context.reportId,
      comment: context.comment || null,
      additionalProfitSum,
      netProfitSum,
      bar_code: product.bar_code.id,
      isDebt: !!context.isDebt, // 🟢 Shu yerda isDebt maydonini ham yozamiz
      client: context.isDebt && context.clientId ? { id: context.clientId } : null,
    };
  }

  async findDebtOrdersByClient(
    clientId: string,
    options: IPaginationOptions,
  ): Promise<{ client: Client; orders: Pagination<Order> }> {
    const client = await this.clientService.findOneByOwed(clientId);

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const orders = await paginate<Order>(this.orderRepository, options, {
      where: {
        isDebt: true,
        client: { id: clientId },
        status: OrderEnum.Accept,
      },
      relations: {
        seller: { avatar: true, filial: true },
        product: {
          bar_code: {
            model: true,
            collection: {
              collection_prices: true,
            },
            color: true,
            size: true,
            shape: true,
            style: true,
          },
        },
      },
      order: {
        date: 'ASC',
      },
    });

    return { client, orders };
  }

  async updateOrderPrice(filialId: string, startDate: string, endDate: string) {
    const filial = await this.filialService.getOne(filialId);

    if (!filial) {
      throw new Error('Filial topilmadi');
    }

    const orders = await this.orderRepository.find({
      where: {
        kassa: {
          filial: {
            id: filialId,
          },
        },
        date: Between(startDate, endDate),
      },
      relations: {
        kassa: {
          filial: true,
        },
        product: {
          bar_code: {
            collection: { collection_prices: true },
          },
        },
        cashflow: true,
      },
    });

    for (const order of orders) {
      let totalPrice = 0;
      let totalNetProfit = 0;

      if (order.product && order.product.bar_code && order.product.bar_code.collection) {
        const collection = order.product.bar_code.collection;

        const priceMeter = collection.collection_prices[0]?.priceMeter || 0;

        totalPrice = priceMeter * (order.kv || 0);

        let comingPrice = 0;

        if (order.product.comingPrice && order.product.comingPrice > 0) {
          comingPrice = order.product.comingPrice;
        } else if (collection.collection_prices[0]?.comingPrice && collection.collection_prices[0].comingPrice > 0) {
          comingPrice = collection.collection_prices[0].comingPrice;
        }

        if (comingPrice > 0) {
          totalNetProfit = (priceMeter - comingPrice) * (order.kv || 0);
        }
      }

      await this.orderRepository
        .createQueryBuilder()
        .update()
        .set({
          price: totalPrice,
          additionalProfitSum: 0,
          discountSum: 0,
          netProfitSum: totalNetProfit,
        } as unknown as Order)
        .where('id = :id', { id: order.id })
        .execute();

      await this.cashFlowService.updatePriceByOrderIdBulk(order.id, totalPrice);
    }

    return {
      success: true,
      message: `${orders.length} ta order va ularga tegishli cashflow'lar yangilandi`,
      updatedOrdersCount: orders.length,
    };
  }

  async returnOrders(kassa_id: string) {
    return await this.dataSource.transaction(async (manager) => {
      // === 1. Fetch orders ===
      const [acceptedOrders, otherOrders] = await Promise.all([
        this.orderRepository.find({
          where: { kassa: { id: kassa_id }, status: OrderEnum.Accept },
          relations: { product: { bar_code: true }, cashflow: true },
        }),
        this.orderRepository.find({
          where: { kassa: { id: kassa_id }, status: Not(OrderEnum.Accept) },
        }),
      ]);

      // === 2. Preprocess products ===
      const productsToUpdate = new Map<string, any>();

      for (const order of acceptedOrders) {
        const { product, x } = order;
        if (!product) continue;

        const existing = productsToUpdate.get(product.id) || product;

        if (product.bar_code?.isMetric) {
          existing.y = Math.abs(Number(existing.y)) + Math.abs(Number(x)) / 100;
        } else {
          existing.count = (Number(existing.count) || 0) + Number(x);
        }

        existing.deletedDate = null;
        existing.is_deleted = false;

        productsToUpdate.set(product.id, existing);
      }

      // === 3. Save products using entity target ===
      if (productsToUpdate.size > 0) {
        await manager.getRepository(this.productRepository.target).save(
          Array.from(productsToUpdate.values()),
        );
      }

      // === 4. Delete related cashflows ===
      const cashflowIds = acceptedOrders.map(o => o.cashflow.map(el => el.id)).flat(2);
      if (cashflowIds.length > 0) {
        await manager.getRepository(this.cashflowRepository.target).delete(cashflowIds);
      }

      // === 5. Delete accepted orders ===
      const acceptedOrderIds = acceptedOrders.map(o => o.id);
      if (acceptedOrderIds.length > 0) {
        await manager.getRepository(this.orderRepository.target).delete(acceptedOrderIds);
      }

      // === 6. Delete non-accepted orders ===
      const otherOrderIds = otherOrders.map(o => o.id);
      if (otherOrderIds.length > 0) {
        await manager.getRepository(this.orderRepository.target).delete(otherOrderIds);
      }

      return {
        updatedProducts: productsToUpdate.size,
        deletedOrders: acceptedOrders.length + otherOrders.length,
        deletedCashflows: cashflowIds.length,
      };
    });
  }
}
