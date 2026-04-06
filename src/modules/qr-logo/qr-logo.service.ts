import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import * as QRCode from 'qrcode';

import { QrLogo } from './qr-logo.entity';
import { CreateQrLogoDto, UpdateQrLogoDto, QueryQrLogoDto } from './dto';

@Injectable()
export class QrLogoService {
  constructor(
    @InjectRepository(QrLogo)
    private readonly repo: Repository<QrLogo>,
  ) {}

  async create(dto: CreateQrLogoDto): Promise<QrLogo> {
    const qrDataUrl = await QRCode.toDataURL(dto.link, {
      width: 300,
      margin: 0,
      color: { dark: '#000000', light: '#00000000' },
    });

    const entity = this.repo.create({
      link: dto.link,
      description: dto.description || null,
      qrDataUrl,
    });

    return this.repo.save(entity);
  }

  async findAll(
    options: IPaginationOptions,
    query: QueryQrLogoDto,
  ): Promise<Pagination<QrLogo>> {
    const where: any = {};

    if (query.is_active !== undefined) {
      where.is_active = query.is_active === 'true';
    }

    return paginate<QrLogo>(this.repo, options, {
      order: { createdAt: 'DESC' },
      where,
    });
  }

  async findOne(id: string): Promise<QrLogo> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('QR Logo not found');
    return entity;
  }

  async update(id: string, dto: UpdateQrLogoDto): Promise<QrLogo> {
    const entity = await this.findOne(id);

    if (dto.link && dto.link !== entity.link) {
      entity.qrDataUrl = await QRCode.toDataURL(dto.link, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      entity.link = dto.link;
    }

    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.is_active !== undefined) entity.is_active = dto.is_active;

    return this.repo.save(entity);
  }

  async toggleStatus(id: string): Promise<QrLogo> {
    const entity = await this.findOne(id);
    entity.is_active = !entity.is_active;
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.softRemove(entity);
  }

  async getRandomActive(): Promise<QrLogo | null> {
    const entity = await this.repo
      .createQueryBuilder('qr_logo')
      .where('qr_logo.is_active = :active', { active: true })
      .andWhere('qr_logo.deletedDate IS NULL')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();

    return entity || null;
  }
}
