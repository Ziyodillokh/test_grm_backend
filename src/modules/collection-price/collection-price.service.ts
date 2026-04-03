import { CreateCollectionPriceDto, UpdateCollectionPriceDto } from './dto';
import { CollectionPrice } from './collection-price.entity';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Discount } from '../discount/discount.entity';
import { CollectionPriceEnum, UserRoleEnum } from '@infra/shared/enum';

@Injectable()
export class CollectionPriceService {
  constructor(
    @InjectRepository(CollectionPrice)
    private readonly collectionPriceRepository: Repository<CollectionPrice>,
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  async findAll(page = 1, limit = 10): Promise<Pagination<CollectionPrice>> {
    return await paginate<CollectionPrice>(
      this.collectionPriceRepository,
      { page, limit },
      {
        relations: { collection: true, discounts: true },
        order: { date: 'DESC' },
      },
    );
  }

  async findOne(id: string): Promise<CollectionPrice> {
    const collectionPrice = await this.collectionPriceRepository.findOne({
      where: { id },
      relations: ['collection', 'discounts'],
    });
    if (!collectionPrice) {
      throw new NotFoundException('Collection price not found');
    }
    return collectionPrice;
  }

  async getByCollection(collection) {
    return await this.collectionPriceRepository.findOne({
      where: {
        collection: { id: collection },
      },
    });
  }

  async getByCollectionAndFilial(collection: string, type: CollectionPriceEnum, filial: string) {
    const query = {
      type,
      ...(type === CollectionPriceEnum.dealer && { dealer: { id: filial } }),
    };
    return await this.collectionPriceRepository.findOne({
      where: {
        collection: { id: collection },
        ...query,
      },
    });
  }

  async create(data: CreateCollectionPriceDto, user): Promise<CollectionPrice> {
    let type: CollectionPriceEnum;
    let whereCondition: any = { collection: { id: data.collectionId } };

    if (user.position.role === UserRoleEnum.DEALER) {
      type = CollectionPriceEnum.dealer;
      whereCondition.dealer = { id: user.filial.id };
    } else if (user.position.role === UserRoleEnum.M_MANAGER) {
      type = CollectionPriceEnum.filial;
      whereCondition.type = CollectionPriceEnum.filial;
    }

    const [existingPrice] = await this.collectionPriceRepository.find({ where: whereCondition });

    if (existingPrice) {
      throw new BadRequestException('У вас уже есть коллекционная цена!');
    }

    const collectionPrice = this.collectionPriceRepository.create({
      ...data,
      type,
      collection: { id: data.collectionId },
    });

    await this.productService.updateProdByCollection(data.collectionId, {
      comingPrice: data.comingPrice,
      secondPrice: data.secondPrice,
      priceMeter: data.priceMeter,
    });

    return await this.collectionPriceRepository.save(collectionPrice);
  }

  async update(id: string, data: UpdateCollectionPriceDto): Promise<CollectionPrice> {
    const collectionPrice = await this.collectionPriceRepository.findOne({
      where: { id },
      relations: {
        collection: true,
      },
    });

    if (!collectionPrice.id) {
      throw new NotFoundException('Collection price not found');
    }

    await this.productService.updateProdByCollection(collectionPrice.collection.id, {
      comingPrice: data.comingPrice,
      secondPrice: data.secondPrice,
      priceMeter: data.priceMeter,
    });

    const collection = { id: collectionPrice.collection.id };
    await this.collectionPriceRepository.update(id, { ...data, collection });
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const collectionPrice = await this.collectionPriceRepository.findOne({
      where: { id },
      relations: { collection: true },
    });
    await this.productService.updateProdByCollection(collectionPrice.collection.id, {
      comingPrice: 0,
      secondPrice: 0,
      priceMeter: 0,
    });
    await this.collectionPriceRepository.delete(id);
  }

  async getManyByCollectionIds(ids: string[]) {
    return await this.collectionPriceRepository.find({ where: { id: In(ids) } });
  }

  async createOrUpdatePrice(datas: CreateCollectionPriceDto[], user, dealer) {
    console.log('log multiple create or update: =========>', { datas, user, dealer });
    const type = user.position.role === UserRoleEnum.M_MANAGER ? CollectionPriceEnum.filial : user.position.role === UserRoleEnum.DEALER ? CollectionPriceEnum.dealer : user.position.role === UserRoleEnum.I_MANAGER ? CollectionPriceEnum.market : null;
    if(!type)
      throw new BadRequestException('Malumot topilmadi!');

    for (const data of datas) {
      const collectionPrice = await this.collectionPriceRepository.findOne({
        where: {
          collection: { id: data.collectionId },
          type,
          ...(dealer && user.position.role !== UserRoleEnum.M_MANAGER && { dealer }),
        },
        relations: { discounts: true },
      });

      if (collectionPrice) {
        await this.collectionPriceRepository.update(
          { id: collectionPrice.id },
          {
            comingPrice: data.comingPrice,
            priceMeter: data.priceMeter,
            ...(data.secondPrice !== undefined && { secondPrice: data.secondPrice }),
          },
        );

        if (Array.isArray(collectionPrice.discounts)) {
          for (const discount of collectionPrice.discounts) {
            discount.isAdd = false;
            await this.collectionPriceRepository.manager.save(discount);
          }
        }
      } else {
        const insertResult = await this.collectionPriceRepository
          .createQueryBuilder()
          .insert()
          .into(CollectionPrice)
          .values({
            type,
            priceMeter: data.priceMeter,
            comingPrice: data.comingPrice,
            collection: { id: data.collectionId },
            ...(dealer && user.position.role !== UserRoleEnum.M_MANAGER && { dealer }),
          })
          .returning('id')
          .execute();

        const newCollectionPriceId = insertResult.raw[0].id;
        const newCollectionPrice = await this.collectionPriceRepository.findOne({
          where: { id: newCollectionPriceId },
          relations: { discounts: true },
        });
        if (Array.isArray(newCollectionPrice?.discounts)) {
          for (const discount of newCollectionPrice.discounts) {
            discount.isAdd = false;
            await this.collectionPriceRepository.manager.save(discount);
          }
        }
      }
    }
  }

  async setDiscountToCollectionPrice(
    collectionPriceId: string,
    discountId: string,
    isAdd: boolean,
  ): Promise<CollectionPrice> {
    const collectionPrice = await this.collectionPriceRepository.findOne({
      where: { id: collectionPriceId },
      relations: { discounts: true },
    });
    if (!collectionPrice) throw new NotFoundException('Collection price not found');

    const discount = await this.discountRepository.findOne({ where: { id: discountId } });
    if (!discount) throw new NotFoundException('Discount not found');

    const originalPrice = collectionPrice.priceMeter / (1 - (discount.discountPercentage || 0) / 100);

    if (isAdd) {
      const newPrice = collectionPrice.priceMeter * (1 - discount.discountPercentage / 100);
      collectionPrice.priceMeter = Number(newPrice.toFixed(2));
      discount.isAdd = true;

      if (!collectionPrice.discounts.some((d) => d.id === discount.id)) {
        collectionPrice.discounts.push(discount);
      }
    } else {
      discount.isAdd = false;
      collectionPrice.priceMeter = Number(originalPrice.toFixed(2));
      collectionPrice.discounts = collectionPrice.discounts.filter((d) => d.id !== discount.id);
    }

    await this.discountRepository.save(discount);
    await this.collectionPriceRepository.save(collectionPrice);

    return collectionPrice;
  }
}
