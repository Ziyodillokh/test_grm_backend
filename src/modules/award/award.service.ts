import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Award } from './award.entity';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { paginate, Pagination, IPaginationOptions } from 'nestjs-typeorm-paginate';

@Injectable()
export class AwardService {
  constructor(
    @InjectRepository(Award)
    private readonly awardRepository: Repository<Award>,
  ) {}

  async create(dto: CreateAwardDto): Promise<Award> {
    const award = this.awardRepository.create(dto);
    return this.awardRepository.save(award);
  }

  async findAll(options: IPaginationOptions): Promise<Pagination<Award>> {
    const queryBuilder = this.awardRepository.createQueryBuilder('award');
    queryBuilder.leftJoinAndSelect('award.payroll_items', 'payroll_items');
    return paginate<Award>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Award> {
    const award = await this.awardRepository.findOne({
      where: { id },
      relations: ['payroll_items'],
    });
    if (!award) throw new NotFoundException(`Award with id ${id} not found`);
    return award;
  }

  async update(id: string, dto: UpdateAwardDto): Promise<Award> {
    await this.awardRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.awardRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Award with id ${id} not found`);
    }
  }

  async restore(id: string): Promise<void> {
    const result = await this.awardRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Award with id ${id} not found or not deleted`);
    }
  }
}
