import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { QrBase } from './qr-base.entity';
import { CreateQrBaseDto, UpdateQrBaseDto, QueryQrBaseDto } from './dto';
import UpdateInternetInfo from './dto/internet-info-update.dto';
import { CountryService } from '../country/country.service';
import { CollectionService } from '../collection/collection.service';
import { ColorService } from '../color/color.service';
import { ShapeService } from '../shape/shape.service';
import { SizeService } from '../size/size.service';
import { StyleService } from '../style/style.service';
import { ModelService } from '../model/model.service';
import { FactoryService } from '../factory/factory.service';

@Injectable()
export class QrBaseService {
  private readonly logger = new Logger(QrBaseService.name);

  constructor(
    @InjectRepository(QrBase)
    private readonly qrBaseRepository: Repository<QrBase>,
    private readonly countryService: CountryService,
    private readonly collectionService: CollectionService,
    private readonly colorService: ColorService,
    private readonly shapeService: ShapeService,
    private readonly sizeService: SizeService,
    private readonly styleService: StyleService,
    private readonly modelService: ModelService,
    private readonly factoryService: FactoryService,
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
    const entity = await this.qrBaseRepository.findOne({
      where: { id },
      relations: {
        collection: true,
        color: true,
        model: true,
        size: true,
        shape: true,
        style: true,
        country: true,
        factory: true,
        imgUrl: true,
        videoUrl: true,
      },
    });
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
  // Internet Shop / I-Market methods
  // -----------------------------------------------------------------------

  /** Full relations used for internet shop queries */
  private readonly iMarketRelations = {
    collection: true,
    color: true,
    model: true,
    size: true,
    shape: true,
    style: true,
    country: true,
    factory: true,
    imgUrl: true,
    videoUrl: true,
    other_images: true,
  };

  /**
   * GET /qr-base/i-market — list QrBase with full relations for internet shop.
   * Supports filters: status, search, is_active.
   */
  async findAllIMarket(
    options: IPaginationOptions,
    query: QueryQrBaseDto,
  ): Promise<Pagination<QrBase>> {
    const where: FindOptionsWhere<QrBase> = {};

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.is_active !== undefined) {
      where.is_active = query.is_active === 'true';
    }

    if (query.search) {
      where.code = ILike(`%${query.search}%`);
    }

    return paginate<QrBase>(this.qrBaseRepository, options, {
      order: { date: 'DESC' },
      where,
      relations: this.iMarketRelations,
    });
  }

  /**
   * GET /qr-base/i-market/:id — get single QrBase with full relations (returns array for frontend compatibility).
   */
  async findOneIMarket(id: string): Promise<QrBase[]> {
    const entity = await this.qrBaseRepository.findOne({
      where: { id },
      relations: this.iMarketRelations,
    });
    if (!entity) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
    return [entity];
  }

  /**
   * POST /qr-base/internet-shop — create QrBase with internet shop fields.
   */
  async createInternetShop(dto: UpdateInternetInfo): Promise<QrBase> {
    const entity = this.qrBaseRepository.create({
      ...dto,
      imgUrl: dto.imgUrl ? { id: dto.imgUrl } : undefined,
      videoUrl: dto.videoUrl ? { id: dto.videoUrl } : undefined,
      collection: dto.collection ? { id: dto.collection } : undefined,
      color: dto.color ? { id: dto.color } : undefined,
      model: dto.model ? { id: dto.model } : undefined,
      size: dto.size ? { id: dto.size } : undefined,
      shape: dto.shape ? { id: dto.shape } : undefined,
      style: dto.style ? { id: dto.style } : undefined,
      country: dto.country ? { id: dto.country } : undefined,
      factory: dto.factory ? { id: dto.factory } : undefined,
    } as any);

    const saved = await this.qrBaseRepository.save(entity);
    const savedEntity = Array.isArray(saved) ? saved[0] : saved;
    return this.findOneWithRelations(savedEntity.id);
  }

  /**
   * PUT /qr-base/internet-shop/:id — update QrBase internet shop fields.
   */
  async updateInternetShop(id: string, dto: UpdateInternetInfo): Promise<QrBase> {
    const entity = await this.findOne(id);

    // Map UUID strings to relation objects
    const updateData: any = { ...dto };
    if (dto.imgUrl !== undefined) updateData.imgUrl = dto.imgUrl ? { id: dto.imgUrl } : null;
    if (dto.videoUrl !== undefined) updateData.videoUrl = dto.videoUrl ? { id: dto.videoUrl } : null;
    if (dto.collection !== undefined) updateData.collection = dto.collection ? { id: dto.collection } : null;
    if (dto.color !== undefined) updateData.color = dto.color ? { id: dto.color } : null;
    if (dto.model !== undefined) updateData.model = dto.model ? { id: dto.model } : null;
    if (dto.size !== undefined) updateData.size = dto.size ? { id: dto.size } : null;
    if (dto.shape !== undefined) updateData.shape = dto.shape ? { id: dto.shape } : null;
    if (dto.style !== undefined) updateData.style = dto.style ? { id: dto.style } : null;
    if (dto.country !== undefined) updateData.country = dto.country ? { id: dto.country } : null;
    if (dto.factory !== undefined) updateData.factory = dto.factory ? { id: dto.factory } : null;

    Object.assign(entity, updateData);
    await this.qrBaseRepository.save(entity);
    return this.findOneWithRelations(id);
  }

  /**
   * Find one QrBase with all internet shop relations loaded.
   */
  async findOneWithRelations(id: string): Promise<QrBase> {
    const entity = await this.qrBaseRepository.findOne({
      where: { id },
      relations: this.iMarketRelations,
    });
    if (!entity) {
      throw new NotFoundException(`QrBase with ID "${id}" not found`);
    }
    return entity;
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

  /**
   * Bulk create QR bases from Excel rows.
   * Each row: { code, collection, model, color, size, country, factory, shape, style, isMetric, count }
   */
  async createFromExcelRows(rows: any[]): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.code) {
        skipped++;
        continue;
      }

      const code = String(row.code).trim();

      // Resolve relations by name → ID
      const countryId = row.country ? await this.countryService.findOrCreate(String(row.country)) : null;
      const factoryId = row.factory ? await this.factoryService.findOrCreate(String(row.factory), countryId) : null;
      const collectionId = row.collection ? await this.collectionService.findOrCreate(String(row.collection), factoryId) : null;
      const modelId = row.model && collectionId ? await this.modelService.findOrCreate(collectionId, String(row.model)) : null;
      const colorId = row.color ? await this.colorService.findOrCreate(String(row.color)) : null;
      const sizeId = row.size ? await this.sizeService.findOrCreate(String(row.size)) : null;
      const shapeId = row.shape ? await this.shapeService.findOrCreate(String(row.shape)) : null;
      const styleId = row.style ? await this.styleService.findOrCreate(String(row.style)) : null;

      const relationData = {
        country: countryId ? { id: countryId } : null,
        factory: factoryId ? { id: factoryId } : null,
        collection: collectionId ? { id: collectionId } : null,
        model: modelId ? { id: modelId } : null,
        color: colorId ? { id: colorId } : null,
        size: sizeId ? { id: sizeId } : null,
        shape: shapeId ? { id: shapeId } : null,
        style: styleId ? { id: styleId } : null,
        isMetric: row.isMetric === true || row.isMetric === 'true',
      };

      const existing = await this.qrBaseRepository.findOne({ where: { code } });

      if (existing) {
        Object.assign(existing, relationData);
        await this.qrBaseRepository.save(existing);
        updated++;
      } else {
        const entity = this.qrBaseRepository.create({ code, ...relationData } as any);
        await this.qrBaseRepository.save(entity);
        created++;
      }
    }

    return { created, updated, skipped };
  }
}
