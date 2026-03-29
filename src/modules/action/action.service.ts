import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { ActionDescEnum, ActionTypeEnum } from 'src/infra/shared/enum';
import { Between, Equal, In, InsertResult, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Action } from './action.entity';
import { ActionRepository } from './action.repository';
import { Order } from '../order/order.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashFlowEnum } from '../../infra/shared/enum';
import { Kassa } from '../kassa/kassa.entity';
import { QrBase } from '../qr-base/qr-base.entity';

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: ActionRepository,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @InjectRepository(QrBase)
    private readonly qrBaseRepository: Repository<QrBase>,
  ) {}

  async getAll(options: IPaginationOptions, query?): Promise<Pagination<Action>> {
    let where = {};
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
    let to = new Date(query.endDate);
    let from = new Date(query.startDate);

    to.setHours(23, 59, 59, 999);
    from.setHours(0, 0, 0, 1);

    if (query.endDate && query.startDate) {
      where = {
        date: Between(from, to),
      };
    } else if (query.startDate) {
      where = {
        date: MoreThanOrEqual(from),
      };
    } else if (query.endDate) {
      where = {
        date: LessThanOrEqual(to),
      };
    }

    if (query.filialId && query.filialId != 'boss' && query.filialId != 'manager') {
      where = { ...where, user: { filial: { id: Equal(query.filialId) } } };
    } else if (query?.filialId?.toLowerCase() == 'boss') {
      where = { ...where, user: { role: 5 } };
    } else if (query?.filialId?.toLowerCase() == 'manager') {
      where = { ...where, user: { role: 3 } };
    }

    return paginate<Action>(this.actionRepository, options, {
      relations: { filial: true, user: { filial: true, position: true } },
      order: { date: 'DESC' },
      where,
    });
  }

  async create(data, user: string, filial, key: string, additional?: string): Promise<InsertResult> {
    const value = {
      user,
      ...(filial && { filial }),
      desc: ActionDescEnum[key],
      type: ActionTypeEnum[key],
      info: data,
    };

    if (additional) {
      value.desc = value.desc + ' ' + additional;
    }

    const response = await this.actionRepository
      .createQueryBuilder()
      .insert()
      .into(Action)
      .values(value as unknown as Action)
      .returning('id')
      .execute();

    return response;
  }

  async getOne(id: string) {
    return await this.actionRepository.findOne({ where: { id }, relations: { user: { position: true, filial: true } } });
  }

  async createArxive(startDate: Date, endDate: Date, filialId: string, kassaId: string) {
    const actions = await this.actionRepository.find({
      where: {
        date: Between(startDate, endDate),
        type: In(['order', 'order reject']),
        filial: { id: filialId },
      },
      relations: {
        user: { filial: true },
      },
    });

    for (const action of actions) {
      const info = action.info;
      const [kassa] = await this.kassaRepository.find({ where: { id: kassaId } });
      let [bar_code] = [null];

      let [bar_code_2] = await this.qrBaseRepository.find({ where: { id: info?.product?.bar_code?.id } });

      info?.product?.bar_code?.id && (bar_code = bar_code_2?.id || null);

      if (action.type === 'order' && kassa?.id && info?.kassa?.id === kassaId) {
        const existDate = await this.orderRepository.findOne({ where: { id: info.id } });
        if (existDate) {
          const [cashflow] = await this.cashflowRepository.find({
            where: {
              tip: CashflowTipEnum.ORDER,
              order: { id: existDate.id },
              type: CashFlowEnum.InCome,
            },
          });
          if (!cashflow) {
            const order = action.info;
            const cashflow = this.cashflowRepository.create({
              order: existDate.id,
              tip: CashflowTipEnum.ORDER,
              filial: order?.product?.filial?.id || action?.user?.filial?.id || null,
              type: CashFlowEnum.InCome,
              kassa: order.kassa.id,
              is_online: +order.plasticSum > 0,
              price: order.price,
              comment: order.comment,
              casher: action?.user?.id || null,
              cashflow_type: 'e2266555-7774-419e-9335-9ad817ea961c',
              date: order.kassa.startDate,
              x: order.x
            } as unknown as Cashflow);

            await this.cashflowRepository.save(cashflow);
          }
        } else {
          const newOrder = this.orderRepository.create({
            kassa: info.kassa.id,
            bar_code: bar_code,
            tip: CashflowTipEnum.ORDER,
            product: info.product.id,
            comment: info.comment,
            date: info.kassa.startDate,
            price: info.price,
            casher: action.user.id,
            plasticSum: info.plasticSum,
            discountSum: info.discountSum,
            netProfitSum: info.netProfitSum,
            discountPercentage: info.discountPercentage,
            additionalProfitSum: info.additionalProfitSum,
            status: info.status,
            seller: info.seller,
            isDebt: info.isDebt,
            kv: info.kv,
            x: info.x
          } as unknown as Order);
          const orderSaved = await this.orderRepository.save(newOrder);

          const order = action.info;
          const cashflow = this.cashflowRepository.create({
            order: orderSaved.id,
            tip: CashflowTipEnum.ORDER,
            filial: order?.product?.filial?.id || action?.user?.filial?.id || null,
            type: CashFlowEnum.InCome,
            kassa: order.kassa.id,
            is_online: +order.plasticSum > 0,
            price: (+order?.price + +order?.plasticSum) || 0,
            comment: order.comment,
            casher: action?.user?.id || null,
            cashflow_type: 'e2266555-7774-419e-9335-9ad817ea961c',
            date: order.kassa.startDate,
          } as unknown as Cashflow);

          await this.cashflowRepository.save(cashflow);
        }
      }
      else if (action.type === 'order reject' && kassa?.id && info?.kassa?.id === kassaId) {
        const existDate = await this.orderRepository.findOne({ where: { id: info.id } });
        if (existDate) {
          const [cashflow] = await this.cashflowRepository.find({
            where: {
              tip: CashflowTipEnum.ORDER,
              order: { id: existDate.id },
              type: CashFlowEnum.Consumption,
            },
          });

          if (!cashflow) {
            const order = action.info;
            const cashflow = this.cashflowRepository.create({
              order: existDate.id,
              tip: CashflowTipEnum.ORDER,
              filial: order?.product?.filial?.id || action?.user?.filial?.id || null,
              type: CashFlowEnum.Consumption,
              kassa: order.kassa.id,
              is_online: +order.plasticSum > 0,
              price: order.price,
              comment: order.comment,
              casher: action?.user?.id || null,
              cashflow_type: 'e2266555-7774-419e-9335-9ad817ea961c',
              date: order.kassa.startDate,
            } as unknown as Cashflow);

            await this.cashflowRepository.save(cashflow);
          }
        }
        else {
          const newOrder = this.orderRepository.create({
            kassa: info.kassa.id,
            bar_code: bar_code,
            tip: CashflowTipEnum.ORDER,
            product: info.product.id,
            comment: info.comment,
            date: info.kassa.startDate,
            price: info.price,
            casher: action.user.id,
            plasticSum: info.plasticSum,
            discountSum: info.discountSum,
            netProfitSum: info.netProfitSum,
            discountPercentage: info.discountPercentage,
            additionalProfitSum: info.additionalProfitSum,
            status: info.status,
            seller: info.seller,
            isDebt: info.isDebt,
            kv: info.kv,
          } as unknown as Order);
          const orderSaved = await this.orderRepository.save(newOrder);

          const order = action.info;
          const cashflow = this.cashflowRepository.create({
            order: orderSaved.id,
            tip: CashflowTipEnum.ORDER,
            filial: order?.product?.filial?.id || action?.user?.filial?.id || null,
            type: CashFlowEnum.Consumption,
            kassa: order.kassa.id,
            is_online: +order.plasticSum > 0,
            price: order.price,
            comment: order.comment,
            casher: action?.user?.id || null,
            cashflow_type: 'e2266555-7774-419e-9335-9ad817ea961c',
            date: order.kassa.startDate,
          } as unknown as Cashflow);

          await this.cashflowRepository.save(cashflow);
        }
      }

      await this.actionRepository.update({ id: action.id }, { is_done: true });
    }

    return { done: actions.length };
  }
}
