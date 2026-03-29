import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Repository } from 'typeorm';
import { Filial } from '@modules/filial/filial.entity';
import FilialTypeEnum from '@infra/shared/enum/filial-type.enum';
import { Order } from '@modules/order/order.entity';
import { User } from '@modules/user/user.entity';

@Injectable()
export class FilialPlanService {
  constructor(
    @InjectRepository(Kassa)
    private readonly kassaRepo: Repository<Kassa>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
  }

  async getTotals(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const qb = this.kassaRepo
      .createQueryBuilder('kr')
      .select('kr.year', 'year')
      .addSelect('SUM(kr.sale)', 'earn')
      .addSelect('SUM(kr.plan_price)', 'plan_price')
      .groupBy('kr.year')
      .orderBy('kr.year', 'DESC')
      .where(`kr.filialType = :filialType`, { filialType: FilialTypeEnum.FILIAL })
      .offset(skip)
      .limit(limit);

    const data = await qb.getRawMany();

    // total count of grouped rows (years)
    const totalQb = this.kassaRepo
      .createQueryBuilder('kr')
      .select('COUNT(DISTINCT kr.year)', 'count');

    const totalResult = await totalQb.getRawOne();
    const total = Number(totalResult.count);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getByYear(
    year: number,
    limit: number,
    page: number,
    filialId?: string,
    month?: number,
  ) {
    let dealer_plan = 0, dealer_earn = 0;
    const baseQb = this.kassaRepo
      .createQueryBuilder('kr')
      .leftJoin('kr.filial', 'f')
      .where('kr.year = :year', { year })
      .andWhere('f.type = :filialType', { filialType: FilialTypeEnum.FILIAL });

    const baseDealerQb = this.kassaRepo
      .createQueryBuilder('kr')
      .leftJoin('kr.filial', 'f')
      .where('kr.year = :year', { year })
      .andWhere('kr.filialType = :filialType', { filialType: FilialTypeEnum.DEALER });

    if (filialId && filialId !== '#dealer') {
      baseQb.andWhere('f.id = :filialId', { filialId });
    }

    if (month) {
      baseQb.andWhere('kr.month = :month', { month });
      baseDealerQb.andWhere('kr.month = :month', { month });
    }

    // ==========================
    // 🔹 DATA QUERY (PAGINATED)
    // ==========================
    const dataQb = baseQb.clone();

    dataQb.select([
      'f.id AS "filialId"',
      'f.title AS "filialTitle"',
      'kr.year AS "year"',
      ...(month ? ['kr.month AS "month"'] : []),
      'SUM(kr.plan_price) AS "plan_price"',
      'SUM(kr.sale) AS "earn"',
    ]);

    baseDealerQb.select([
      `'#dealer' AS "filialId"`,
      `'Dealers' AS "filialTitle"`,
      'kr.year AS "year"',
      ...(month ? ['kr.month AS "month"'] : []),
      'kr.plan_price AS "plan_price"',
      'SUM(kr.income) AS "earn"',
    ]);

    dataQb
      .groupBy('f.id')
      .addGroupBy('f.title')
      .addGroupBy('kr.year');

    baseDealerQb
      .addGroupBy('kr.year')
      .addGroupBy('kr.month')
      .addGroupBy('kr.plan_price');

    if (month) {
      dataQb.addGroupBy('kr.month');
      baseDealerQb.addGroupBy('kr.month');
    }

    dataQb
      .orderBy('f.title', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const items = await dataQb.getRawMany();
    const dealerItems = await baseDealerQb.getRawMany();
    if (dealerItems.length && page === 1) {
      const dealerItem = dealerItems.reduce((data, curr) => {
        data.earn += Number(curr.earn);
        data.plan_price += Number(curr.plan_price);
        return data;
      }, { filialId: '#dealer', filialTitle: 'Dealers', plan_price: 0, earn: 0 });
      dealerItem.plan_price = +(Number(dealerItem.plan_price).toFixed(2));
      dealerItem.earn = +(Number(dealerItem.earn).toFixed(2));
      items.unshift(dealerItem);
      dealer_plan = dealerItem.plan_price;
      dealer_earn = dealerItem.earn;
    }

    // ==========================
    // 🔹 COUNT QUERY
    // ==========================
    const countQb = baseQb.clone();

    countQb
      .select('1')
      .groupBy('f.id')
      .addGroupBy('kr.year');

    if (month) {
      countQb.addGroupBy('kr.month');
    }

    const totalItems = (await countQb.getRawMany()).length;

    // ==========================
    // 🔹 TOTALS QUERY (NO PAGINATION)
    // ==========================
    const totalsQb = baseQb.clone();

    totalsQb.select([
      'COALESCE(SUM(k.plan_price), 0) AS "plan_price"',
      'COALESCE(SUM(kr.sale), 0) AS "earn"',
    ]);

    const totalsRaw = await totalsQb.getRawOne();
    console.log(totalsRaw);

    // ==========================
    // 🔹 RESPONSE
    // ==========================
    return {
      items,
      totals: {
        plan_price: Number(totalsRaw.plan_price) + dealer_plan,
        earn: Number(totalsRaw.earn) + dealer_earn,
        year,
        ...(month && { month }),
      },
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async updateYearPlan(filialId: string, yearlyPrice: number, year: number) {
    const base = Math.floor(yearlyPrice / 12);
    const remainder = yearlyPrice - base * 12;

    if (filialId === '#dealer') {
      await this.kassaRepo
        .createQueryBuilder()
        .update()
        .set({
          plan_price: () => `
        CASE
          WHEN month = 12 THEN ${base + remainder}
          ELSE ${base}
        END
      `,
        })
        .where('filialType = :type', { type: FilialTypeEnum.DEALER })
        .andWhere('year = :year', { year })
        .execute();
    } else if (filialId) {
      await this.kassaRepo
        .createQueryBuilder()
        .update()
        .set({
          plan_price: () => `
        CASE
          WHEN month = 12 THEN ${base + remainder}
          ELSE ${base}
        END
      `,
        })
        .where('filialId = :filialId', { filialId })
        .andWhere('year = :year', { year })
        .execute();
    }

    return { yearlyPrice };
  }

  async getByFilial(
    year: number,
    limit: number,
    page: number,
    filialId?: string,
    month?: number,
    sellerId?: string,
  ) {
    // ===============================
    // SAFE INPUTS
    // ===============================
    const safePage =
      Number.isInteger(+page) && +page > 0 ? +page : 1;

    const safeLimit =
      Number.isInteger(+limit) && +limit > 0 ? +limit : 10;

    const safeYear =
      Number.isInteger(+year) && +year > 2000
        ? +year
        : new Date().getFullYear();

    const safeMonth =
      Number.isInteger(+month) && +month >= 1 && +month <= 12
        ? +month
        : undefined;

    const fromDate =
      safeMonth !== undefined
        ? new Date(safeYear, safeMonth - 1, 1)
        : new Date(safeYear, 0, 1);

    const toDate =
      safeMonth !== undefined
        ? new Date(safeYear, safeMonth, 1)
        : new Date(safeYear + 1, 0, 1);

    // ===============================
    // BASE QUERY (SINGLE SOURCE)
    // ===============================
    const baseQb = this.userRepo
      .createQueryBuilder('s')
      .leftJoin('s.filial', 'f')
      .leftJoin('s.avatar', 'avatar')
      .leftJoin(
        's.sellerOrders',
        'o',
        `
        o.status = :status
        AND o.date >= :fromDate
        AND o.date < :toDate
      `,
        {
          status: 'accepted',
          fromDate,
          toDate,
        },
      )
      .leftJoin('o.kassa', 'k')
      .where('f.type = :filialType', {
        filialType: FilialTypeEnum.FILIAL,
      })
      .andWhere('s.isActive = true')
      .andWhere('k.year = :year', { year: safeYear });

    if (safeMonth !== undefined) {
      baseQb.andWhere('k.month = :month', { month: safeMonth });
    }

    if (filialId && filialId !== 'all') {
      baseQb.andWhere('f.id = :filialId', { filialId });
    }

    if (sellerId) {
      baseQb.andWhere('s.id = :sellerId', { sellerId });
    }

    // ===============================
    // SELLER COUNT (PAGINATION SOURCE)
    // ===============================
    const sellerCountRaw = await baseQb
      .clone()
      .select('COUNT(DISTINCT s.id)', 'cnt')
      .getRawOne();

    const sellerCount = Math.max(
      1,
      Number(sellerCountRaw?.cnt ?? 1),
    );

    // ===============================
    // DATA QUERY
    // ===============================
    const dataQb = baseQb.clone();

    dataQb
      .select([
        's.id AS "id"',
        's.firstName AS "firstName"',
        's.lastName AS "lastName"',
        `json_build_object('id', avatar.id, 'path', avatar.path) AS avatar`,

        'COALESCE(SUM(o.price + o.plasticSum), 0) AS "earn"',
        'COALESCE(COUNT(o.id), 0) AS "count"',
        'COALESCE(SUM(o.discountSum), 0)::numeric(20,2) AS "discount"',
        'COALESCE(SUM(o.kv), 0)::numeric(20,2) AS "kv"',

        `
        COALESCE(
          SUM(COALESCE(k.plan_price::numeric, 0)) / :sellerCount,
          0
        ) AS "planPrice"
      `,
      ])
      .setParameter('sellerCount', sellerCount)
      .groupBy('s.id')
      .addGroupBy('s.firstName')
      .addGroupBy('s.lastName')
      .addGroupBy('avatar.id')
      .offset((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const itemsRaw = await dataQb.getRawMany();

    // ===============================
    // TOTALS (NO PAGINATION)
    // ===============================
    const totalsRaw = await baseQb
      .clone()
      .select([
        'COALESCE(SUM(o.price + o.plasticSum), 0) AS "earn"',
        'COALESCE(SUM(k.plan_price), 0) AS "plan_price"',
        'COALESCE(SUM(o.discountSum), 0) AS "discount"',
        'COALESCE(COUNT(o.id), 0) AS "count"',
        'COALESCE(SUM(o.kv), 0) AS "kv"',
      ])
      .getRawOne();

    // ===============================
    // RESPONSE
    // ===============================
    return {
      items: sellerId
        ? []
        : itemsRaw.map((item) => ({
          id: item.id,
          firstName: item.firstName,
          lastName: item.lastName,
          avatar: item.avatar,
          earn: Number(item.earn),
          planPrice: Number(item.planPrice),
          discount: Number(item.discount),
          count: Number(item.count),
          kv: Number(item.kv),
        })),

      item: sellerId
        ? {
          id: itemsRaw[0]?.id,
          firstName: itemsRaw[0]?.firstName,
          lastName: itemsRaw[0]?.lastName,
          earn: Number(itemsRaw[0]?.earn),
          planPrice: Number(itemsRaw[0]?.planPrice),
          discount: Number(itemsRaw[0]?.discount),
          count: Number(itemsRaw[0]?.count),
          kv: Number(itemsRaw[0]?.kv),
        }
        : {},

      totals: {
        earn: Number(totalsRaw?.earn ?? 0),
        plan_price: Number(totalsRaw?.plan_price ?? 0),
        discount: Number(totalsRaw?.discount ?? 0),
        count: Number(totalsRaw?.count ?? 0),
        kv: Number(totalsRaw?.kv ?? 0),
        year: safeYear,
        ...(safeMonth !== undefined && { month: safeMonth }),
      },

      meta: {
        totalItems: sellerCount,
        itemCount: itemsRaw.length,
        itemsPerPage: safeLimit,
        totalPages: Math.ceil(sellerCount / safeLimit),
        currentPage: safePage,
      },
    };
  }
}