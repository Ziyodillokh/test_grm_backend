import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SalesQueryDto } from './dto';

@Injectable()
export class SalesReportService {
  constructor(private readonly dataSource: DataSource) {}

  // ===================================================================
  // 1) Filial sales — top-level or drill-down
  // ===================================================================

  async getFilialSales(dto: SalesQueryDto, filialTypes: string[] = ['filial', 'warehouse']) {
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      filialId,
      groupBy = filialId ? 'country' : 'filial',
      countryId,
      factoryId,
      collectionId,
      modelId,
      search,
      page = 1,
      limit = 50,
    } = dto;

    // Top-level: list filials with their sales totals
    if (!filialId) {
      return this.filialSalesTopLevel(year, month, filialTypes, search, page, limit);
    }

    // Drill-down: group by dimension within a specific filial
    return this.filialSalesDrillDown(
      year, month, filialId, groupBy,
      countryId, factoryId, collectionId, modelId,
      search, page, limit,
    );
  }

  private async filialSalesTopLevel(
    year: number, month: number,
    filialTypes: string[],
    search?: string,
    page = 1, limit = 50,
  ) {
    const params: any[] = [year, month];
    let idx = 3;

    const typeList = filialTypes.map(() => `$${idx++}`).join(',');
    params.push(...filialTypes);

    let searchWhere = '';
    if (search) {
      searchWhere = ` AND f.title ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    const dataQuery = `
      SELECT
        f.id,
        f.title AS "title",
        COALESCE(SUM(o.x), 0)::int AS "count",
        COALESCE(SUM(o.kv), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(o.price + o."plasticSum"), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(o."netProfitSum"), 0)::numeric(20,2) AS "profit",
        COALESCE(SUM(o."discountSum"), 0)::numeric(20,2) AS "discount"
      FROM filial f
      LEFT JOIN kassa k ON k."filialId" = f.id AND k."deletedDate" IS NULL
      LEFT JOIN "order" o ON o."kassaId" = k.id
        AND o.status = 'accepted'
        AND EXTRACT(YEAR FROM o.date) = $1
        AND EXTRACT(MONTH FROM o.date) = $2
      WHERE f.type IN (${typeList})
        AND f."isDeleted" = false
        AND f."deletedDate" IS NULL
        ${searchWhere}
      GROUP BY f.id, f.title
      HAVING COALESCE(SUM(o.x), 0) > 0 OR COALESCE(SUM(o.kv), 0) > 0
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      SELECT
        COALESCE(SUM(o.x), 0)::int AS "totalCount",
        COALESCE(SUM(o.kv), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(o.price + o."plasticSum"), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(o."netProfitSum"), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(o."discountSum"), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(DISTINCT f.id)::int AS "totalGroups"
      FROM filial f
      LEFT JOIN kassa k ON k."filialId" = f.id AND k."deletedDate" IS NULL
      LEFT JOIN "order" o ON o."kassaId" = k.id
        AND o.status = 'accepted'
        AND EXTRACT(YEAR FROM o.date) = $1
        AND EXTRACT(MONTH FROM o.date) = $2
      WHERE f.type IN (${typeList})
        AND f."isDeleted" = false
        AND f."deletedDate" IS NULL
        ${searchWhere}
        AND (o.x > 0 OR o.kv > 0)
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  private async filialSalesDrillDown(
    year: number, month: number,
    filialId: string, groupBy: string,
    countryId?: string, factoryId?: string,
    collectionId?: string, modelId?: string,
    search?: string,
    page = 1, limit = 50,
  ) {
    const { groupCol, groupTitle, groupJoin } = this.resolveGrouping(groupBy);

    const params: any[] = [year, month, filialId];
    let idx = 4;

    let drillWhere = '';
    if (countryId) { drillWhere += ` AND q."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { drillWhere += ` AND q."factoryId" = $${idx++}`; params.push(factoryId); }
    if (collectionId) { drillWhere += ` AND q."collectionId" = $${idx++}`; params.push(collectionId); }
    if (modelId) { drillWhere += ` AND q."modelId" = $${idx++}`; params.push(modelId); }
    if (search) { drillWhere += ` AND ${groupTitle} ILIKE $${idx++}`; params.push(`%${search}%`); }

    const dataQuery = `
      SELECT
        ${groupCol} AS "id",
        ${groupTitle} AS "title",
        COALESCE(SUM(o.x), 0)::int AS "count",
        COALESCE(SUM(o.kv), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(o.price + o."plasticSum"), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(o."netProfitSum"), 0)::numeric(20,2) AS "profit",
        COALESCE(SUM(o."discountSum"), 0)::numeric(20,2) AS "discount"
      FROM "order" o
      JOIN product p ON o."productId" = p.id
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN kassa k ON o."kassaId" = k.id
      ${groupJoin}
      WHERE o.status = 'accepted'
        AND EXTRACT(YEAR FROM o.date) = $1
        AND EXTRACT(MONTH FROM o.date) = $2
        AND k."filialId" = $3
        ${drillWhere}
      GROUP BY ${groupCol}, ${groupTitle}
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      SELECT
        COALESCE(SUM(o.x), 0)::int AS "totalCount",
        COALESCE(SUM(o.kv), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(o.price + o."plasticSum"), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(o."netProfitSum"), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(o."discountSum"), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(DISTINCT ${groupCol})::int AS "totalGroups"
      FROM "order" o
      JOIN product p ON o."productId" = p.id
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN kassa k ON o."kassaId" = k.id
      ${groupJoin}
      WHERE o.status = 'accepted'
        AND EXTRACT(YEAR FROM o.date) = $1
        AND EXTRACT(MONTH FROM o.date) = $2
        AND k."filialId" = $3
        ${drillWhere}
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  // ===================================================================
  // 2) Internet sales — same as filial but type='market'
  // ===================================================================

  async getInternetSales(dto: SalesQueryDto) {
    return this.getFilialSales(dto, ['market']);
  }

  // ===================================================================
  // 3) Dealer sales — top-level or drill-down
  // ===================================================================

  async getDealerSales(dto: SalesQueryDto) {
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      dealerId,
      groupBy = dealerId ? 'country' : 'dealer',
      countryId,
      factoryId,
      collectionId,
      modelId,
      search,
      page = 1,
      limit = 50,
    } = dto;

    if (!dealerId) {
      return this.dealerSalesTopLevel(year, month, search, page, limit);
    }

    return this.dealerSalesDrillDown(
      year, month, dealerId, groupBy,
      countryId, factoryId, collectionId, modelId,
      search, page, limit,
    );
  }

  private async dealerSalesTopLevel(
    year: number, month: number,
    search?: string,
    page = 1, limit = 50,
  ) {
    const params: any[] = [year, month];
    let idx = 3;

    let searchWhere = '';
    if (search) {
      searchWhere = ` AND f.title ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    const dataQuery = `
      SELECT
        f.id,
        f.title AS "title",
        COALESCE(SUM(pt.total_count), 0)::int AS "count",
        COALESCE(SUM(pt.total_kv), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(pt.total_sum), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(pt.total_profit), 0)::numeric(20,2) AS "profit",
        COALESCE(SUM(pt.total_discount), 0)::numeric(20,2) AS "discount"
      FROM filial f
      LEFT JOIN package_transfer pt ON pt."dealerId" = f.id
        AND pt.status = 'accepted'
        AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
        AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
      WHERE f.type = 'dealer'
        AND f."isDeleted" = false
        AND f."deletedDate" IS NULL
        ${searchWhere}
      GROUP BY f.id, f.title
      HAVING COALESCE(SUM(pt.total_count), 0) > 0 OR COALESCE(SUM(pt.total_kv), 0) > 0
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      SELECT
        COALESCE(SUM(pt.total_count), 0)::int AS "totalCount",
        COALESCE(SUM(pt.total_kv), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(pt.total_sum), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(pt.total_profit), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(pt.total_discount), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(DISTINCT f.id)::int AS "totalGroups"
      FROM filial f
      LEFT JOIN package_transfer pt ON pt."dealerId" = f.id
        AND pt.status = 'accepted'
        AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
        AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
      WHERE f.type = 'dealer'
        AND f."isDeleted" = false
        AND f."deletedDate" IS NULL
        ${searchWhere}
        AND (pt.total_count > 0 OR pt.total_kv > 0)
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  private async dealerSalesDrillDown(
    year: number, month: number,
    dealerId: string, groupBy: string,
    countryId?: string, factoryId?: string,
    collectionId?: string, modelId?: string,
    search?: string,
    page = 1, limit = 50,
  ) {
    const { groupCol, groupTitle, groupJoin } = this.resolveGrouping(groupBy);

    const params: any[] = [year, month, dealerId];
    let idx = 4;

    let drillWhere = '';
    if (countryId) { drillWhere += ` AND q."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { drillWhere += ` AND q."factoryId" = $${idx++}`; params.push(factoryId); }
    if (collectionId) { drillWhere += ` AND q."collectionId" = $${idx++}`; params.push(collectionId); }
    if (modelId) { drillWhere += ` AND q."modelId" = $${idx++}`; params.push(modelId); }
    if (search) { drillWhere += ` AND ${groupTitle} ILIKE $${idx++}`; params.push(`%${search}%`); }

    const dataQuery = `
      SELECT
        ${groupCol} AS "id",
        ${groupTitle} AS "title",
        COALESCE(SUM(t.count), 0)::int AS "count",
        COALESCE(SUM(t.kv), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(t.kv * pcp."dealerPriceMeter"), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(t.kv * (pcp."dealerPriceMeter" - t."comingPrice")), 0)::numeric(20,2) AS "profit",
        COALESCE(SUM(t.kv * (p."priceMeter" - pcp."dealerPriceMeter")), 0)::numeric(20,2) AS "discount"
      FROM transfer t
      JOIN package_transfer pt ON t."packageId" = pt.id
      JOIN product p ON t."productId" = p.id
      JOIN qrbase q ON p."barCodeId" = q.id
      LEFT JOIN "package-collection-price" pcp
        ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
      ${groupJoin}
      WHERE t.for_dealer = true
        AND t.progres = 'Accepted'
        AND pt.status = 'accepted'
        AND pt."dealerId" = $3
        AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
        AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
        ${drillWhere}
      GROUP BY ${groupCol}, ${groupTitle}
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      SELECT
        COALESCE(SUM(t.count), 0)::int AS "totalCount",
        COALESCE(SUM(t.kv), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(t.kv * pcp."dealerPriceMeter"), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(t.kv * (pcp."dealerPriceMeter" - t."comingPrice")), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(t.kv * (p."priceMeter" - pcp."dealerPriceMeter")), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(DISTINCT ${groupCol})::int AS "totalGroups"
      FROM transfer t
      JOIN package_transfer pt ON t."packageId" = pt.id
      JOIN product p ON t."productId" = p.id
      JOIN qrbase q ON p."barCodeId" = q.id
      LEFT JOIN "package-collection-price" pcp
        ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
      ${groupJoin}
      WHERE t.for_dealer = true
        AND t.progres = 'Accepted'
        AND pt.status = 'accepted'
        AND pt."dealerId" = $3
        AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
        AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
        ${drillWhere}
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  // ===================================================================
  // 4) Partiya sales — top-level or drill-down
  // ===================================================================

  async getPartiyaSales(dto: SalesQueryDto) {
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      partiyaId,
      groupBy = 'collection',
      countryId,
      factoryId,
      collectionId,
      modelId,
      search,
      page = 1,
      limit = 50,
    } = dto;

    if (!partiyaId) {
      return this.partiyaSalesTopLevel(year, month, search, page, limit);
    }

    return this.partiyaSalesDrillDown(
      year, month, partiyaId, groupBy,
      countryId, factoryId, collectionId, modelId,
      search, page, limit,
    );
  }

  private async partiyaSalesTopLevel(
    year: number, month: number,
    search?: string,
    page = 1, limit = 50,
  ) {
    const params: any[] = [year, month];
    let idx = 3;

    let searchWhere = '';
    if (search) {
      searchWhere = ` AND pn.title ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    const dataQuery = `
      WITH order_sales AS (
        SELECT p."partiyaId",
          SUM(o.x)::int AS sold_count,
          SUM(o.kv) AS sold_kv,
          SUM(o.price + o."plasticSum") AS sold_sum,
          SUM(o."netProfitSum") AS profit,
          SUM(o."discountSum") AS discount
        FROM "order" o
        JOIN product p ON o."productId" = p.id
        WHERE o.status = 'accepted'
          AND EXTRACT(YEAR FROM o.date) = $1
          AND EXTRACT(MONTH FROM o.date) = $2
        GROUP BY p."partiyaId"
      ),
      dealer_sales AS (
        SELECT p."partiyaId",
          SUM(t.count)::int AS sold_count,
          SUM(t.kv) AS sold_kv,
          SUM(t.kv * pcp."dealerPriceMeter") AS sold_sum,
          SUM(t.kv * (pcp."dealerPriceMeter" - t."comingPrice")) AS profit,
          SUM(t.kv * (p."priceMeter" - pcp."dealerPriceMeter")) AS discount
        FROM transfer t
        JOIN product p ON t."productId" = p.id
        JOIN package_transfer pt ON t."packageId" = pt.id
        JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN "package-collection-price" pcp
          ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
        WHERE t.for_dealer = true
          AND t.progres = 'Accepted'
          AND pt.status = 'accepted'
          AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
          AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
        GROUP BY p."partiyaId"
      )
      SELECT
        pa.id AS "partiyaId",
        pn.title AS "partiyaNo",
        c.title AS "country",
        fac.title AS "factory",
        pa.date::date AS "date",
        (COALESCE(os.sold_count, 0) + COALESCE(ds.sold_count, 0))::int AS "soldCount",
        COALESCE(os.sold_kv, 0) + COALESCE(ds.sold_kv, 0) AS "soldKv",
        COALESCE(os.sold_sum, 0) + COALESCE(ds.sold_sum, 0) AS "soldSum",
        COALESCE(os.profit, 0) + COALESCE(ds.profit, 0) AS "profit",
        COALESCE(os.discount, 0) + COALESCE(ds.discount, 0) AS "discount"
      FROM partiya pa
      LEFT JOIN partiya_number pn ON pa."partiyaNoId" = pn.id
      LEFT JOIN country c ON pa."countryId" = c.id
      LEFT JOIN factory fac ON pa."factoryId" = fac.id
      LEFT JOIN order_sales os ON os."partiyaId" = pa.id
      LEFT JOIN dealer_sales ds ON ds."partiyaId" = pa.id
      WHERE EXTRACT(YEAR FROM pa.date) = $1
        ${searchWhere}
      ORDER BY pa.date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      WITH order_sales AS (
        SELECT p."partiyaId",
          SUM(o.x)::int AS sold_count,
          SUM(o.kv) AS sold_kv,
          SUM(o.price + o."plasticSum") AS sold_sum,
          SUM(o."netProfitSum") AS profit,
          SUM(o."discountSum") AS discount
        FROM "order" o
        JOIN product p ON o."productId" = p.id
        WHERE o.status = 'accepted'
          AND EXTRACT(YEAR FROM o.date) = $1
          AND EXTRACT(MONTH FROM o.date) = $2
        GROUP BY p."partiyaId"
      ),
      dealer_sales AS (
        SELECT p."partiyaId",
          SUM(t.count)::int AS sold_count,
          SUM(t.kv) AS sold_kv,
          SUM(t.kv * pcp."dealerPriceMeter") AS sold_sum,
          SUM(t.kv * (pcp."dealerPriceMeter" - t."comingPrice")) AS profit,
          SUM(t.kv * (p."priceMeter" - pcp."dealerPriceMeter")) AS discount
        FROM transfer t
        JOIN product p ON t."productId" = p.id
        JOIN package_transfer pt ON t."packageId" = pt.id
        JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN "package-collection-price" pcp
          ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
        WHERE t.for_dealer = true
          AND t.progres = 'Accepted'
          AND pt.status = 'accepted'
          AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
          AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
        GROUP BY p."partiyaId"
      )
      SELECT
        COALESCE(SUM(COALESCE(os.sold_count, 0) + COALESCE(ds.sold_count, 0)), 0)::int AS "totalCount",
        COALESCE(SUM(COALESCE(os.sold_kv, 0) + COALESCE(ds.sold_kv, 0)), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(COALESCE(os.sold_sum, 0) + COALESCE(ds.sold_sum, 0)), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(COALESCE(os.profit, 0) + COALESCE(ds.profit, 0)), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(COALESCE(os.discount, 0) + COALESCE(ds.discount, 0)), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(pa.id)::int AS "totalGroups"
      FROM partiya pa
      LEFT JOIN partiya_number pn ON pa."partiyaNoId" = pn.id
      LEFT JOIN order_sales os ON os."partiyaId" = pa.id
      LEFT JOIN dealer_sales ds ON ds."partiyaId" = pa.id
      WHERE EXTRACT(YEAR FROM pa.date) = $1
        ${searchWhere}
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return {
      items: items.map((r: any) => ({
        partiyaId: r.partiyaId,
        partiyaNo: r.partiyaNo,
        country: r.country,
        factory: r.factory,
        date: r.date,
        soldCount: +r.soldCount || 0,
        soldKv: +(+r.soldKv).toFixed(2) || 0,
        soldSum: +(+r.soldSum).toFixed(2) || 0,
        profit: +(+r.profit).toFixed(2) || 0,
        discount: +(+r.discount).toFixed(2) || 0,
      })),
      meta: {
        totals: {
          totalCount: +totals.totalCount,
          totalKv: +totals.totalKv,
          totalSum: +totals.totalSum,
          totalProfit: +totals.totalProfit,
          totalDiscount: +totals.totalDiscount,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((+totals.totalGroups || 0) / limit),
        },
      },
    };
  }

  private async partiyaSalesDrillDown(
    year: number, month: number,
    partiyaId: string, groupBy: string,
    countryId?: string, factoryId?: string,
    collectionId?: string, modelId?: string,
    search?: string,
    page = 1, limit = 50,
  ) {
    const { groupCol, groupTitle, groupJoin } = this.resolveGrouping(groupBy);

    const params: any[] = [year, month, partiyaId];
    let idx = 4;

    let drillWhere = '';
    if (countryId) { drillWhere += ` AND q."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { drillWhere += ` AND q."factoryId" = $${idx++}`; params.push(factoryId); }
    if (collectionId) { drillWhere += ` AND q."collectionId" = $${idx++}`; params.push(collectionId); }
    if (modelId) { drillWhere += ` AND q."modelId" = $${idx++}`; params.push(modelId); }
    if (search) { drillWhere += ` AND ${groupTitle} ILIKE $${idx++}`; params.push(`%${search}%`); }

    const dataQuery = `
      WITH combined AS (
        SELECT
          ${groupCol} AS gid,
          ${groupTitle} AS gtitle,
          o.x AS cnt,
          o.kv AS kv,
          (o.price + o."plasticSum") AS sm,
          o."netProfitSum" AS profit,
          o."discountSum" AS discount
        FROM "order" o
        JOIN product p ON o."productId" = p.id
        JOIN qrbase q ON p."barCodeId" = q.id
        JOIN size s ON q."sizeId" = s.id
        ${groupJoin}
        WHERE o.status = 'accepted'
          AND EXTRACT(YEAR FROM o.date) = $1
          AND EXTRACT(MONTH FROM o.date) = $2
          AND p."partiyaId" = $3
          ${drillWhere}

        UNION ALL

        SELECT
          ${groupCol} AS gid,
          ${groupTitle} AS gtitle,
          t.count AS cnt,
          t.kv AS kv,
          t.kv * pcp."dealerPriceMeter" AS sm,
          t.kv * (pcp."dealerPriceMeter" - t."comingPrice") AS profit,
          t.kv * (p."priceMeter" - pcp."dealerPriceMeter") AS discount
        FROM transfer t
        JOIN package_transfer pt ON t."packageId" = pt.id
        JOIN product p ON t."productId" = p.id
        JOIN qrbase q ON p."barCodeId" = q.id
        JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "package-collection-price" pcp
          ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
        ${groupJoin}
        WHERE t.for_dealer = true
          AND t.progres = 'Accepted'
          AND pt.status = 'accepted'
          AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
          AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
          AND p."partiyaId" = $3
          ${drillWhere}
      )
      SELECT
        gid AS "id",
        gtitle AS "title",
        COALESCE(SUM(cnt), 0)::int AS "count",
        COALESCE(SUM(kv), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(sm), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(profit), 0)::numeric(20,2) AS "profit",
        COALESCE(SUM(discount), 0)::numeric(20,2) AS "discount"
      FROM combined
      GROUP BY gid, gtitle
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsParams = params.slice(0, params.length - 2);
    const totalsQuery = `
      WITH combined AS (
        SELECT
          ${groupCol} AS gid,
          o.x AS cnt,
          o.kv AS kv,
          (o.price + o."plasticSum") AS sm,
          o."netProfitSum" AS profit,
          o."discountSum" AS discount
        FROM "order" o
        JOIN product p ON o."productId" = p.id
        JOIN qrbase q ON p."barCodeId" = q.id
        JOIN size s ON q."sizeId" = s.id
        ${groupJoin}
        WHERE o.status = 'accepted'
          AND EXTRACT(YEAR FROM o.date) = $1
          AND EXTRACT(MONTH FROM o.date) = $2
          AND p."partiyaId" = $3
          ${drillWhere}

        UNION ALL

        SELECT
          ${groupCol} AS gid,
          t.count AS cnt,
          t.kv AS kv,
          t.kv * pcp."dealerPriceMeter" AS sm,
          t.kv * (pcp."dealerPriceMeter" - t."comingPrice") AS profit,
          t.kv * (p."priceMeter" - pcp."dealerPriceMeter") AS discount
        FROM transfer t
        JOIN package_transfer pt ON t."packageId" = pt.id
        JOIN product p ON t."productId" = p.id
        JOIN qrbase q ON p."barCodeId" = q.id
        JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "package-collection-price" pcp
          ON pcp."packageId" = pt.id AND pcp."collectionId" = q."collectionId"
        ${groupJoin}
        WHERE t.for_dealer = true
          AND t.progres = 'Accepted'
          AND pt.status = 'accepted'
          AND EXTRACT(YEAR FROM pt."acceptedAt") = $1
          AND EXTRACT(MONTH FROM pt."acceptedAt") = $2
          AND p."partiyaId" = $3
          ${drillWhere}
      )
      SELECT
        COALESCE(SUM(cnt), 0)::int AS "totalCount",
        COALESCE(SUM(kv), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(sm), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(profit), 0)::numeric(20,2) AS "totalProfit",
        COALESCE(SUM(discount), 0)::numeric(20,2) AS "totalDiscount",
        COUNT(DISTINCT gid)::int AS "totalGroups"
      FROM combined
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private resolveGrouping(groupBy: string) {
    switch (groupBy) {
      case 'factory':
        return {
          groupCol: 'g.id',
          groupTitle: 'g.title',
          groupJoin: 'LEFT JOIN factory g ON q."factoryId" = g.id',
        };
      case 'collection':
        return {
          groupCol: 'g.id',
          groupTitle: 'g.title',
          groupJoin: 'LEFT JOIN collection g ON q."collectionId" = g.id',
        };
      case 'model':
        return {
          groupCol: 'g.id',
          groupTitle: 'g.title',
          groupJoin: 'LEFT JOIN model g ON q."modelId" = g.id',
        };
      case 'size':
        return {
          groupCol: 's.id',
          groupTitle: `s.x || 'x' || s.y`,
          groupJoin: 'JOIN size s ON q."sizeId" = s.id',
        };
      case 'country':
      default:
        return {
          groupCol: 'g.id',
          groupTitle: 'g.title',
          groupJoin: 'LEFT JOIN country g ON q."countryId" = g.id',
        };
    }
  }

  private formatResponse(items: any[], totals: any, page: number, limit: number) {
    return {
      items: items.map((r: any) => ({
        id: r.id,
        title: r.title,
        count: +r.count,
        kv: +r.kv,
        sum: +r.sum,
        profit: +r.profit,
        discount: +r.discount,
      })),
      meta: {
        totals: {
          totalCount: +totals.totalCount,
          totalKv: +totals.totalKv,
          totalSum: +totals.totalSum,
          totalProfit: +totals.totalProfit,
          totalDiscount: +totals.totalDiscount,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((+totals.totalGroups || 0) / limit),
        },
      },
    };
  }
}
