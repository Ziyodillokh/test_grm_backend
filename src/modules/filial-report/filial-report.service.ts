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
import { OrderEnum } from '@infra/shared/enum';
import progresEnum from '@infra/shared/enum/transfer-progres.enum';

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
  ) {
  }

  async create(dto: CreateFilialReportDto): Promise<FilialReport> {
    const filial = await this.filialService.getOne(dto.filial);
    if (!filial) throw new NotFoundException('Filial not found');

    const [checkFilialReport, incomplete_orders, incomplete_transfers, incomplete_basket] = await Promise.all([
      await this.filialReportRepository.count({
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

    const report = this.filialReportRepository.create({ ...dto, filial });
    await this.filialService.change({ need_get_report: true }, filial.id);
    return this.filialReportRepository.save(report);
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
        lr."createdAt" AS "lastReportCreatedAt"
      FROM filial f
      LEFT JOIN LATERAL (
        SELECT fr.id, fr.date, fr.status, fr.count, fr.volume, fr.cost, fr."createdAt"
        FROM filial_report fr
        WHERE fr."filialId" = f.id
        ORDER BY fr.date DESC
        LIMIT 1
      ) lr ON true
      WHERE f."isDeleted" = false AND f."type" IN ('filial', 'warehouse')
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
