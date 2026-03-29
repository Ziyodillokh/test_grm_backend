import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { deleteFile } from '../../infra/helpers';
import { ILike, Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Filial } from '../filial/filial.entity';
import { Kassa } from '../kassa/kassa.entity';
import { User } from '../user/user.entity';
import { QrBase } from '../qr-base/qr-base.entity';
import { Product } from '../product/product.entity';
import { OrderEnum } from '../../infra/shared/enum';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';

@Injectable()
export class RestoreService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepo: Repository<Cashflow>,
    @InjectRepository(Filial)
    private readonly filialRepo: Repository<Filial>,
    @InjectRepository(Kassa)
    private readonly kassaRepo: Repository<Kassa>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(QrBase)
    private readonly qrBaseRepo: Repository<QrBase>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepo: Repository<CashflowType>,
    @InjectRepository(PackageTransfer)
    private readonly packageTransfer: Repository<PackageTransfer>,
  ) {
  }

  readExcelFile(path: string, page: string) {
    const workbook = XLSX.readFile(path);
    const worksheet = workbook.Sheets[page];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    deleteFile(path);

    return data;
  }

  async 'createOrder&cashflow'(datas) {
    let i = 0;
    for (const data of datas) {
      i++;
      console.log(i);
      const {
        price,
        plastic,
        tip,
        type,
        collection,
        model,
        size,
        color,
        count,
        discount,
        profit,
        country,
        filial,
        seller,
        cashier,
        comment,
        kassa,
        date,
        expense,
      } = data;
      const barcode = await this.qrBaseRepo.findOne({
        where: {
          collection: { title: ILike(`%${collection}%`) },
          size: { title: ILike(`${size}`) },
          model: { title: ILike(`${model}`) },
          ...(country && { country: { title: ILike(`%${country}%`) } }),
          ...(color && { color: { title: ILike(`%${color}%`) } }),
        },
        relations: {
          size: true,
        },
      });

      const isOrder = tip.toLowerCase() === 'order';
      const Filial = await this.filialRepo.findOne({ where: { title: ILike(`${filial}`) } });
      const Seller = await this.userRepo.findOne({
        where: {
          firstName: ILike(`%${seller?.split(' ')?.[0]}%`),
          lastName: ILike(`%${seller?.split(' ')?.[1]}%`),
        },
      });
      const Cashier = await this.userRepo.findOne({
        where: {
          firstName: ILike(`%${cashier?.split(' ')?.[0]}%`),
          lastName: ILike(`%${cashier?.split(' ')?.[1]}%`),
        },
      });
      const Kassa = await this.kassaRepo.findOne({ where: { id: kassa } });
      const [Cashflow_type] = await this.cashflowTypeRepo.find({ where: { title: ILike(tip) } });
      let [Product] = [null];

      if (barcode) {
        const [product] = await this.productRepo.find({
          where: {
            bar_code: { id: barcode?.id },
            filial: { id: Filial?.id },
          },
          order: {
            date: 'ASC',
          },
          take: 1,
        });

        Product = product;
      }

      console.log('Filial.ids', Filial?.id);
      console.log('Filial.id', Seller?.id);
      console.log('Cashier.id', Cashier?.id);
      console.log('Kassa.id', Kassa?.id);
      console.log('Cashflow_type?.id', Cashflow_type?.id);
      console.log('Product.id', Product?.id);
      console.log('barcode.id', barcode?.id);

      let Order;
      if (isOrder) {
        const order = {
          kassa: Kassa?.id,
          price: +price,
          isMetric: barcode?.isMetric,
          plasticSum: +plastic,
          product: Product?.id || null,
          x: count,
          kv: (barcode?.isMetric ? (count / 100) * barcode?.size?.x : barcode?.size?.kv * count) || 0,
          date,
          comment: comment,
          casher: Cashier?.id,
          seller: Seller?.id,
          additionalProfitSum: profit || 0,
          discountPercentage: 0,
          status: OrderEnum.Accept,
          discountSum: discount || 0,
          tip: 'order',
          bar_code: barcode?.id,
        };
        let newOrder = this.orderRepo.create(order as unknown as Order);
        Order = await this.orderRepo.save(newOrder);
      }
      console.log('Cashier.id', Order?.id);

      const cashflow = {
        tip: Order?.id ? CashflowTipEnum.ORDER : CashflowTipEnum.CASHFLOW,
        order: Order?.id || null,
        cashflow_type: Cashflow_type?.id || null,
        price: Number(price) + Number(plastic),
        comment: comment,
        kassa: Kassa?.id || null,
        casher: Cashier?.id || null,
        type,
        filial: Filial?.id || null,
        date,
      };

      const newCashflow = this.cashflowRepo.create(cashflow as unknown as Cashflow);
      await this.cashflowRepo.save(newCashflow);
    }
  }
}
