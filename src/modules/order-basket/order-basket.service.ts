import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderBasket } from './order-basket.entity';
import { Repository, UpdateResult } from 'typeorm';
import { createOrderBasketDto, orderBasketUpdateDto } from './dto';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CollectionPriceService } from '../collection-price/collection-price.service';
import { CollectionPriceEnum, UserRoleEnum } from '../../infra/shared/enum';
import { QrCodeService } from '../qr-code/qr-code.service';
import { QrBaseService } from '../qr-base/qr-base.service';

function isBooleanString(value: any): boolean {
  return value === 'true' || value === 'false';
}

@Injectable()
export class OrderBasketService {
  constructor(
    @InjectRepository(OrderBasket)
    private readonly orderBasketRepository: Repository<OrderBasket>,
    private readonly collectionPrice: CollectionPriceService,
    private readonly qrCodeService: QrCodeService,
    private readonly qrBaseService: QrBaseService,
  ) {}

  async find(
    user: User,
    options: IPaginationOptions,
    where: {
      is_transfer: string;
      filial: string;
    },
  ): Promise<Pagination<OrderBasket>> {
    return paginate<OrderBasket>(this.orderBasketRepository, options, {
      where: {
        ...(user.position.role === UserRoleEnum.F_MANAGER && { product: { filial: { id: user.filial.id } } }),
        ...(user.position.role !== UserRoleEnum.F_MANAGER && { seller: { id: user.id } }),
        ...(isBooleanString(where.is_transfer) && { is_transfer: JSON.parse(where.is_transfer) }),
        ...(where.filial && { product: { filial: { id: where.filial } } }),
      },
      relations: {
        seller: { avatar: true },
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
  }

  async findAll(user: User) {
    const baskets = await this.orderBasketRepository.find({
      where: {
        seller: { id: user.id },
        is_transfer: false,
      },
      relations: {
        product: {
          filial: true,
          bar_code: { size: true, style: true, color: true, model: true, collection: { collection_prices: true } },
        },
        seller: true,
      },
    });

    for (const basket of baskets) {
      basket.product.collection_price = await this.collectionPrice.getByCollectionAndFilial(
        basket.product.bar_code.collection.id,
        CollectionPriceEnum[user.filial.type],
        user.filial.id,
      );
    }

    return baskets;
  }

  async findForBookings(options: IPaginationOptions, where) {
    return paginate<OrderBasket>(this.orderBasketRepository, options, {
      where,
      relations: { seller: { avatar: true } },
    });
  }

  async findAllForTransfer(user: User) {
    const baskets = await this.orderBasketRepository.find({
      where: {
        seller: { id: user.id },
        is_transfer: true,
      },
      relations: {
        product: {
          filial: true,
          bar_code: { size: true, style: true, color: true, model: true, collection: { collection_prices: true } },
        },
      },
    });

    for (const basket of baskets) {
      basket.product.collection_price = await this.collectionPrice.getByCollectionAndFilial(
        basket.product.bar_code.collection.id,
        CollectionPriceEnum[user.filial.type],
        user.filial.id,
      );
    }

    return baskets;
  }

  async create(value: createOrderBasketDto, user: User) {
    if (![UserRoleEnum.SELLER, UserRoleEnum.OTHER].includes(user.position.role)) {
      throw new BadRequestException('Вы не можете бронировать товар!');
    }

    // if (user.filial.need_get_report) {
    //   throw new BadRequestException(`Sizda tugatilinmagan hisob kitob mavjud!`);
    // }

    let product: any = null;
    let qrCode: any = null;

    if (value.qr_code) {
      qrCode = await this.qrBaseService.getOneByCode(String(value.qr_code));

      if (qrCode) {
        console.log('qrCode===========>', qrCode);
        for (const item of qrCode.products) {
          const exists = await this.orderBasketRepository.findOne({
            where: { product: { id: item.id }, is_transfer: value.is_transfer },
          });

          if (!exists) {
            console.log('item==============>', item);
            product = item;
            break;
          }
        }

        if (!product) throw new BadRequestException('Продукт не найдена на QR Code!');
        value.product = product.id;
        delete value.qr_code;
      } else {
        qrCode = await this.qrCodeService.findOne((+value.qr_code as number) || -1);
        console.log('else =========>', qrCode);
        product = qrCode.product;
        value.qr_code = qrCode.id;
        value.product = product.id;
      }
    }

    if (value.product && !product) {
      const [pr] = await this.orderBasketRepository.query(`SELECT * FROM product WHERE id = $1`, [value.product]);
      console.log('pr============>', pr);
      if (!pr) throw new BadRequestException('Продукт не найдена!');
      product = pr;
    }

    if (!product) {
      throw new BadRequestException('Продукт не найдена!');
    }

    // Check product ownership
    console.log('product =============>', product);
    const userFilialId = user?.filial?.id;
    const productFilialId = product?.filial?.id || product?.filialId;

    if (user.position.role < 6 && userFilialId !== productFilialId) {
      throw new BadRequestException('Это не ваш продукт!');
    }

    // Fetch existing baskets
    const existingBaskets = await this.orderBasketRepository.find({
      where: { product: { id: value.product } },
    });
    console.log('existingBasket ================>', existingBaskets.length);
    // Quantity validation
    if (value.isMetric) {
      const total = existingBaskets.reduce((sum, b) => sum + b.x / 100, value.x / 100);
      if (product.y < value.x / 100 || product.y < total) {
        throw new BadRequestException('Недостаточно счетчика продукта!');
      }
    } else {
      const total = existingBaskets.reduce((sum, b) => sum + b.x, value.x);
      if (product.count < value.x || product.count < total) {
        throw new BadRequestException('Недостаточное количество товаров!');
      }
    }

    value.seller = user.id;

    const [oldBasket] = await this.orderBasketRepository.find({
      where: {
        seller: {
          id: user.id,
        },
        product: {
          id: value.product,
        },
        is_transfer: value.is_transfer,
      },
      relations: {
        product: {
          bar_code: {
            collection: true,
            model: true,
            color: true,
            size: true,
            style: true,
          },
        },
      },
    });

    const [biggest] = await this.orderBasketRepository.find({
      where: {
        seller: {
          id: user.id,
        },
        is_transfer: value.is_transfer,
      },
      order: { order_index: 'DESC' },
      take: 1,
    });

    if (oldBasket) {
      await this.orderBasketRepository.update(oldBasket.id, {
        x: value.x + oldBasket.x,
      });

      oldBasket.x += value.x;
      return oldBasket;
    } else {
      value.order_index = (biggest?.order_index || 0) + 1;
      const basket = this.orderBasketRepository.create(value as unknown as OrderBasket);
      await this.orderBasketRepository.save(basket);

      return this.orderBasketRepository.findOne({
        where: { id: basket.id },
        relations: {
          product: {
            bar_code: {
              collection: true,
              model: true,
              color: true,
              size: true,
              style: true,
            },
          },
        },
      });
    }
  }

  async createMultiple(values: createOrderBasketDto[], user: User) {
    if (![UserRoleEnum.SELLER, UserRoleEnum.OTHER].includes(user.position.role)) {
      throw new BadRequestException('Вы не можете бронировать товар!');
    }

    if (user.filial.need_get_report) {
      throw new BadRequestException(`Sizda tugatilinmagan hisob kitob mavjud!`);
    }

    const results = [];

    for (const value of values) {
      let product: any = null;
      let qrCode: any = null;

      if (value.qr_code) {
        qrCode = await this.qrBaseService.getOneByCode(String(value.qr_code));

        if (qrCode) {
          for (const item of qrCode.products) {
            const exists = await this.orderBasketRepository.findOne({
              where: { product: { id: item.id } },
            });

            if (!exists) {
              product = item;
              break;
            }
          }

          if (!product) throw new BadRequestException('Продукт не найдена на QR Code!');
          value.product = product.id;
          delete value.qr_code;
        } else {
          qrCode = await this.qrCodeService.findOne((+value.qr_code as number) || -1);
          product = qrCode.product;
          value.qr_code = qrCode.id;
          value.product = product.id;
        }
      }

      if (value.product && !product) {
        const [pr] = await this.orderBasketRepository.query(`SELECT * FROM product WHERE id = $1`, [value.product]);
        if (!pr) throw new BadRequestException('Продукт не найдена!');
        product = pr;
      }

      if (!product) {
        throw new BadRequestException('Продукт не найдена!');
      }

      const userFilialId = user?.filial?.id;
      const productFilialId = product?.filial?.id || product?.filialId;

      if (user.position.role < 6 && userFilialId !== productFilialId) {
        throw new BadRequestException('Это не ваш продукт!');
      }

      const existingBaskets = await this.orderBasketRepository.find({
        where: { product: { id: value.product as string } },
      });

      if (value.isMetric) {
        const total = existingBaskets.reduce((sum, b) => sum + b.x / 100, value.x / 100);
        if (product.y < value.x / 100 || product.y < total) {
          throw new BadRequestException('Недостаточно счетчика продукта!');
        }
      } else {
        const total = existingBaskets.reduce((sum, b) => sum + b.x, value.x);
        if (product.count < value.x || product.count < total) {
          throw new BadRequestException('Недостаточное количество товаров!');
        }
      }

      value.seller = user.id;

      const [oldBasket] = await this.orderBasketRepository.find({
        where: {
          seller: { id: user.id },
          product: { id: value.product },
        },
        relations: {
          product: {
            bar_code: {
              collection: true,
              model: true,
              color: true,
              size: true,
              style: true,
            },
          },
        },
      });

      if (oldBasket) {
        await this.orderBasketRepository.update(oldBasket.id, {
          x: value.x + oldBasket.x,
        });
        oldBasket.x += value.x;
        results.push(oldBasket);
      } else {
        const basket = this.orderBasketRepository.create(value as unknown as OrderBasket);
        await this.orderBasketRepository.save(basket);

        const fullBasket = await this.orderBasketRepository.findOne({
          where: { id: basket.id },
          relations: {
            product: {
              bar_code: {
                collection: true,
                model: true,
                color: true,
                size: true,
                style: true,
              },
            },
          },
        });

        results.push(fullBasket);
      }
    }

    return results;
  }

  async delete(id: string) {
    await this.orderBasketRepository.delete(id);
    return await this.orderBasketRepository.query(`DELETE FROM order_basket WHERE id = $1`, [id]);

  }
  async restore(id: string) {
    return await this.orderBasketRepository.restore(id);
  }

  async bulkDelete(id: string) {
    await this.orderBasketRepository.delete({ seller: { id }, is_transfer: false });
    await this.orderBasketRepository.query(
      `DELETE FROM order_basket WHERE "sellerId" = $1 AND is_transfer = true`,
      [id],
    );

  }

  async update(id: string, value: orderBasketUpdateDto): Promise<UpdateResult> {
    const basket = await this.orderBasketRepository.findOne({ where: { id }, relations: { product: true } });
    if (basket.isMetric) {
      if (basket.product.y < value.x / 100) throw new BadRequestException('Can not change upper than product length!');
    } else {
      if (basket.product.count < value.x) throw new BadRequestException('Can not change upper than product count!');
    }
    return await this.orderBasketRepository.update(id, value);
  }

  async calcDiscount(price: number, user: User): Promise<string> {
    const baskets = await this.orderBasketRepository.find({
      where: {
        seller: { id: user.id },
      },
      relations: { product: true },
    });
    const totalSum = baskets.reduce(
      (acc, { product, isMetric, x }) => (isMetric ? acc + product.x * (x / 100) * product.price : acc + x * product.price),
      0,
    );

    if (price > totalSum) return '0%';
    return (((totalSum - price) / totalSum) * 100).toFixed(2) + '%';
  }

  async calcProduct(user: User) {
    const baskets = await this.orderBasketRepository.find({
      where: {
        seller: { id: user.id },
      },
      relations: { product: true },
    });
    return baskets.reduce(
      (acc, { product, isMetric, x }) => (isMetric ? acc + product.x * (x / 100) * product.price : acc + x * product.price),
      0,
    );
  }

  async CalcByProduct(product) {
    const baskets = await this.orderBasketRepository.find({
      where: {
        product: { id: product.id },
      },
      relations: { product: true },
    });
    return baskets.reduce((acc, { x }) => acc + x, 0);
  }

  async getCountsByUser(user){
    const transfer = await this.orderBasketRepository.count({
      where: {
        seller: {
          id: user.id
        },
        is_transfer: true
      }
    });

    const order = await this.orderBasketRepository.count({
      where: {
        seller: {
          id: user.id
        },
        is_transfer: false
      }
    })

    return {order, transfer};
  }
}
