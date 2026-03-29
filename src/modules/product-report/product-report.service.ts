import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '@modules/product/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductReportService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {
  }

  async getAllProductKv(){
    return await this.productRepository.query('');
  }
}