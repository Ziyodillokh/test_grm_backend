import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { Partiya } from './partiya.entity';
import { CreatePartiyaDto, UpdatePartiyaDto } from './dto';
import { partiyaDateSort } from '../../infra/helpers';
import { DataSource, Not, Repository } from 'typeorm';
import { ActionService } from '../action/action.service';
import { CashFlowEnum, FilialTypeEnum, PartiyaStatusEnum, ProductReportEnum, UserRoleEnum } from '../../infra/shared/enum';
import { PartiyaStatusService } from '../partiya-status/partiya-status.service';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { ExcelService } from '../excel/excel.service';
import { PartiyaCollectionPriceService } from '../partiya-collection-price/partiya-collection-price.service';
import { ProductExcel } from '../excel/excel-product.entity';
import { Factory } from '../factory/factory.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';
import CashflowStatusEnum from '../../infra/shared/enum/cashflow/cashflow-status.enum';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';

@Injectable()
export class PartiyaService {
  constructor(
    @InjectRepository(Partiya)
    private readonly partiyaRepository: Repository<Partiya>,
    private readonly actionService: ActionService,
    private readonly partiyaStatusService: PartiyaStatusService,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @Inject(forwardRef(() => ExcelService))
    private readonly excelProductService: ExcelService,
    @InjectRepository(ProductExcel)
    private readonly productExcelRepository: Repository<ProductExcel>,
    private readonly partiyaCollectionPriceService: PartiyaCollectionPriceService,
    @InjectRepository(Factory)
    private readonly factoryRepository: Repository<Factory>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Partiya FINISHED bo'lganda factory.owed'ni shu partiya qiymatiga oshirib, alohida
   * 'partiya' slug'li income cashflow yaratadi. Hisoblash factory.service'dagi
   * period_owed bilan bir xil formula: productexcel × partiya-collection-price.
   */
  private async createPartiyaDebtCashflow(partiyaId: string): Promise<void> {
    const partiya = await this.partiyaRepository.findOne({
      where: { id: partiyaId },
      relations: { factory: true },
    });
    if (!partiya?.factory?.id) return;

    const rows: { col_title: string; total_kv: string; price: string; subtotal: string }[] =
      await this.dataSource.query(
        `
        SELECT
          col.title AS col_title,
          SUM(CASE
            WHEN qb."isMetric" = true THEN (pe.check_count::numeric / 100) * s.x
            ELSE s.y * s.x * pe.count
          END)::numeric(20, 2) AS total_kv,
          pcp."factoryPricePerKv"::text AS price,
          (SUM(CASE
            WHEN qb."isMetric" = true THEN (pe.check_count::numeric / 100) * s.x
            ELSE s.y * s.x * pe.count
          END) * pcp."factoryPricePerKv")::numeric(20, 2) AS subtotal
        FROM partiya p
        JOIN "partiya-collection-price" pcp ON pcp."partiyaId" = p.id
        JOIN productexcel pe ON pe."partiyaId" = p.id
        JOIN qrbase qb ON pe."barCodeId" = qb.id AND qb."collectionId" = pcp."collectionId"
        JOIN size s ON qb."sizeId" = s.id
        JOIN collection col ON pcp."collectionId" = col.id
        WHERE p.id = $1
        GROUP BY col.title, pcp."factoryPricePerKv"
        ORDER BY col.title
        `,
        [partiyaId],
      );

    const total = rows.reduce((s, r) => s + Number(r.subtotal), 0);
    if (total <= 0) return;

    const cashflowType = await this.cashflowTypeRepository.findOne({ where: { slug: 'partiya' } });
    if (!cashflowType) return;

    const breakdown = rows
      .map((r) => `${r.col_title}: ${r.total_kv} m² × $${r.price} = $${r.subtotal}`)
      .join('\n');
    const dateStr = new Date(partiya.date).toISOString().slice(0, 10);

    await this.cashflowRepository.save(
      this.cashflowRepository.create({
        price: total,
        type: CashFlowEnum.InCome,
        tip: CashflowTipEnum.CASHFLOW,
        title: 'Partiya',
        comment: `Partiya: ${dateStr}\n${breakdown}`,
        date: partiya.date,
        cashflow_type: cashflowType,
        factory: partiya.factory,
        is_online: false,
        is_static: true,
        status: CashflowStatusEnum.APPROVED,
      } as any),
    );

    await this.factoryRepository
      .createQueryBuilder()
      .update(Factory)
      .set({
        owed: () => `COALESCE(owed, 0) + ${total}`,
        totalDebt: () => `(COALESCE(owed, 0) + ${total}) - COALESCE(given, 0)`,
      })
      .where('id = :id', { id: partiya.factory.id })
      .execute();
  }

  /** Partiyadagi unique kolleksiya idlarini topish */
  private async getPartiyaCollectionIds(partiyaId: string): Promise<string[]> {
    const rows = await this.productExcelRepository
      .createQueryBuilder('product')
      .leftJoin('product.bar_code', 'bar_code')
      .leftJoin('bar_code.collection', 'collection')
      .where('product.partiyaId = :partiyaId', { partiyaId })
      .andWhere('collection.id IS NOT NULL')
      .select('DISTINCT collection.id', 'collectionId')
      .getRawMany();
    return rows.map((r) => r.collectionId).filter(Boolean);
  }

  async getAll(options: IPaginationOptions, where, user): Promise<Pagination<Partiya>> {
    if (user?.filial?.type === FilialTypeEnum.WAREHOUSE) {
      where.partiya_status = Not(PartiyaStatusEnum.NEW);
    }
    return await paginate<Partiya>(this.partiyaRepository, options, {
      relations: {
        factory: true,
        partiya_no: true,
        country: true,
        warehouse: true,
      },
      order: { date: 'DESC' },
      where,
    });
  }

  async getAllByDateRange() {
    const data = await this.partiyaRepository.find({ order: { date: 'DESC' } });
    return partiyaDateSort(data);
  }

  async getOne(id: string) {
    return await this.partiyaRepository
      .findOne({
        where: { id },
        relations: { warehouse: true, country: true, factory: true, user: true, partiya_no: true },
      })
      .catch(() => {
        throw new NotFoundException('Partiya not found!');
      });
  }

  async deleteOne(id: string) {
    const data = await this.partiyaRepository
      .findOne({
        where: { id },
        relations: {},
      })
      .catch(() => {
        throw new NotFoundException('Partiya not found');
      });

    // deleteFile(data?.excel?.path);

    return await this.partiyaRepository.delete(id);
  }

  async change(value: UpdatePartiyaDto, id: string) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });
    value = { volume: partiya.volume, expense: partiya.expense, ...value };
    return await this.partiyaRepository.update({ id }, value as unknown as Partiya);
  }

  async finish(id) {
    return await this.partiyaRepository.update({ id }, { partiya_status: PartiyaStatusEnum.FINISHED });
  }

  async changeExp(value, id: string, user) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });
    if (!partiya) {
      throw new NotFoundException('Partiya not found!');
    }
    const response = await this.partiyaRepository.update({ id }, { expense: value });
    await this.actionService.create(partiya, user.id, null, 'update_partiya', `Партия изминил. $${value}`);
    return response;
  }

  async create(value: CreatePartiyaDto, user) {
    await this.actionService.create(value, user.id, null, 'partiya_create');
    const filial = await this.filialRepository.findOne({ where: { id: value.warehouse } });

    if (!filial) {
      throw new NotFoundException('Filial not found!');
    }

    if (filial.type !== FilialTypeEnum.WAREHOUSE) {
      throw new BadRequestException("Partiya can only be associated with a filial of type 'warehouse'");
    }

    const data = this.partiyaRepository.create({
      ...value,
      partiya_status: PartiyaStatusEnum.NEW,
    } as unknown as Partiya);
    return await this.partiyaRepository.save(data);
  }

  async changeStatus(id: string, status: PartiyaStatusEnum, user: User) {
    const partiya = await this.partiyaRepository.findOne({ where: { id } });

    if (!partiya) {
      throw new BadRequestException('Partiya topilmadi!');
    } else if (status === PartiyaStatusEnum.PENDING && user.position.role === UserRoleEnum.M_MANAGER) {
      //
      const report = await this.excelProductService.getReport(partiya.id);

      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Partiyani yopib bo\'lmaydi: mahsulotlarning umumiy hajmi partiya hajmiga teng emas.');

      // Hamma kolleksiyalarga narx kiritilganligini tekshirish
      const collectionIds = await this.getPartiyaCollectionIds(partiya.id);
      await this.partiyaCollectionPriceService.assertAllCollectionsPriced(partiya.id, collectionIds);

      return await this.partiyaRepository.update({ id }, { partiya_status: status });
      //
    } else if (status === PartiyaStatusEnum.CLOSED && user.position.role === UserRoleEnum.W_MANAGER) {
      //
      const report = await this.excelProductService.getReport(partiya.id, ProductReportEnum.INVENTORY);
      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Partiyani yopib bo\'lmaydi: mahsulotlarning umumiy hajmi partiya hajmiga teng emas.');

      return await this.partiyaRepository.update({ id }, { partiya_status: status });
      //
    } else if (status === PartiyaStatusEnum.FINISHED && user.position.role === UserRoleEnum.M_MANAGER) {
      //
      const report = await this.excelProductService.getReport(partiya.id, ProductReportEnum.INVENTORY);

      if (Number(report.volume).toFixed(2) !== Number(partiya.volume).toFixed(2))
        throw new BadRequestException('Partiyani yopib bo\'lmaydi: mahsulotlarning umumiy hajmi partiya hajmiga teng emas.');

      await this.excelProductService.createProducts(partiya.id);
      const result = await this.partiyaRepository.update({ id }, { partiya_status: status });

      // Factory'ga partiya qiymati qo'shiladi (owed o'sadi) va alohida cashflow yoziladi.
      try {
        await this.createPartiyaDebtCashflow(partiya.id);
      } catch (e) {
        console.error('createPartiyaDebtCashflow failed:', e?.message || e);
      }

      return result;
      //
    } else {
      throw new BadRequestException(`${user.position.title} sifatida partiyani yopa olmaysiz`);
    }
  }

  async correctAll(id) {
    await this.partiyaRepository.query(`
      update productexcel as pe
      set check_count = pe.count
      where id in (select pe2.id
                   from productexcel pe2
                   left join qrbase qb on pe2."barCodeId" = qb.id
                   where pe2."partiyaId" = $1
                     and "isMetric" = false)
    `, [id]);

    await this.partiyaRepository.query(`
      update productexcel as pe
      set check_count = pe.y * 100
      where id in (select pe2.id
                   from productexcel pe2
                   left join qrbase qb on pe2."barCodeId" = qb.id
                   where pe2."partiyaId" = $1
                     and "isMetric" = true)
    `, [id]);

    return 'ok';
  }
}
