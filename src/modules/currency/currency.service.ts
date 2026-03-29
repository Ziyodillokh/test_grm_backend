import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './currency.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
  ) {
  }

  async paginate(options: IPaginationOptions): Promise<Pagination<Currency>> {
    const queryBuilder = this.currencyRepository.createQueryBuilder('currency');
    queryBuilder.orderBy('currency.date', 'DESC');
    return await paginate(queryBuilder, options);
  }

  async create(createCurrencyDto: CreateCurrencyDto): Promise<Currency> {
    const currency = this.currencyRepository.create(createCurrencyDto);
    return await this.currencyRepository.save(currency);
  }

  async findOne(id: string): Promise<Currency> {
    const currency = await this.currencyRepository.findOne({ where: { id } });
    if (!currency) throw new NotFoundException(`Currency with id ${id} not found`);
    return currency;
  }

  async update(id: string, updateDto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findOne(id);
    const updated = Object.assign(currency, updateDto);
    return await this.currencyRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const currency = await this.findOne(id);
    await this.currencyRepository.remove(currency);
  }
}
