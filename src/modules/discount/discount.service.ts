import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from './discount.entity';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { Order } from '../order/order.entity';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async create(dto: CreateDiscountDto): Promise<Discount> {
    try {
      const discount = this.discountRepository.create({
        ...dto,
      });

      return await this.discountRepository.save(discount);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Discount with this title already exists');
      }
      throw error;
    }
  }

  async findAll(options: IPaginationOptions) {
    return await paginate<Discount>(this.discountRepository, options, {
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Discount> {
    const discount = await this.discountRepository.findOne({
      where: { id },
      relations: ['collectionPrices'],
    });

    if (!discount) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }

    return discount;
  }

  async update(id: string, updateDiscountDto: UpdateDiscountDto): Promise<Discount> {
    const discount = await this.findOne(id);

    try {
      const updatedDiscount = {
        ...discount,
        ...updateDiscountDto,
      };

      await this.discountRepository.save(updatedDiscount);
      return await this.findOne(id);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Discount with this title already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const discount = await this.findOne(id);
    await this.discountRepository.remove(discount);
  }

  async findByTitle(title: string): Promise<Discount | null> {
    return await this.discountRepository.findOne({
      where: { title },
    });
  }

  async getOrderByDiscount(discountId: string) {
    return await this.orderRepository
      .createQueryBuilder('order')
      .where('order.managerDiscountSum > 0')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('collection.collection_prices', 'collection_price')
      .leftJoinAndSelect('collection_price.discounts', 'discount')
      .andWhere('discount.id = :discountId', { discountId })
      .getMany();
  }
}
