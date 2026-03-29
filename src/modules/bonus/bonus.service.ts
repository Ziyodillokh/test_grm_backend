import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { UpdateBonusDto } from './dto/update-bonus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Bonus } from './bonus.entity';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class BonusService {
  constructor(
    @InjectRepository(Bonus)
    private readonly bonusRepository: Repository<Bonus>,
  ) {}

  async create(dto: CreateBonusDto): Promise<Bonus> {
    const bonus = this.bonusRepository.create(dto);
    return await this.bonusRepository.save(bonus);
  }

  async findAll(options: IPaginationOptions): Promise<Pagination<Bonus>> {
    const queryBuilder = this.bonusRepository.createQueryBuilder('bonus');
    queryBuilder.leftJoinAndSelect('bonus.payroll_items', 'payroll_items');
    return paginate<Bonus>(queryBuilder, options);
  }

  async findOne(id: string): Promise<Bonus> {
    const bonus = await this.bonusRepository.findOne({
      where: { id },
      relations: ['payroll_items'],
    });
    if (!bonus) throw new NotFoundException(`Bonus with id ${id} not found`);
    return bonus;
  }

  async update(id: string, dto: UpdateBonusDto): Promise<Bonus> {
    await this.bonusRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.bonusRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Bonus with id ${id} not found`);
    }
  }
  async restore(id: string): Promise<void> {
    const result = await this.bonusRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Bonus with id ${id} not found`);
    }
  }
}
