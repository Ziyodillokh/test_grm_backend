import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FilialReport } from './filial-report.entity';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
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
            progress: progresEnum.progress,
            from: { id: filial.id },
          },
          {
            progress: progresEnum.progress,
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
    // re_inventory'ga ko'chirish (check_count=0 bilan).
    // Agar snapshot muvaffaqiyatsiz bo'lsa, report saqlangani qolaveradi,
    // lazy migration GET paytida qayta urinadi.
    try {
      await this.reInventoryService.cloneSnapshotForReport(saved.id);
    } catch (err) {
      console.error('[filial-report.create] cloneSnapshotForReport failed:', err);
    }

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

      const filialId = report.filial.id;
      const filialLabel = report.filial.name || report.filial.title;

      // Snapshot olish (re_inventory tegilmaydi — immutable audit)
      const items = await manager
        .createQueryBuilder('re_inventory', 'ri')
        .leftJoinAndSelect('ri.bar_code', 'bar_code')
        .leftJoinAndSelect('bar_code.size', 'size')
        .where('ri."filialReportId" = :id', { id })
        .getMany();

      // Barcode bo'yicha guruhlash
      const groups = new Map<string, { isMetric: boolean; sizeY: number; total: number; metricScans: number[] }>();
      for (const ri of items as any[]) {
        const barCodeId = ri.bar_code?.id;
        if (!barCodeId) continue;
        const checkCount = Number(ri.check_count || 0);
        const isMetric = !!ri.bar_code?.isMetric;
        const sizeY = Number(ri.bar_code?.size?.y || 0);

        if (!groups.has(barCodeId)) {
          groups.set(barCodeId, { isMetric, sizeY, total: 0, metricScans: [] });
        }
        const g = groups.get(barCodeId)!;
        g.total += checkCount;
        if (isMetric && checkCount > 0) {
          g.metricScans.push(checkCount);
        }
      }

      // Har barcode uchun distribution algoritmi
      for (const [barCodeId, g] of groups.entries()) {
        if (g.isMetric) {
          await this.distributeMetric(filialId, barCodeId, g.metricScans, filialLabel, manager);
        } else {
          await this.distributeNonMetric(filialId, barCodeId, g.total, filialLabel, manager);
        }
      }

      // Defensive normalize: shu filial uchun partiyaId IS NULL va title bo'sh bo'lgan
      // har qanday Productga "{filial} qoldiq" qo'yish (metric + non-metric)
      await manager.query(
        `
        UPDATE product
        SET partiya_title = $1
        WHERE "filialId" = $2
          AND "partiyaId" IS NULL
          AND (partiya_title IS NULL OR partiya_title = '')
          AND is_deleted = false
        `,
        [`${filialLabel} qoldiq`, filialId],
      );

      // Non-metric dublikatlarni eng eskisiga merge qilish (final safety net)
      await this.mergeNullPartiyaDuplicates(filialId, filialLabel, manager);

      await manager.update(FilialReport, id, {
        status: FilialReportStatusEnum.ACCEPTED,
      });
      await manager.update(Filial, filialId, { need_get_report: false });
      return { id, status: FilialReportStatusEnum.ACCEPTED };
    });
  }

  /**
   * Non-metric FIFO distribution: totalScanned ni mavjud Productlar
   * ustiga FIFO tartibida (partiyali eng eski → partiyasiz eng eski) taqsimlaydi.
   * Ortiqcha qism "{filial} qoldiq" Product'ga yoziladi.
   * Yetib bormagan Productlar count=0 va is_deleted=true bo'ladi.
   */
  private async distributeNonMetric(
    filialId: string,
    barCodeId: string,
    totalScanned: number,
    filialLabel: string,
    manager: EntityManager,
  ): Promise<void> {
    // FIFO tartib: partiyali (NOT NULL) avval, ichida createdAt ASC; keyin partiyasiz, ichida createdAt ASC
    // DB ustun: "dateOne" — BaseEntity'dagi @CreateDateColumn({ name: 'dateOne' }) tufayli
    const products: Array<{ id: string; count: string | number; partiyaId: string | null }> =
      await manager.query(
        `
        SELECT id, count, "partiyaId"
        FROM product
        WHERE "filialId" = $1
          AND "barCodeId" = $2
          AND is_deleted = false
        ORDER BY ("partiyaId" IS NULL) ASC, "dateOne" ASC NULLS LAST, id ASC
        `,
        [filialId, barCodeId],
      );

      let remaining = totalScanned;

      for (const p of products) {
        const cap = Number(p.count || 0);
        if (remaining > 0) {
          const allocated = Math.min(remaining, cap);
          await manager.update(Product, { id: p.id }, {
            count: allocated,
            check_count: allocated,
            booking_count: 0,
          });
          remaining -= allocated;
          if (allocated < cap) {
            // Productni qisman to'ldirildi — qolgan qismi yo'qoladi (closeByFmanager logikasi
            // bilan mos: scan qilinmagan qism is_deleted=true bo'ladi)
          }
        } else {
          // Yetib bormadi → soft-delete
          await manager.update(Product, { id: p.id }, {
            count: 0,
            check_count: 0,
            booking_count: 0,
            is_deleted: true,
          });
        }
      }

      if (remaining > 0) {
        // Ortiqcha — qoldiq Product'ga yoziladi (mavjud bo'lsa unga qo'shiladi)
        const qoldiq = await this.findOrCreateQoldiqProduct(filialId, barCodeId, filialLabel, manager);
        const newCount = Number(qoldiq.count || 0) + remaining;
        await manager.update(Product, { id: qoldiq.id }, {
          count: newCount,
          check_count: newCount,
          booking_count: 0,
          is_deleted: false,
        });
      }
  }

  /**
   * Metric strict 1:1 match: har scan event uchun y*100=scan bo'lgan
   * mavjud Product topiladi (FIFO createdAt ASC). Topilmasa "qoldiq"
   * sifatida yangi Product yaratiladi. Hech qaysi scan'ga mos kelmagan
   * mavjud Productlar count=0, is_deleted=true bo'ladi.
   */
  private async distributeMetric(
    filialId: string,
    barCodeId: string,
    scanValues: number[],
    filialLabel: string,
    manager: EntityManager,
  ): Promise<void> {
    // Mavjud metric Productlar — FIFO
    const products: Array<{ id: string; y: string | number }> = await manager.query(
      `
      SELECT id, y
      FROM product
      WHERE "filialId" = $1
        AND "barCodeId" = $2
        AND is_deleted = false
      ORDER BY "dateOne" ASC NULLS LAST, id ASC
      `,
      [filialId, barCodeId],
    );

    const consumed = new Set<string>();

    for (const scanValue of scanValues) {
      // y*100 == scanValue match topish (consumed bo'lmagan)
      const target = products.find(
        (p) => !consumed.has(p.id) && Math.round(Number(p.y) * 100) === scanValue,
      );
      if (target) {
        await manager.update(Product, { id: target.id }, {
          check_count: scanValue,
        });
        consumed.add(target.id);
      } else {
        // Mos kelmadi — yangi qoldiq Product
        const yMeters = scanValue / 100;
        const newProduct = manager.create(Product, {
          bar_code: { id: barCodeId } as any,
          filial: { id: filialId } as any,
          count: 1,
          check_count: scanValue,
          y: yMeters,
          partiya_title: `${filialLabel} qoldiq`,
          is_deleted: false,
        } as any);
        await manager.save(newProduct);
      }
    }

    // Hech qaysi scan'ga mos kelmagan Productlar yo'qolgan
    for (const p of products) {
      if (!consumed.has(p.id)) {
        await manager.update(Product, { id: p.id }, {
          count: 0,
          check_count: 0,
          booking_count: 0,
          is_deleted: true,
        });
      }
    }
  }

  /**
   * Filial uchun shu barcode'ning "{filial} qoldiq" Product'ini topadi yoki yaratadi.
   * Distribution natijasidagi ortiqcha non-metric mahsulotlar shu yerga jamlanadi.
   */
  private async findOrCreateQoldiqProduct(
    filialId: string,
    barCodeId: string,
    filialLabel: string,
    manager: EntityManager,
  ): Promise<{ id: string; count: number }> {
    const expectedTitle = `${filialLabel} qoldiq`;

    const existing: Array<{ id: string; count: string | number }> = await manager.query(
      `
      SELECT id, count
      FROM product
      WHERE "filialId" = $1
        AND "barCodeId" = $2
        AND "partiyaId" IS NULL
        AND is_deleted = false
        AND partiya_title = $3
      ORDER BY "dateOne" ASC NULLS LAST, id ASC
      LIMIT 1
      `,
      [filialId, barCodeId, expectedTitle],
    );

    if (existing.length > 0) {
      return { id: existing[0].id, count: Number(existing[0].count || 0) };
    }

    const newProduct = manager.create(Product, {
      bar_code: { id: barCodeId } as any,
      filial: { id: filialId } as any,
      count: 0,
      check_count: 0,
      booking_count: 0,
      partiya_title: expectedTitle,
      is_deleted: false,
    } as any);
    const saved = (await manager.save(newProduct)) as unknown as Product;
    return { id: saved.id, count: 0 };
  }

  /**
   * Bir xil barCodeId + partiyaId IS NULL bo'lgan non-metric Productlarni eng eskisiga merge qiladi.
   * Eng eski tanlash: createdAt (DB ustun nomi "dateOne") ASC.
   * Master ga count va check_count summa qilinadi, dublikatlar is_deleted=true.
   * Metric mahsulotlar tegilmaydi (har biri alohida fizik mahsulot).
   */
  private async mergeNullPartiyaDuplicates(
    filialId: string,
    filialLabel: string,
    manager: EntityManager,
  ): Promise<void> {
    // Eslatma: BaseEntity'da @CreateDateColumn({ name: 'dateOne' }) — TypeORM property
    // "createdAt", lekin DB ustun nomi hali ham "dateOne". Raw SQL'da DB ustun nomi.
    const groups: Array<{
      barCodeId: string;
      ids: string[];
      counts: (string | number)[];
      check_counts: (string | number)[];
      titles: (string | null)[];
    }> = await manager.query(
      `
      SELECT
        p."barCodeId",
        array_agg(p.id ORDER BY p."dateOne" ASC NULLS LAST, p.id ASC) AS ids,
        array_agg(p.count ORDER BY p."dateOne" ASC NULLS LAST, p.id ASC) AS counts,
        array_agg(p.check_count ORDER BY p."dateOne" ASC NULLS LAST, p.id ASC) AS check_counts,
        array_agg(p.partiya_title ORDER BY p."dateOne" ASC NULLS LAST, p.id ASC) AS titles
      FROM product p
      LEFT JOIN qrbase qb ON p."barCodeId" = qb.id
      WHERE p."filialId" = $1
        AND p.is_deleted = false
        AND p."barCodeId" IS NOT NULL
        AND p."partiyaId" IS NULL
        AND qb."isMetric" = false
      GROUP BY p."barCodeId"
      HAVING COUNT(p.id) > 1
      `,
      [filialId],
    );

    for (const g of groups) {
      const [masterId, ...dupIds] = g.ids;
      const totalCount = g.counts.reduce<number>((s, c) => s + Number(c || 0), 0);
      const totalCheck = g.check_counts.reduce<number>((s, c) => s + Number(c || 0), 0);
      const masterTitle = g.titles[0]?.trim() || `${filialLabel} qoldiq`;

      await manager.update(
        Product,
        { id: masterId },
        {
          count: totalCount,
          check_count: totalCheck,
          booking_count: 0,
          partiya_title: masterTitle,
        },
      );

      if (dupIds.length) {
        await manager.update(
          Product,
          { id: In(dupIds) },
          {
            count: 0,
            check_count: 0,
            booking_count: 0,
            is_deleted: true,
          },
        );
      }
    }
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
