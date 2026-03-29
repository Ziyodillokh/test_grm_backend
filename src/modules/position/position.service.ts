import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { CreatePositionDto, UpdatePositionDto } from './dto';
import { Position } from './position.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  async getAll(
    options: IPaginationOptions,
    where?: FindOptionsWhere<Position>,
  ): Promise<Pagination<Position>> {
    return paginate<Position>(this.positionRepository, options, {
      order: {
        title: 'ASC',
      },
      where: {
        ...(where.title && { title: ILike(`%${where.title}%`) }),
      },
    });
  }

  async getOne(id: string) {
    const data = await this.positionRepository
      .findOne({
        where: { id },
      })
      .catch(() => {
        throw new NotFoundException('Position not found');
      });

    return data;
  }

  async getOneByRole(role: number) {
    return await this.positionRepository
      .findOne({
        where: { role },
      })
      .catch(() => {
        throw new NotFoundException('Position not found');
      });
  }

  async deleteOne(id: string) {
    const response = await this.positionRepository.delete(id).catch(() => {
      throw new NotFoundException('Position not found');
    });
    return response;
  }

  async change(value: UpdatePositionDto, id: string) {
    const response = await this.positionRepository.update({ id }, value);
    return response;
  }

  async create(value: CreatePositionDto) {
    const data = this.positionRepository.create(value);
    return await this.positionRepository.save(data);
  }
}
