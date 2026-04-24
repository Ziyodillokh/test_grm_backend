import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FilialReport } from './filial-report.entity';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FilialService } from '../filial/filial.service';
import { CreateFilialReportDto } from './dto';
import { FilialReportStatusEnum } from '../../infra/shared/enum';
import { Product } from '@modules/product/product.entity';
import { Order } from '@modules/order/order.entity';
import { Transfer } from '@modules/transfer/transfer.entity';
import { OrderBasket } from '@modules/order-basket/order-basket.entity';
import { OrderEnum, PackageTransferEnum } from '@infra/shared/enum';
import progresEnum from '@infra/shared/enum/transfer-progres.enum';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { ReInventoryService } from '@modules/re-inventory/re-inventory.service';
import { Filial } from '@modules/filial/filial.entity';

@Injectable()
export class FilialReportService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FilialReport)
    private readonly filialReportRepository: Repository<FilialReport>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(OrderBasket)
    private readonly orderBasketRepository: Repository<OrderBasket>,
    @Inject(forwardRef(() => FilialService))
    private readonly filialService: FilialService,
    @Inject(forwardRef(() => ReInventoryService))
    private readonly reInventoryService: ReInventoryService,
  ) {
  }

  async create(dto: CreateFilialReportDto): Promise<FilialReport> {
    const filial = await this.filialService.getOne(dto.filial);
    if (!filial) throw new NotFoundException('Filial not found');

    const [
      checkFilialReport,
      incomplete_orders,
      incomplete_transfers,
      incomplete_basket,
      incomplete_packages,
    ] = await Promise.all([
      this.filialReportRepository.count({
        where: {
          filial: { id: filial.id },
          status: In([FilialReportStatusEnum.OPEN, FilialReportStatusEnum.REJECTED, FilialReportStatusEnum.ACCEPTED]),
        },
      }),
      this.orderRepository.count({
        where: {
          kassa: { filial: { id: filial.id } },
          status: OrderEnum.Progress,
        },
      }),
      this.transferRepository.count({
        where: [
          {
            progress: progresEnum.accept_f,
            from: { id: filial.id },
          },
          {
            progress: progresEnum.accept_f,
            to: { id: filial.id },
          },
        ],
      }),
      this.orderBasketRepository.count({
        where: {
          product: {
            filial: { id: filial.id },
          },
        },
      }),
      this.dataSource.getRepository(PackageTransfer).count({
        where: [
          { from: { id: filial.id }, status: PackageTransferEnum.Progress },
          { dealer: { id: filial.id }, status: PackageTransferEnum.Progress },
        ],
      }),
    ]);

    if (checkFilialReport) {
      throw new BadRequestException('Filial have already open report!');
    }

    if (incomplete_orders) {
      throw new BadRequestException(`Sizda tugatilinmagan o'rder(lar) mavjud!`);
    }

    if (incomplete_transfers) {
      throw new BadRequestException(`Sizda tugatilinmagan transfer(lar) mavjud!`);
    }

    if (incomplete_basket) {
      throw new BadRequestException(`Sizda tugatilinmagan bron(lar) mavjud!`);
    }

    if (incomplete_packages) {
      throw new BadRequestException(`Sizda tugatilinmagan paket transfer(lar) mavjud!`);
    }

    const report = this.filialReportRepository.create({ ...dto, filial });
    const saved = await this.filialReportRepository.save(report);
    await this.filialService.change({ need_get_report: true }, filial.id);

    // Auto-snapshot: filial'dagi barcha aktiv productlarning hozirgi holatini
    // re_inventory'ga ko'chirish (check_count=0 bilan)
    await this.reInventoryService.cloneSnapshotForReport(saved.id);

    return saved;
  }

  async findAllFilialsWithLatestReport(page: number, limit: number, search?: string) {
    let query = `
      SELECT f.id, f.title, f.type,
        lr.id AS "lastReportId",
        lr.date AS "lastReportDate",
        lr.status AS "lastReportStatus",
        lr.count AS "lastReportCount",
        lr.volume AS "lastReportVolume",
        lr.cost AS "lastReportCost",
        lr."dateOne" AS "lastReportCreatedAt"
      FROM filial f
      LEFT JOIN LATERAL (
        SELECT fr.id, fr.date, fr.status, fr.count, fr.volume, fr.cost, fr."dateOne"
        FROM filial_report fr
        WHERE fr."filialId" = f.id
        ORDER BY fr.date DESC
        LIMIT 1
      ) lr ON true
      WHERE f."isDeleted" = false AND f.type IN ('filial', 'warehouse')
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND LOWER(f.title) ILIKE $${params.length}`;
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM (${query}) t`;
    const totalResult = await this.dataSource.query(countQuery, params);
    const total = Number(totalResult[0]?.count || 0);

    query += ` ORDER BY f.title ASC`;
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    query += ` OFFSET $${params.length}`;

    const items = await this.dataSource.query(query, params);

    return {
      items,
      meta: { total, page, limit },
    };
  }

  async findAll(page: number, limit: number, filialId: string) {
    const [data, total] = await this.filialReportRepository.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      order: { date: 'DESC' },
      where: {
        filial: { id: filialId },
      },
      relations: { filial: true },
    });

    return {
      items: data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getOne(id: string) {
    return await this.filialReportRepository
      .findOne({
        where: { id },
        relations: {
          filial: true,
        },
      })
      .catch(() => {
        throw new NotFoundException('filial report not found');
      });
  }

  async getByFilialAcceptedReport({ filial_id }) {
    const filialReports = await this.filialReportRepository.find({
      where: {
        filial: { id: filial_id },
        status: FilialReportStatusEnum.ACCEPTED,
      },
      relations: {
        filial: true,
      },
    });

    return filialReports[0];
  }

  async getByFilialOpenReport({ filial_id }) {
    if (!filial_id){
      throw new BadRequestException('Id topilmadi!')
    }
    const report = await this.filialReportRepository.findOne({
      where: {
        filial: { id: filial_id },
        status: FilialReportStatusEnum.OPEN,
      },
      relations: { filial: true },
    });

    if (report.filial.id !== filial_id)
      throw new BadRequestException('report topilmadi!');

    return report;
  }

  async findByStatus(status: FilialReportStatusEnum) {
    return this.filialReportRepository.find({ where: { status } });
  }

  async update(id: string, updateData: Partial<FilialReport>) {
    await this.filialReportRepository.update(id, {
      status: updateData.status,

    });

    return this.filialReportRepository.findOne({ where: { id } });
  }

  async acceptReport(id: string, { volume, cost, count }) {
    await this.filialReportRepository.update(id, {
      status: FilialReportStatusEnum.ACCEPTED,
      count,
      cost,
      volume,
    });
  }

  async delete(id: string) {
    return this.filialReportRepository.delete(id);
  }

  /**
   * F-manager "Tasdiqlashga yuborish" — OPEN → CLOSED
   * Scanning to'xtaydi, M-manager ko'rib tasdiqlaydi/rad qiladi
   */
  async closeByFmanager(id: string, _userId: string) {
    const report = await this.filialReportRepository.findOne({
      where: { id },
      relations: { filial: true, re_inventory: true },
    });
    if (!report) throw new NotFoundException('Filial report not found');
    if (report.status !== FilialReportStatusEnum.OPEN) {
      throw new BadRequestException('Faqat ochiq (OPEN) qayta ro\'yxatni yopish mumkin');
    }

    // Totals (audit uchun yoziladi)
    const items = report.re_inventory || [];
    const count = items.reduce((s, r) => s + (Number(r.check_count) || 0), 0);

    await this.filialReportRepository.update(id, {
      status: FilialReportStatusEnum.CLOSED,
      count,
    });
    return { id, status: FilialReportStatusEnum.CLOSED };
  }

  /**
   * M-manager "Tasdiqlash" — CLOSED → ACCEPTED
   * Reconciliation bu yerda amalga oshiriladi
   */
  async acceptByMmanager(id: string, _userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const report = await manager.findOne(FilialReport, {
        where: { id },
        relations: { filial: true },
      });
      if (!report) throw new NotFoundException('Filial report not found');
      if (report.status !== FilialReportStatusEnum.CLOSED) {
        throw new BadRequestException('Faqat yopilgan (CLOSED) qayta ro\'yxatni tasdiqlash mumkin');
      }

      // Re-inventory rowlarni to'liq relation'lar bilan olish
      const items = await manager
        .createQueryBuilder('re_inventory', 'ri')
        .leftJoinAndSelect('ri.product', 'product')
        .leftJoinAndSelect('ri.bar_code', 'bar_code')
        .leftJoinAndSelect('bar_code.size', 'size')
        .where('ri."filialReportId" = :id', { id })
        .getMany();

      for (const ri of items as any[]) {
        const isMetric = !!ri.bar_code?.isMetric;
        const checkCount = Number(ri.check_count || 0);
        const sizeY = Number(ri.bar_code?.size?.y || 0);

        if (ri.product?.id) {
          // MATCHED row — reconcile Product
          if (isMetric) {
            if (checkCount > 0) {
              // Strict match: y va count tegmaydi, check_count=y*100 yoziladi (frozen)
              await manager.update(Product, ri.product.id, {
                check_count: checkCount,
              });
            } else {
              // Missing — to'liq yo'qolgan gilam
              await manager.update(Product, ri.product.id, {
                y: 0,
                count: 0,
                check_count: 0,
              });
            }
          } else {
            const originalCount = Number(ri.count || 0);
            if (checkCount > originalCount) {
              // Edge case: matched rowda check_count > count
              // Original productni tegmaymiz (tarix saqlanadi), excess uchun yangi
              const excess = checkCount - originalCount;
              const newProduct = manager.create(Product, {
                bar_code: ri.bar_code,
                filial: report.filial,
                count: excess,
                check_count: excess,
                y: sizeY,
                partiya_title: `${report.filial.name || report.filial.title} — ortiqcha`,
                is_deleted: false,
              } as any);
              await manager.save(newProduct);
              await manager.update(Product, ri.product.id, {
                count: originalCount,
                check_count: originalCount,
              });
            } else {
              // Normal: count va check_count teng yoziladi
              await manager.update(Product, ri.product.id, {
                count: checkCount,
                check_count: checkCount,
              });
            }
          }
        } else {
          // UNMATCHED (Ortiqcha) — yangi product
          const newProduct = manager.create(Product, {
            bar_code: ri.bar_code,
            filial: report.filial,
            count: isMetric ? 1 : checkCount,
            check_count: isMetric ? Math.round(checkCount) : checkCount,
            y: isMetric ? checkCount / 100 : sizeY,
            partiya_title: `${report.filial.name || report.filial.title} — ortiqcha`,
            is_deleted: false,
          } as any);
          const saved = await manager.save(newProduct);
          await manager.update('re_inventory', { id: ri.id }, { product: saved as any });
        }
      }

      await manager.update(FilialReport, id, {
        status: FilialReportStatusEnum.ACCEPTED,
      });
      await manager.update(Filial, report.filial.id, { need_get_report: false });
      return { id, status: FilialReportStatusEnum.ACCEPTED };
    });
  }

  /**
   * M-manager "Rad etish" — CLOSED → OPEN (qayta scan uchun)
   */
  async rejectByMmanager(id: string, _userId: string) {
    const report = await this.filialReportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Filial report not found');
    if (report.status !== FilialReportStatusEnum.CLOSED) {
      throw new BadRequestException('Faqat yopilgan qayta ro\'yxatni rad etish mumkin');
    }
    await this.filialReportRepository.update(id, { status: FilialReportStatusEnum.OPEN });
    return { id, status: FilialReportStatusEnum.OPEN };
  }

  async closeByFilialId({ filial_id, volume, cost }) {
    const { affected } = await this.filialReportRepository.update(
      {
        filial: { id: filial_id },
        status: FilialReportStatusEnum.ACCEPTED,
      },
      {
        cost,
        volume,
        status: FilialReportStatusEnum.CLOSED,
      },
    );

    // Optional: handle if no rows were affected
    if (!affected) {
      // throw new NotFoundException('No open report found for this filial.');
      throw new BadRequestException('filial report not found!');
    }
  }

  async acceptByFilialId({ filial_id }) {
    const { affected } = await this.filialReportRepository.update(
      {
        filial: { id: filial_id },
        status: In([FilialReportStatusEnum.OPEN, FilialReportStatusEnum.REJECTED]),
      },
      {
        status: FilialReportStatusEnum.ACCEPTED,
      },
    );

    // Optional: handle if no rows were affected
    if (!affected) {
      // throw new NotFoundException('No open report found for this filial.');
      throw new BadRequestException('filial report not found!');
    }
  }

  async rejectReport(id) {
    await this.filialReportRepository.update(
      { id },
      {
        status: FilialReportStatusEnum.OPEN,
      },
    );

    return await this.filialReportRepository.findOne({ where: { id }, relations: { filial: true } });
  }

  async removeReport(id) {
    await this.filialReportRepository.delete(id);
  }
}
