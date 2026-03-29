import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PartiyaStatus } from './partiya-status.entity';
import { Repository } from 'typeorm';
import { CreatePartiyaStatusDto } from './dto';
import { PartiyaStatusEnum } from '../../infra/shared/enum';

@Injectable()
export class PartiyaStatusService {
  constructor(
    @InjectRepository(PartiyaStatus)
    private readonly repository: Repository<PartiyaStatus>,
  ) {
  }

  async getAll() {
    return await this.repository.find({
      order: {
        title: 'ASC',
      },
    });
  }

  async getOne(id: string) {
    return await this.repository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Partiya status not found');
      });
  }

  async getOneBySlug(slug: PartiyaStatusEnum) {
    return await this.repository
      .findOne({
        where: { slug },
      })
      .catch(() => {
        throw new NotFoundException('Partiya status not found');
      });
  }

  async deleteOne(id: string) {
    return await this.repository.delete(id).catch(() => {
      throw new NotFoundException('Data not found');
    });
  }

  async create(value: CreatePartiyaStatusDto) {
    const data = this.repository.create(value);
    return await this.repository.save(data);
  }

  async change(value, id: string) {
    return await this.repository.update({ id }, value);
  }
}
