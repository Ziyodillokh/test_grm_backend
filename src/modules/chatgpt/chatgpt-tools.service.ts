// src/modules/chatgpt/chatgpt-tools.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { Filial } from '../filial/filial.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Kassa } from '../kassa/kassa.entity';
import { Client } from '../client/client.entity';
import { User } from '../user/user.entity';
import { Transfer } from '../transfer/transfer.entity';
import { PlanYear } from '../plan-year/plan-year.entity';
import { Collection } from '../collection/collection.entity';
import UserRoleEnum from '../../infra/shared/enum/user-role.enum';

@Injectable()
export class ChatGptToolsService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Filial) private filialRepo: Repository<Filial>,
    @InjectRepository(Cashflow) private cashflowRepo: Repository<Cashflow>,
    @InjectRepository(Kassa) private kassaRepo: Repository<Kassa>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transfer) private transferRepo: Repository<Transfer>,
    @InjectRepository(PlanYear) private planYearRepo: Repository<PlanYear>,
    @InjectRepository(Collection) private collectionRepo: Repository<Collection>,
  ) {}

  // ─── Period helpers ────────────────────────────────────────────────────────

  private getPeriodDates(period: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
        break;
      }
      case 'this_week': {
        const d = now.getDay() || 7;
        start = new Date(now);
        start.setDate(now.getDate() - d + 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default: // this_month
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
    }
    return { start, end };
  }

  // ─── Role helpers ──────────────────────────────────────────────────────────

  private canSeeAll(role: number): boolean {
    return [
      UserRoleEnum.BOSS,
      UserRoleEnum.ACCOUNTANT,
      UserRoleEnum.M_MANAGER,
    ].includes(role);
  }

  private async resolveFilialId(user: User, filialName?: string): Promise<string | null> {
    const role = user.position?.role;

    // Non-boss always locked to their own filial
    if (!this.canSeeAll(role)) {
      return user.filial?.id || null;
    }

    // Boss + specific filial name → look it up
    if (filialName) {
      const filial = await this.filialRepo.findOne({
        where: { title: ILike(`%${filialName}%`), isDeleted: false },
      });
      return filial?.id || null;
    }

    return null; // Boss with no filter = see all filials
  }

  private fmt(n: number | string | null): number {
    return Math.round(parseFloat(String(n ?? '0')) || 0);
  }

  private fmtKv(n: number | string | null): string {
    return (parseFloat(String(n ?? '0')) || 0).toFixed(2);
  }

  // ─── Fuzzy matching for carpet/collection names ───────────────────────────

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  private strSimilarity(a: string, b: string): number {
    const al = a.toLowerCase().trim();
    const bl = b.toLowerCase().trim();
    if (al === bl) return 1;
    const maxLen = Math.max(al.length, bl.length);
    if (maxLen === 0) return 1;
    return (maxLen - this.levenshtein(al, bl)) / maxLen;
  }

  private async fuzzyResolveSearch(term: string): Promise<string> {
    try {
      const rows: { title: string }[] = await this.productRepo.query(
        `SELECT DISTINCT c.title FROM collection c WHERE c.title IS NOT NULL LIMIT 500`,
      );
      let best = term;
      let bestSim = 0.5;
      for (const row of rows) {
        const sim = this.strSimilarity(term, row.title);
        if (sim > bestSim) {
          bestSim = sim;
          best = row.title;
        }
      }
      return best;
    } catch {
      return term;
    }
  }

  // ─── Tool definitions for OpenAI ──────────────────────────────────────────

  getToolDefinitions(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_sales_stats',
          description:
            "Savdo statistikasi: sotuvlar soni, umumiy summa, kvadrat metr, sof foyda. Davr va filial bo'yicha filtr.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_year'],
                description: "Davr: today=bugun, yesterday=kecha, this_week=bu hafta, this_month=bu oy, last_month=o'tgan oy, this_year=bu yil",
              },
              filial_name: {
                type: 'string',
                description: 'Filial nomi (faqat boss uchun). Masalan: "Chilonzor", "Yunusobod"',
              },
            },
            required: ['period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_top_sellers',
          description: "Eng ko'p sotgan sotuvchilar reytingi — ism, savdolar soni, summa, kvadrat metr.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year'],
              },
              filial_name: { type: 'string', description: 'Filial nomi (boss uchun ixtiyoriy)' },
              limit: { type: 'number', description: 'Natijalar soni (default 10)' },
            },
            required: ['period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_inventory',
          description: `Ombordagi mahsulotlar (gilamlar) — dona soni, umumiy kvadrat metr (KV), narx.
Kolleksiya nomi, gilam kodi, yoki o'lcham bo'yicha qidirish mumkin.
Seller BARCHA filiallarni ko'ra oladi (default). "Filialimda" desa faqat o'z filiali.
O'lcham qidirish: foydalanuvchi "3x4" desa — 300x400 sm formatiga o'tkaziladi va size.title bo'yicha topiladi.
KV hisoblash: (isMetric ? product.y : size.y) * size.x * product.count / 10000 (sm² → m²).
Har bir savolga mos ravishda dona, KV, narx qaytaradi.`,
          parameters: {
            type: 'object',
            properties: {
              filial_name: {
                type: 'string',
                description: "Filial nomi. Foydalanuvchi 'filialimda', 'mening filialimda', 'bizda' desa — 'my_filial' qiymatini yubor. Bo'sh qolsa barcha filiallar ko'rsatiladi.",
              },
              search: { type: 'string', description: "Qidirish: gilam kodi yoki kolleksiya nomi (masalan: 'Afshar', 'Premium')" },
              size: {
                type: 'string',
                description: "Gilam o'lchami. Foydalanuvchi metrda yozadi: '3x4', '2x3', '2.5x3.5'. Avtomatik sm ga o'tkaziladi: 3x4→300x400. Agar 10 dan katta (300x400) — o'zi bo'yicha qidiradi. size.title bo'yicha ILIKE qidiriladi.",
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_cashflow_stats',
          description: "Pul oqimi: kirim (tushum), chiqim (xarajat), qoldiq balans.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year'],
              },
              filial_name: { type: 'string', description: 'Filial nomi (boss uchun ixtiyoriy)' },
            },
            required: ['period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_client_debts',
          description: "Qarzdor mijozlar ro'yxati: ism, telefon, qarz summasi. Jami qarz.",
          parameters: {
            type: 'object',
            properties: {
              filial_name: { type: 'string', description: 'Filial nomi (boss uchun ixtiyoriy)' },
              limit: { type: 'number', description: "Ko'rsatish soni (default 10)" },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_kassa_status',
          description: "Hozirgi kassa holati: ochiq/yopiq, bugungi tushum, savdo soni, naqd pul qoldiq.",
          parameters: {
            type: 'object',
            properties: {
              filial_name: { type: 'string', description: 'Filial nomi (boss uchun ixtiyoriy)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_filials_overview',
          description: "Barcha filiallar solishtirmasi: har biri qancha sotdi, qancha foyda. FAQAT boss/boshqaruvchi uchun.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year'],
                description: 'Davr (default: this_month)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_my_stats',
          description: "Joriy foydalanuvchining SHAXSIY sotuvlari: nechta sotdim, qancha pul, qancha kv.m, foydam.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_year'],
              },
            },
            required: ['period'],
          },
        },
      },
      // ─── NEW: Seller-specific tools ────────────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'get_transfer_status',
          description: "Transferlar holati: qaysi gilamlar yo'lda, qayerdan qayerga, nechta, holati (jarayonda/qabul qilindi).",
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['all', 'progress', 'done'],
                description: "Transfer holati: all=barchasi, progress=yo'lda, done=yetib kelgan. Default: all",
              },
              filial_name: { type: 'string', description: 'Filial nomi (ixtiyoriy filtr)' },
              limit: { type: 'number', description: "Ko'rsatish soni (default 10)" },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_client_history',
          description: "Bitta mijozning xarid tarixi: oxirgi sotuvlari, qancha gilam olgan, qancha to'lagan, qarz holati.",
          parameters: {
            type: 'object',
            properties: {
              client_name: { type: 'string', description: "Mijoz ismi yoki telefon raqami" },
              limit: { type: 'number', description: "Ko'rsatish soni (default 5)" },
            },
            required: ['client_name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_my_kpi',
          description: "Shaxsiy KPI va reja bajarilishi: yillik reja, qancha bajarildi, foizi, qolgan maqsad.",
          parameters: {
            type: 'object',
            properties: {
              year: { type: 'number', description: 'Yil (default: joriy yil)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_collection_info',
          description: "Gilam kolleksiyasi haqida batafsil: nomi, narxi, ishlab chiqaruvchi davlat, fabrika, ombordagi qoldiq.",
          parameters: {
            type: 'object',
            properties: {
              collection_name: { type: 'string', description: "Kolleksiya nomi (masalan: 'Afshar', 'Premium', 'Silk Road')" },
            },
            required: ['collection_name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_daily_summary',
          description: "Kunlik qisqacha hisobot: bugungi savdolar, tushum, transferlar, kassa holati — hammasi bir joyda.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ];
  }

  // ─── Tool executor (router) ────────────────────────────────────────────────

  async executeTool(user: User, toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'get_sales_stats':
          return await this.getSalesStats(user, args.period, args.filial_name);
        case 'get_top_sellers':
          return await this.getTopSellers(user, args.period, args.filial_name, args.limit ?? 10);
        case 'get_inventory':
          return await this.getInventory(user, args.filial_name, args.search, args.size);
        case 'get_cashflow_stats':
          return await this.getCashflowStats(user, args.period, args.filial_name);
        case 'get_client_debts':
          return await this.getClientDebts(user, args.filial_name, args.limit ?? 10);
        case 'get_kassa_status':
          return await this.getKassaStatus(user, args.filial_name);
        case 'get_filials_overview':
          return await this.getFilialOverview(user, args.period ?? 'this_month');
        case 'get_my_stats':
          return await this.getMyStats(user, args.period);
        case 'get_transfer_status':
          return await this.getTransferStatus(user, args.status ?? 'all', args.filial_name, args.limit ?? 10);
        case 'get_client_history':
          return await this.getClientHistory(user, args.client_name, args.limit ?? 5);
        case 'get_my_kpi':
          return await this.getMyKpi(user, args.year ?? new Date().getFullYear());
        case 'get_collection_info':
          return await this.getCollectionInfo(user, args.collection_name);
        case 'get_daily_summary':
          return await this.getDailySummary(user);
        default:
          return { error: 'Bunday tool topilmadi' };
      }
    } catch (err: any) {
      console.error(`Tool error [${toolName}]:`, err.message);
      return { error: `Ma'lumot olishda xatolik: ${err.message}` };
    }
  }

  // ─── Existing implementations ─────────────────────────────────────────────

  async getSalesStats(user: User, period: string, filialName?: string) {
    const { start, end } = this.getPeriodDates(period);
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.seller', 'seller')
      .leftJoin('o.kassa', 'kassa')
      .leftJoin('kassa.filial', 'filial')
      .select([
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
        'COALESCE(SUM(o.kv), 0) as total_kv',
        'COALESCE(SUM(o.netProfitSum), 0) as total_profit',
        'COALESCE(SUM(o.discountSum), 0) as total_discount',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end });

    if (role === UserRoleEnum.SELLER || role === UserRoleEnum.OTHER) {
      qb.andWhere('seller.id = :uid', { uid: user.id });
    } else if (filialId) {
      qb.andWhere('filial.id = :fid', { fid: filialId });
    }

    const r = await qb.getRawOne();
    const filialLabel = filialId
      ? (await this.filialRepo.findOne({ where: { id: filialId } }))?.title
      : this.canSeeAll(role)
      ? 'Barcha filiallar'
      : user.filial?.title ?? '';

    return {
      period,
      filial: filialLabel,
      total_count: parseInt(r.cnt) || 0,
      total_sum: this.fmt(r.total_sum),
      total_kv: this.fmtKv(r.total_kv),
      total_profit: this.fmt(r.total_profit),
      total_discount: this.fmt(r.total_discount),
    };
  }

  async getTopSellers(user: User, period: string, filialName?: string, limit = 10) {
    const { start, end } = this.getPeriodDates(period);
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.seller', 'seller')
      .leftJoin('o.kassa', 'kassa')
      .leftJoin('kassa.filial', 'filial')
      .select([
        'seller.id as sid',
        'seller.firstName as fname',
        'seller.lastName as lname',
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
        'COALESCE(SUM(o.kv), 0) as total_kv',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end })
      .groupBy('seller.id, seller.firstName, seller.lastName')
      .orderBy('SUM(o.price)', 'DESC')
      .limit(limit);

    if (filialId) {
      qb.andWhere('filial.id = :fid', { fid: filialId });
    } else if (!this.canSeeAll(role)) {
      qb.andWhere('filial.id = :fid', { fid: user.filial?.id });
    }

    const rows = await qb.getRawMany();
    return {
      period,
      sellers: rows.map((r, i) => ({
        rank: i + 1,
        name: `${r.lname ?? ''} ${r.fname ?? ''}`.trim() || "Noma'lum",
        order_count: parseInt(r.cnt) || 0,
        total_sum: this.fmt(r.total_sum),
        total_kv: this.fmtKv(r.total_kv),
      })),
    };
  }

  /**
   * Parse user size input and generate title for DB matching.
   * "3x4"     → { x: 300, y: 400, title: "300x400" }   (meters → cm)
   * "2.5x3.5" → { x: 250, y: 350, title: "250x350" }
   * "300x400"  → { x: 300, y: 400, title: "300x400" }  (already cm)
   */
  private parseSizeInput(sizeStr: string): { x: number; y: number; title: string } | null {
    // Support: 3x4, 3*4, 3х4 (cyrillic), 3×4, 3X4, 3 x 4
    const match = sizeStr.match(/^(\d+(?:[.,]\d+)?)\s*[xXхХ*×]\s*(\d+(?:[.,]\d+)?)$/);
    if (!match) return null;

    let x = parseFloat(match[1].replace(',', '.'));
    let y = parseFloat(match[2].replace(',', '.'));

    // If x < 10, user wrote in meters — convert to cm
    if (x < 10) {
      x = Math.round(x * 100);
      y = Math.round(y * 100);
    }

    return { x, y, title: `${x}x${y}` };
  }

  async getInventory(user: User, filialName?: string, search?: string, size?: string) {
    // ─── Filial logic: seller sees ALL filials by default ─────────────────────
    let filialId: string | null = null;
    let showAllFilials = true;

    if (filialName === 'my_filial') {
      filialId = user.filial?.id || null;
      showAllFilials = false;
    } else if (filialName) {
      const filial = await this.filialRepo.findOne({
        where: { title: ILike(`%${filialName}%`), isDeleted: false },
      });
      filialId = filial?.id || null;
      showAllFilials = false;
    }

    // ─── Parse size ──────────────────────────────────────────────────────────
    const parsedSize = size ? this.parseSizeInput(size) : null;

    // ─── Build WHERE conditions ──────────────────────────────────────────────
    const params: any = {};
    const conditions: string[] = ['p.is_deleted = false', 'p.count > 0'];

    if (filialId) {
      conditions.push('p."filialId" = :fid');
      params.fid = filialId;
    }

    // Size filter: match by size.title (e.g., "300x400")
    if (parsedSize) {
      // Try both title formats and x/y numeric match for reliability
      conditions.push(
        `(s.title ILIKE :sizeTitle OR (ROUND(CAST(s.x AS NUMERIC)) = :sx AND ROUND(CAST(s.y AS NUMERIC)) = :sy))`,
      );
      params.sizeTitle = `%${parsedSize.title}%`;
      params.sx = parsedSize.x;
      params.sy = parsedSize.y;
    }

    // Search by collection name or product code
    let resolvedSearch: string | null = null;
    if (search) {
      const exactCount = await this.productRepo.query(
        `SELECT COUNT(*) as cnt FROM product p
         LEFT JOIN qrbase q ON p."barCodeId" = q.id
         LEFT JOIN collection c ON q."collectionId" = c.id
         WHERE (p.code ILIKE $1 OR c.title ILIKE $1)`,
        [`%${search}%`],
      );
      resolvedSearch = parseInt(exactCount[0]?.cnt) === 0 ? await this.fuzzyResolveSearch(search) : search;
      conditions.push('(p.code ILIKE :search OR c.title ILIKE :search)');
      params.search = `%${resolvedSearch}%`;
    }

    const whereClause = conditions.join(' AND ');

    // ─── Convert named params to positional for raw SQL ─────────────────────
    const { sql: positionalWhere, values: queryValues } = this.toPositionalParams(whereClause, params);

    const baseJoins = `FROM product p
      LEFT JOIN qrbase q ON p."barCodeId" = q.id
      LEFT JOIN collection c ON q."collectionId" = c.id
      LEFT JOIN size s ON q."sizeId" = s.id
      LEFT JOIN filial f ON p."filialId" = f.id
      LEFT JOIN "collection-price" cp ON q."collectionId" = cp."collectionId"`;

    // KV formula: (isMetric ? p.y : s.y) * s.x * p.count / 10000  (cm² → m²)
    const kvExpr = `(CASE WHEN q."isMetric" = true THEN p.y ELSE s.y END) * s.x * p.count / 10000`;

    // ─── Main aggregation query with proper KV formula ───────────────────────
    const summaryByFilial: any[] = await this.productRepo.query(
      `SELECT
        f.id AS filial_id,
        f.title AS filial_name,
        COUNT(p.id) AS unique_products,
        COALESCE(SUM(p.count), 0) AS total_pieces,
        COALESCE(SUM(${kvExpr}), 0)::NUMERIC(20,2) AS total_kv,
        COALESCE(SUM(${kvExpr} * COALESCE(cp."priceMeter", c."priceMeter", 0)), 0)::NUMERIC(20,2) AS total_price
      ${baseJoins}
      WHERE ${positionalWhere}
      GROUP BY f.id, f.title
      ORDER BY SUM(p.count) DESC`,
      queryValues,
    );

    // ─── Totals ──────────────────────────────────────────────────────────────
    const totalPieces = summaryByFilial.reduce((s, r) => s + (parseInt(r.total_pieces) || 0), 0);
    const totalKv = summaryByFilial.reduce((s, r) => s + (parseFloat(r.total_kv) || 0), 0);
    const totalUnique = summaryByFilial.reduce((s, r) => s + (parseInt(r.unique_products) || 0), 0);
    const totalPrice = summaryByFilial.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);

    // ─── Product details (when search or size filter is active) ──────────────
    let products: any[] = [];
    if (search || parsedSize) {
      const detailRows: any[] = await this.productRepo.query(
        `SELECT
          p.code,
          c.title AS collection_name,
          s.title AS size_title,
          f.title AS filial_name,
          p.count,
          (${kvExpr})::NUMERIC(20,2) AS kv,
          (${kvExpr} * COALESCE(cp."priceMeter", c."priceMeter", 0))::NUMERIC(20,2) AS price
        ${baseJoins}
        WHERE ${positionalWhere}
        ORDER BY p.count DESC
        LIMIT 20`,
        queryValues,
      );

      products = detailRows.map((r) => ({
        code: r.code,
        collection: r.collection_name,
        size: r.size_title,
        filial: r.filial_name,
        count: parseInt(r.count) || 0,
        kv: this.fmtKv(r.kv),
        price: this.fmt(r.price),
      }));
    }

    const filialLabel = filialId
      ? (await this.filialRepo.findOne({ where: { id: filialId } }))?.title ?? user.filial?.title
      : 'Barcha filiallar';

    return {
      filial: filialLabel,
      unique_products: totalUnique,
      total_pieces: totalPieces,
      total_kv: this.fmtKv(totalKv),
      total_price: this.fmt(totalPrice),
      ...(showAllFilials && summaryByFilial.length > 1
        ? {
            by_filial: summaryByFilial.map((r) => ({
              filial: r.filial_name,
              pieces: parseInt(r.total_pieces) || 0,
              kv: this.fmtKv(r.total_kv),
              price: this.fmt(r.total_price),
            })),
          }
        : {}),
      ...(products.length > 0 ? { products } : {}),
      ...(parsedSize ? { size_filter: `${parsedSize.x}x${parsedSize.y} sm` } : {}),
    };
  }

  /**
   * Convert named params (:paramName) in SQL to positional ($1, $2...).
   * Returns { sql: converted SQL, values: param values array }.
   */
  private toPositionalParams(sql: string, params: Record<string, any>): { sql: string; values: any[] } {
    const values: any[] = [];
    let idx = 0;
    let result = sql;

    // Sort by length descending so longer param names are replaced first (e.g., :sizeTitle before :sx)
    const keys = Object.keys(params).sort((a, b) => b.length - a.length);

    for (const key of keys) {
      const placeholder = `:${key}`;
      if (result.includes(placeholder)) {
        idx++;
        values.push(params[key]);
        result = result.split(placeholder).join(`$${idx}`);
      }
    }

    return { sql: result, values };
  }

  async getCashflowStats(user: User, period: string, filialName?: string) {
    const { start, end } = this.getPeriodDates(period);
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const qb = this.cashflowRepo
      .createQueryBuilder('cf')
      .leftJoin('cf.filial', 'filial')
      .select([
        "COALESCE(SUM(CASE WHEN cf.type = 'InCome' THEN cf.price ELSE 0 END), 0) as income",
        "COALESCE(SUM(CASE WHEN cf.type = 'OutCome' THEN cf.price ELSE 0 END), 0) as outcome",
      ])
      .where('cf.date BETWEEN :start AND :end', { start, end })
      .andWhere('cf.is_cancelled = false');

    if (filialId) {
      qb.andWhere('filial.id = :fid', { fid: filialId });
    } else if (!this.canSeeAll(role) && user.filial?.id) {
      qb.andWhere('filial.id = :fid', { fid: user.filial.id });
    }

    const r = await qb.getRawOne();
    const income = this.fmt(r.income);
    const outcome = this.fmt(r.outcome);
    const filialLabel = filialId
      ? (await this.filialRepo.findOne({ where: { id: filialId } }))?.title
      : this.canSeeAll(role)
      ? 'Barcha filiallar'
      : user.filial?.title ?? '';

    return {
      period,
      filial: filialLabel,
      income,
      outcome,
      balance: income - outcome,
    };
  }

  async getClientDebts(user: User, filialName?: string, limit = 10) {
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const baseQb = () =>
      this.clientRepo
        .createQueryBuilder('c')
        .leftJoin('c.filial', 'filial')
        .where('c.owed > 0');

    const applyFilter = (qb: ReturnType<typeof baseQb>) => {
      if (filialId) qb.andWhere('filial.id = :fid', { fid: filialId });
      else if (!this.canSeeAll(role) && user.filial?.id)
        qb.andWhere('filial.id = :fid', { fid: user.filial.id });
    };

    const totalQb = baseQb().select('COALESCE(SUM(c.owed), 0) as total');
    applyFilter(totalQb);
    const totalR = await totalQb.getRawOne();

    const listQb = baseQb()
      .select(['c.fullName as name', 'c.phone as phone', 'c.owed as owed'])
      .orderBy('c.owed', 'DESC')
      .limit(limit);
    applyFilter(listQb);
    const rows = await listQb.getRawMany();

    const filialLabel = filialId
      ? (await this.filialRepo.findOne({ where: { id: filialId } }))?.title
      : this.canSeeAll(role)
      ? 'Barcha filiallar'
      : user.filial?.title ?? '';

    return {
      filial: filialLabel,
      total_debt: this.fmt(totalR.total),
      top_debtors: rows.map((r) => ({
        name: r.name,
        phone: r.phone,
        owed: this.fmt(r.owed),
      })),
    };
  }

  async getKassaStatus(user: User, filialName?: string) {
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const qb = this.kassaRepo
      .createQueryBuilder('k')
      .leftJoin('k.filial', 'filial')
      .select([
        'filial.title as filial_name',
        'k.status as status',
        'k.totalSellCount as sell_count',
        'k.totalSum as total_sum',
        'k.in_hand as in_hand',
        'k.debt_count as debt_count',
        'k.debt_sum as debt_sum',
        'k.startDate as start_date',
      ])
      .orderBy('k.startDate', 'DESC');

    if (filialId) {
      qb.andWhere('filial.id = :fid', { fid: filialId }).limit(1);
    } else if (!this.canSeeAll(role) && user.filial?.id) {
      qb.andWhere('filial.id = :fid', { fid: user.filial.id }).limit(1);
    } else {
      qb.limit(20);
    }

    const rows = await qb.getRawMany();
    if (!rows.length) return { message: 'Kassa topilmadi' };

    const map = (r: any) => ({
      filial: r.filial_name,
      status: r.status === 'open' ? 'Ochiq' : 'Yopiq',
      sell_count: parseInt(r.sell_count) || 0,
      total_sum: this.fmt(r.total_sum),
      in_hand: this.fmt(r.in_hand),
      debt_count: parseInt(r.debt_count) || 0,
      debt_sum: this.fmt(r.debt_sum),
    });

    return rows.length === 1 ? map(rows[0]) : { kassas: rows.map(map) };
  }

  async getFilialOverview(user: User, period: string) {
    const role = user.position?.role;
    if (!this.canSeeAll(role)) {
      return { error: "Bu ma'lumot faqat boss uchun mavjud" };
    }

    const { start, end } = this.getPeriodDates(period);

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.kassa', 'kassa')
      .leftJoin('kassa.filial', 'filial')
      .select([
        'filial.title as filial_name',
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
        'COALESCE(SUM(o.kv), 0) as total_kv',
        'COALESCE(SUM(o.netProfitSum), 0) as total_profit',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end })
      .groupBy('filial.id, filial.title')
      .orderBy('SUM(o.price)', 'DESC')
      .getRawMany();

    return {
      period,
      filials: rows.map((r) => ({
        name: r.filial_name,
        order_count: parseInt(r.cnt) || 0,
        total_sum: this.fmt(r.total_sum),
        total_kv: this.fmtKv(r.total_kv),
        total_profit: this.fmt(r.total_profit),
      })),
      grand_total: this.fmt(rows.reduce((s, r) => s + parseFloat(r.total_sum ?? '0'), 0)),
    };
  }

  async getMyStats(user: User, period: string) {
    const { start, end } = this.getPeriodDates(period);

    const r = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.seller', 'seller')
      .select([
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
        'COALESCE(SUM(o.kv), 0) as total_kv',
        'COALESCE(SUM(o.netProfitSum), 0) as total_profit',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end })
      .andWhere('seller.id = :uid', { uid: user.id })
      .getRawOne();

    return {
      period,
      name: `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim() || 'Men',
      position: user.position?.title,
      filial: user.filial?.title,
      order_count: parseInt(r.cnt) || 0,
      total_sum: this.fmt(r.total_sum),
      total_kv: this.fmtKv(r.total_kv),
      total_profit: this.fmt(r.total_profit),
    };
  }

  // ─── NEW: Seller-specific tool implementations ────────────────────────────

  async getTransferStatus(user: User, status: string, filialName?: string, limit = 10) {
    const role = user.position?.role;
    const filialId = await this.resolveFilialId(user, filialName);

    const qb = this.transferRepo
      .createQueryBuilder('t')
      .leftJoin('t.from', 'fromFilial')
      .leftJoin('t.to', 'toFilial')
      .leftJoin('t.product', 'product')
      .leftJoin('product.bar_code', 'qr')
      .leftJoin('qr.collection', 'col')
      .select([
        't.id as id',
        't.count as count',
        't.kv as kv',
        't.date as date',
        't.progress as status',
        'fromFilial.title as from_filial',
        'toFilial.title as to_filial',
        'col.title as collection_name',
        'product.code as product_code',
      ])
      .orderBy('t.date', 'DESC')
      .limit(limit);

    if (status === 'progress') {
      qb.where("t.progress = 'Processing'");
    } else if (status === 'done') {
      qb.where("t.progress != 'Processing'");
    }

    // Filial filter: seller sees transfers to/from their filial
    if (filialId) {
      qb.andWhere('(fromFilial.id = :fid OR toFilial.id = :fid)', { fid: filialId });
    } else if (!this.canSeeAll(role) && user.filial?.id) {
      qb.andWhere('(fromFilial.id = :fid OR toFilial.id = :fid)', { fid: user.filial.id });
    }

    const rows = await qb.getRawMany();

    const progressCount = rows.filter((r) => r.status === 'Processing').length;
    const doneCount = rows.filter((r) => r.status !== 'Processing').length;

    return {
      total_shown: rows.length,
      in_progress: progressCount,
      completed: doneCount,
      transfers: rows.map((r) => ({
        from: r.from_filial,
        to: r.to_filial,
        collection: r.collection_name,
        code: r.product_code,
        count: parseInt(r.count) || 0,
        kv: this.fmtKv(r.kv),
        status: r.status === 'Processing' ? "Yo'lda" : 'Yetib kelgan',
        date: r.date,
      })),
    };
  }

  async getClientHistory(user: User, clientName: string, limit = 5) {
    const role = user.position?.role;

    // Find client by name or phone (fuzzy)
    const clientQb = this.clientRepo
      .createQueryBuilder('c')
      .leftJoin('c.filial', 'filial')
      .where('(c.fullName ILIKE :name OR c.phone ILIKE :name)', { name: `%${clientName}%` });

    if (!this.canSeeAll(role) && user.filial?.id) {
      clientQb.andWhere('filial.id = :fid', { fid: user.filial.id });
    }

    const client = await clientQb.getOne();
    if (!client) {
      return { error: `"${clientName}" nomli mijoz topilmadi` };
    }

    // Get client's orders
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.product', 'product')
      .leftJoin('product.bar_code', 'qr')
      .leftJoin('qr.collection', 'col')
      .leftJoin('o.seller', 'seller')
      .select([
        'o.date as date',
        'o.price as price',
        'o.kv as kv',
        'o.isDebt as is_debt',
        'col.title as collection_name',
        'product.code as product_code',
        "CONCAT(seller.lastName, ' ', seller.firstName) as seller_name",
      ])
      .where('o.clientId = :cid', { cid: client.id })
      .orderBy('o.date', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      client_name: client.fullName,
      phone: client.phone,
      total_given: this.fmt(client.given),
      total_owed: this.fmt(client.owed),
      recent_orders: orders.map((o) => ({
        date: o.date,
        collection: o.collection_name,
        code: o.product_code,
        price: this.fmt(o.price),
        kv: this.fmtKv(o.kv),
        is_debt: o.is_debt,
        seller: o.seller_name?.trim(),
      })),
    };
  }

  async getMyKpi(user: User, year: number) {
    const currentYear = new Date().getFullYear();
    const targetYear = year || currentYear;

    // Get plan for user
    const plan = await this.planYearRepo.findOne({
      where: { user: { id: user.id }, year: targetYear },
      relations: ['filial'],
    });

    // Get actual sales for this year
    const { start, end } = this.getPeriodDates('this_year');
    const salesR = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.seller', 'seller')
      .select([
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
        'COALESCE(SUM(o.kv), 0) as total_kv',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end })
      .andWhere('seller.id = :uid', { uid: user.id })
      .getRawOne();

    // Monthly breakdown
    const monthlyR = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.seller', 'seller')
      .select([
        'EXTRACT(MONTH FROM o.date) as month',
        'COUNT(o.id) as cnt',
        'COALESCE(SUM(o.price), 0) as total_sum',
      ])
      .where('o.date BETWEEN :start AND :end', { start, end })
      .andWhere('seller.id = :uid', { uid: user.id })
      .groupBy('EXTRACT(MONTH FROM o.date)')
      .orderBy('EXTRACT(MONTH FROM o.date)', 'ASC')
      .getRawMany();

    const yearlyGoal = plan?.yearlyGoal || 0;
    const collected = this.fmt(salesR.total_sum);
    const percent = yearlyGoal > 0 ? Math.round((collected / yearlyGoal) * 100) : 0;

    return {
      year: targetYear,
      name: `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim(),
      yearly_goal: this.fmt(yearlyGoal),
      collected: collected,
      percent: percent,
      remaining: Math.max(0, this.fmt(yearlyGoal) - collected),
      total_orders: parseInt(salesR.cnt) || 0,
      total_kv: this.fmtKv(salesR.total_kv),
      monthly_breakdown: monthlyR.map((m) => ({
        month: parseInt(m.month),
        orders: parseInt(m.cnt) || 0,
        sum: this.fmt(m.total_sum),
      })),
    };
  }

  async getCollectionInfo(user: User, collectionName: string) {
    // Fuzzy search for collection
    const resolvedName = await this.fuzzyResolveSearch(collectionName);

    const collection = await this.collectionRepo.findOne({
      where: { title: ILike(`%${resolvedName}%`) },
      relations: ['country', 'factory'],
    });

    if (!collection) {
      return { error: `"${collectionName}" nomli kolleksiya topilmadi` };
    }

    // Get stock info for this collection
    const role = user.position?.role;
    const stockQb = this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.bar_code', 'qr')
      .leftJoin('qr.collection', 'col')
      .leftJoin('p.filial', 'filial')
      .select([
        'filial.title as filial_name',
        'COALESCE(SUM(p.count), 0) as pieces',
        'COALESCE(SUM(p.totalSize), 0) as total_kv',
      ])
      .where('col.id = :cid', { cid: collection.id })
      .andWhere('p.is_deleted = false')
      .andWhere('p.count > 0')
      .groupBy('filial.id, filial.title');

    if (!this.canSeeAll(role) && user.filial?.id) {
      stockQb.andWhere('filial.id = :fid', { fid: user.filial.id });
    }

    const stockRows = await stockQb.getRawMany();

    return {
      name: collection.title,
      country: collection.country?.title || "Noma'lum",
      factory: collection.factory?.title || "Noma'lum",
      price_per_meter: this.fmt(collection.priceMeter),
      second_price: this.fmt(collection.secondPrice),
      coming_price: this.fmt(collection.comingPrice),
      description: collection.description || '',
      stock_by_filial: stockRows.map((r) => ({
        filial: r.filial_name,
        pieces: parseInt(r.pieces) || 0,
        kv: this.fmtKv(r.total_kv),
      })),
      total_pieces: stockRows.reduce((s, r) => s + (parseInt(r.pieces) || 0), 0),
      total_kv: this.fmtKv(stockRows.reduce((s, r) => s + (parseFloat(r.total_kv) || 0), 0)),
    };
  }

  async getDailySummary(user: User) {
    const role = user.position?.role;
    const isSeller = role === UserRoleEnum.SELLER || role === UserRoleEnum.OTHER;

    // Today's sales
    const sales = isSeller
      ? await this.getMyStats(user, 'today')
      : await this.getSalesStats(user, 'today');

    // Kassa
    const kassa = await this.getKassaStatus(user);

    // Transfers in progress (to/from my filial)
    const transfers = await this.getTransferStatus(user, 'progress', undefined, 5);

    // Debts summary
    const debts = await this.getClientDebts(user, undefined, 5);

    return {
      date: new Date().toISOString().split('T')[0],
      sales,
      kassa,
      active_transfers: {
        count: transfers.in_progress,
        items: transfers.transfers?.slice(0, 3),
      },
      debts_summary: {
        total_debt: debts.total_debt,
        top_debtors_count: debts.top_debtors?.length || 0,
      },
    };
  }
}
