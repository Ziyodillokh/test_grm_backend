import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';

import { Share } from './share.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';
import { ShareReportQueryDto } from './dto/share-report-query.dto';
import { ShareDetailQueryDto } from './dto/share-detail-query.dto';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(Share)
    private readonly shareRepository: Repository<Share>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
  ) {}

  async findAll({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
    const [items, total] = await this.shareRepository.findAndCount({
      where: {},
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      items,
      meta: {
        totalItems: total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        itemCount: items.length,
      },
    };
  }

  async findOne(id: string): Promise<Share> {
    const share = await this.shareRepository.findOne({ where: { id } });
    if (!share) throw new NotFoundException('Share not found');
    return share;
  }

  async create(dto: CreateShareDto) {
    const share = this.shareRepository.create({
      fullName: dto.fullName,
      phone: dto.phone,
      capital: 0,
      given_capital: 0,
      given_profit: 0,
      totalDebt: 0,
    });
    return this.shareRepository.save(share);
  }

  async update(id: string, dto: UpdateShareDto) {
    await this.findOne(id);
    await this.shareRepository.update({ id }, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const share = await this.findOne(id);
    return this.shareRepository.softRemove(share);
  }

  /** Top-level report: barcha sheriklar ro'yxati + period_capital / period_given_capital / period_given_profit */
  async getShareReport(dto: ShareReportQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || dayjs().month() + 1;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const qb = this.shareRepository
      .createQueryBuilder('s')
      .select([
        's.id AS id',
        's."fullName" AS "fullName"',
        's.phone AS phone',
        's.capital AS capital',
        's.given_capital AS given_capital',
        's.given_profit AS given_profit',
        's."totalDebt" AS "totalDebt"',
        `COALESCE(SUM(CASE WHEN c.type = 'income' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_capital`,
        `COALESCE(SUM(CASE WHEN c.type = 'expense' AND c."shareKind" = 'capital' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_given_capital`,
        `COALESCE(SUM(CASE WHEN c.type = 'expense' AND c."shareKind" = 'profit' THEN c.price ELSE 0 END), 0)::NUMERIC(20,2) AS period_given_profit`,
      ])
      .leftJoin(
        'cashflow',
        'c',
        `c."shareId" = s.id AND c.is_cancelled = false AND c.date BETWEEN :startDate AND :endDate`,
        { startDate, endDate },
      )
      .where('s."deletedDate" IS NULL')
      .groupBy('s.id')
      .orderBy('s."totalDebt"', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.search) {
      qb.andWhere('s."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }

    const items = await qb.getRawMany();

    const countQb = this.shareRepository
      .createQueryBuilder('s')
      .where('s."deletedDate" IS NULL');
    if (dto.search) {
      countQb.andWhere('s."fullName" ILIKE :search', { search: `%${dto.search}%` });
    }
    const totalItems = await countQb.getCount();

    const totalsQb = this.shareRepository
      .createQueryBuilder('s')
      .select([
        `SUM(s.capital)::NUMERIC(20,2) AS total_capital`,
        `SUM(s.given_capital)::NUMERIC(20,2) AS total_given_capital`,
        `SUM(s.given_profit)::NUMERIC(20,2) AS total_given_profit`,
        `SUM(s."totalDebt")::NUMERIC(20,2) AS total_debt`,
      ])
      .where('s."deletedDate" IS NULL');
    const totals = await totalsQb.getRawOne();

    return {
      items: items.map((i) => ({
        ...i,
        capital: Number(i.capital || 0),
        given_capital: Number(i.given_capital || 0),
        given_profit: Number(i.given_profit || 0),
        totalDebt: Number(i.totalDebt || 0),
        period_capital: Number(i.period_capital || 0),
        period_given_capital: Number(i.period_given_capital || 0),
        period_given_profit: Number(i.period_given_profit || 0),
      })),
      meta: {
        totalItems,
        currentPage: Number(page),
        totalPages: Math.ceil(totalItems / limit),
        itemCount: limit,
      },
      totals: {
        total_capital: Number(totals?.total_capital || 0),
        total_given_capital: Number(totals?.total_given_capital || 0),
        total_given_profit: Number(totals?.total_given_profit || 0),
        total_debt: Number(totals?.total_debt || 0),
      },
    };
  }

  /** 1 sherik cashflow tarixi */
  async getShareDetailReport(shareId: string, dto: ShareDetailQueryDto) {
    const year = dto.year || dayjs().year();
    const month = dto.month || null;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    let startDate: Date;
    let endDate: Date;
    if (dto.fromDate || dto.toDate) {
      startDate = dto.fromDate
        ? dayjs(dto.fromDate).startOf('day').toDate()
        : dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dto.toDate
        ? dayjs(dto.toDate).endOf('day').toDate()
        : dayjs(`${year}-12-31`).endOf('year').toDate();
    } else if (month) {
      startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${year}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${year}-12-31`).endOf('year').toDate();
    }

    const share = await this.findOne(shareId);

    const qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
        'cash.shareKind',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect(['cashflow_type.id', 'cashflow_type.title', 'cashflow_type.slug'])
      .leftJoin('cash.share', 'share')
      .addSelect(['share.id', 'share.fullName'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .where('share.id = :shareId', { shareId })
      .andWhere('cash.is_cancelled = false')
      .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .orderBy('cash.date', 'DESC')
      .offset(offset)
      .limit(limit);

    if (dto.type) qb.andWhere('cash.type = :type', { type: dto.type });
    if (dto.kind) qb.andWhere('cash.shareKind = :kind', { kind: dto.kind });

    const totalQb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select(`
        SUM(CASE WHEN cash.type = 'income' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_capital,
        SUM(CASE WHEN cash.type = 'expense' AND cash.shareKind = 'capital' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_given_capital,
        SUM(CASE WHEN cash.type = 'expense' AND cash.shareKind = 'profit' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_given_profit
      `)
      .leftJoin('cash.share', 'share')
      .where('share.id = :shareId', { shareId })
      .andWhere('cash.is_cancelled = false')
      .andWhere('cash.date BETWEEN :start AND :end', { start: startDate, end: endDate });
    if (dto.type) totalQb.andWhere('cash.type = :type', { type: dto.type });
    if (dto.kind) totalQb.andWhere('cash.shareKind = :kind', { kind: dto.kind });

    const [[items, total], totals] = await Promise.all([
      qb.getManyAndCount(),
      totalQb.getRawOne(),
    ]);

    return {
      items,
      meta: {
        totalItems: total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_capital: Number(totals?.total_capital || 0),
        total_given_capital: Number(totals?.total_given_capital || 0),
        total_given_profit: Number(totals?.total_given_profit || 0),
      },
      share,
    };
  }
}
