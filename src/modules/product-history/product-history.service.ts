import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductHistory } from './product-history.entity';
import { CreateProductHistoryDto } from './dto/create-product-history.dto';
import { Product } from '../product/product.entity';

@Injectable()
export class ProductHistoryService {
  constructor(
    @InjectRepository(ProductHistory)
    private historyRepo: Repository<ProductHistory>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) {
  }

  async create(dto: CreateProductHistoryDto): Promise<ProductHistory> {
    const product = await this.productRepo.findOneByOrFail({ id: dto.productId });

    const history = this.historyRepo.create({
      action: dto.action,
      product,
    });

    return this.historyRepo.save(history);
  }

  async findByProduct(productId: string): Promise<ProductHistory[]> {
    return this.historyRepo.find({
      where: { product: { id: productId } },
      order: { createdAt: 'DESC' },
    });
  }
}