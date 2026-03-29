// transfer-cache.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferCache } from './transfer-cache.entity';
import { CreateTransferCacheDto } from './dto/create-transfer-cache.dto';
import { UpdateTransferCacheDto } from './dto/update-transfer-cache.dto';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';

@Injectable()
export class TransferCacheService {
  constructor(
    @InjectRepository(TransferCache)
    private readonly cacheRepo: Repository<TransferCache>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
  }

  async create(dto: CreateTransferCacheDto): Promise<TransferCache> {
    const product = await this.productRepo.findOneBy({ id: dto.productId });
    const user = await this.userRepo.findOneBy({ id: dto.userId });

    if (!product || !user) throw new NotFoundException('Product or User not found');

    const cache = this.cacheRepo.create({ count: dto.count, product, user });
    return this.cacheRepo.save(cache);
  }

  findAll(): Promise<TransferCache[]> {
    return this.cacheRepo.find({ relations: ['product', 'user'] });
  }

  findOne(id: string): Promise<TransferCache> {
    return this.cacheRepo.findOne({ where: { id }, relations: ['product', 'user'] });
  }

  async update(id: string, dto: UpdateTransferCacheDto): Promise<TransferCache> {
    const cache = await this.cacheRepo.findOneBy({ id });
    if (!cache) throw new NotFoundException('TransferCache not found');

    if (dto.productId) {
      const product = await this.productRepo.findOneBy({ id: dto.productId });
      if (!product) throw new NotFoundException('Product not found');
      cache.product = product;
    }

    if (dto.userId) {
      const user = await this.userRepo.findOneBy({ id: dto.userId });
      if (!user) throw new NotFoundException('User not found');
      cache.user = user;
    }

    if (dto.count !== undefined) cache.count = dto.count;

    return this.cacheRepo.save(cache);
  }

  async remove(id: string): Promise<void> {
    const cache = await this.cacheRepo.findOneBy({ id });
    if (!cache) throw new NotFoundException('TransferCache not found');
    await this.cacheRepo.remove(cache);
  }

  // Custom function
  async checkAndDelete(productId: string, userId: string, count: number): Promise<boolean> {
    const cache = await this.cacheRepo.findOne({
      where: {
        product: { id: productId },
        user: { id: userId },
      },
      relations: ['product'],
    });

    if (!cache) throw new NotFoundException('TransferCache row not found');

    const product = await this.productRepo.findOne({ where: { id: productId }, relations: { bar_code: true } });
    if (!product) throw new NotFoundException('Product not found');

    if (product?.bar_code?.isMetric) {
      await this.cacheRepo.remove(cache);
      return true;
    }

    if (product.count < count) {
      await this.cacheRepo.remove(cache);
      return true;
    }

    return false; // don't delete
  }
}
