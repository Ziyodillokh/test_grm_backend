import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { QrBase } from './qr-base.entity';
import { CreateQrBaseDto, UpdateQrBaseDto, QueryQrBaseDto } from './dto';

@Injectable()
export class QrBaseService {
  constructor(
    @InjectRepository(QrBase)
    private readonly qrBaseRepository: Repository<QrBase>,
  ) {}

  async findAll(
    options: IPaginationOptions,
    query: QueryQrBaseDto,
  ): Promise<Pagination<QrBase>> {
    const where: any = {};

    if (query.is_active !== undefined) {
      where.is_active = query.is_active === 'true';
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.code = ILike(`%${query.search}%`);
    }

    return paginate<QrBase>(this.qrBaseRepository, options, {
      order: { date: 'DESC' },
      where,
    });
  }

  async findOne(id: string): Promise<QrBase> {
    const entity = await this.qrBaseRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
    return entity;
  }

  async findByCode(code: string): Promise<QrBase | null> {
    return this.qrBaseRepository.findOne({ where: { code } });
  }

  async create(dto: CreateQrBaseDto): Promise<QrBase> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      throw new BadRequestException(`QrBase with code "${dto.code}" already exists`);
    }

    const entity = this.qrBaseRepository.create(dto as unknown as QrBase);
    return this.qrBaseRepository.save(entity);
  }

  async update(id: string, dto: UpdateQrBaseDto): Promise<QrBase> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.qrBaseRepository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const result = await this.qrBaseRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
  }

  async restore(id: string): Promise<void> {
    const result = await this.qrBaseRepository.restore(id);
    if (result.affected === 0) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
  }

  // -----------------------------------------------------------------------
  // Backward-compatible method aliases (old names used by legacy modules)
  // -----------------------------------------------------------------------

  /** @deprecated use findByCode */
  async getOneByCode(code: string): Promise<QrBase | null> {
    return this.qrBaseRepository.findOne({
      where: { code },
      relations: { collection: true, model: true, size: true, color: true, shape: true, style: true, country: true, factory: true },
    });
  }

  /** @deprecated use findByCode */
  async getOneCode(code: string): Promise<QrBase | null> {
    return this.findByCode(code);
  }

  /** Mark QrBase as inactive */
  async changeInActive(id: string): Promise<void> {
    const qrBase = await this.findOne(id);
    qrBase.is_active = false;
    await this.qrBaseRepository.save(qrBase);
  }
}
