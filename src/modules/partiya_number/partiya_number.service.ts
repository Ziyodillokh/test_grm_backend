import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartiyaNumber } from './partiya_number.entity';
import { CreatePartiyaNumDto, UpdatePartiyaNumDto } from './dto';
import { IPaginationOptions, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class PartiyaNumberService {
  constructor(
    @InjectRepository(PartiyaNumber)
    private readonly repository: Repository<PartiyaNumber>,
  ) {
  }

  async getAll(options: IPaginationOptions) {
    return paginate<PartiyaNumber>(this.repository, options, {
      order: { title: 'ASC' },
    });
  }

  async getOne(id: string) {
    return await this.repository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('partiya num not found');
      });
  }

  async deleteOne(id: string) {
    return await this.repository.delete(id).catch(() => {
      throw new NotFoundException('Size not found');
    });
  }

  async create(value: CreatePartiyaNumDto) {
    const data = this.repository.create(value);
    return await this.repository.save(data);
  }


  async change(value: UpdatePartiyaNumDto, id: string) {
    return await this.repository.update({ id }, value);
  }
}
