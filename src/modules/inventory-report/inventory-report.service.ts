import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { FilialSnapshotQueryDto } from './dto/filial-snapshot-query.dto';
import { PartiyaSnapshotQueryDto } from './dto/partiya-snapshot-query.dto';

@Injectable()
export class InventoryReportService {
  constructor(private readonly dataSource: DataSource) {}

  // ===================================================================
  // 1) Filial snapshot — current or historical
  // ===================================================================

  async getFilialSnapshot(dto: FilialSnapshotQueryDto) {
    const {
      filialId,
      date,
      groupBy = 'country',
      countryId,
      factoryId,
      collectionId,
      modelId,
      partiyaId,
      search,
      page = 1,
      limit = 50,
    } = dto;

    const isToday = !date || this.isToday(date);

    if (isToday) {
      return this.filialSnapshotCurrent(
        filialId, groupBy, countryId, factoryId, collectionId, modelId,
        search, page, limit, partiyaId,
      );
    }

    return this.filialSnapshotHistorical(
      filialId, date, groupBy, countryId, factoryId, collectionId, modelId,
      search, page, limit,
    );
  }

  /**
   * Live snapshot from current Product table.
   * Groups products by the requested dimension (country, factory, collection, model, size).
   *
   * Formulae:
   *   count = SUM(p.count)
   *   kv    = SUM( CASE WHEN q."isMetric" THEN p.y * s.x
   *                      ELSE p.count * s.x * s.y END )
   *   sum   = SUM(kv_per_row * p."priceMeter")
   *   profit= SUM(kv_per_row * (p."priceMeter" - p."comingPrice"))
   */
  private async filialSnapshotCurrent(
    filialId: string | undefined,
    groupBy: string,
    countryId?: string,
    factoryId?: string,
    collectionId?: string,
    modelId?: string,
    search?: string,
    page = 1,
    limit = 50,
    partiyaId?: string,
  ) {
    const { groupCol, groupTitle, groupJoin } = this.resolveGrouping(groupBy);

    let where = `WHERE p.is_deleted = false AND p."deletedDate" IS NULL AND p.count > 0 AND (q."isMetric" = false OR p.y > 0) AND f.type IN ('filial', 'warehouse', 'market')`;
    const params: any[] = [];
    let idx = 1;

    if (filialId) {
      where += ` AND p."filialId" = $${idx++}`;
      params.push(filialId);
    }
    if (countryId) {
      where += ` AND q."countryId" = $${idx++}`;
      params.push(countryId);
    }
    if (factoryId) {
      where += ` AND q."factoryId" = $${idx++}`;
      params.push(factoryId);
    }
    if (collectionId) {
      where += ` AND q."collectionId" = $${idx++}`;
      params.push(collectionId);
    }
    if (modelId) {
      where += ` AND q."modelId" = $${idx++}`;
      params.push(modelId);
    }
    if (partiyaId) {
      where += ` AND p."partiyaId" = $${idx++}`;
      params.push(partiyaId);
    }
    if (search) {
      where += ` AND ${groupTitle} ILIKE $${idx++}`;
      params.push(`%${search}%`);
    }

    // Main query
    const dataQuery = `
      SELECT
        ${groupCol} AS "id",
        ${groupTitle} AS "title",
        COALESCE(SUM(p.count), 0)::int AS "count",
        COALESCE(SUM(
          CASE WHEN q."isMetric" THEN p.y * s.x
               ELSE p.count * s.x * s.y END
        ), 0)::numeric(20,2) AS "kv",
        COALESCE(SUM(
          (CASE WHEN q."isMetric" THEN p.y * s.x
                ELSE p.count * s.x * s.y END)
          * p."priceMeter"
        ), 0)::numeric(20,2) AS "sum",
        COALESCE(SUM(
          (CASE WHEN q."isMetric" THEN p.y * s.x
                ELSE p.count * s.x * s.y END)
          * (p."priceMeter" - p."comingPrice")
        ), 0)::numeric(20,2) AS "profit"
      FROM product p
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN size s   ON q."sizeId" = s.id
      JOIN filial f ON p."filialId" = f.id
      ${groupJoin}
      ${where}
      GROUP BY ${groupCol}, ${groupTitle}
      ORDER BY "kv" DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    // Totals query (same WHERE, no grouping)
    const totalsParams = params.slice(0, params.length - 2); // without LIMIT/OFFSET
    const totalsQuery = `
      SELECT
        COALESCE(SUM(p.count), 0)::int AS "totalCount",
        COALESCE(SUM(
          CASE WHEN q."isMetric" THEN p.y * s.x
               ELSE p.count * s.x * s.y END
        ), 0)::numeric(20,2) AS "totalKv",
        COALESCE(SUM(
          (CASE WHEN q."isMetric" THEN p.y * s.x
                ELSE p.count * s.x * s.y END)
          * p."priceMeter"
        ), 0)::numeric(20,2) AS "totalSum",
        COALESCE(SUM(
          (CASE WHEN q."isMetric" THEN p.y * s.x
                ELSE p.count * s.x * s.y END)
          * (p."priceMeter" - p."comingPrice")
        ), 0)::numeric(20,2) AS "totalProfit",
        COUNT(DISTINCT ${groupCol})::int AS "totalGroups"
      FROM product p
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN size s   ON q."sizeId" = s.id
      JOIN filial f ON p."filialId" = f.id
      ${groupJoin}
      ${where}
    `;

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(dataQuery, params),
      this.dataSource.query(totalsQuery, totalsParams),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        title: r.title,
        count: +r.count,
        kv: +r.kv,
        sum: +r.sum,
        profit: +r.profit,
      })),
      meta: {
        totals: {
          totalCount: +totals.totalCount,
          totalKv: +totals.totalKv,
          totalSum: +totals.totalSum,
          totalProfit: +totals.totalProfit,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((+totals.totalGroups || 0) / limit),
        },
      },
    };
  }

  /**
   * Historical snapshot — forward reconstruction from closest pereuchot
   * baseline. Falls back to backward reconstruction from today if no
   * baseline exists before the requested date.
   *
   * Algorithm:
   *  1. Find the latest ACCEPTED FilialReport for this filial whose date <= `date`
   *  2. Start with the ReInventory snapshot (product → count/y/comingPrice)
   *  3. Apply forward events in (baseline.date, target date]:
   *     - Accepted orders (subtract kv/count from product)
   *     - Transfer creates FROM this filial (subtract)
   *     - Transfer accepts TO this filial (add)
   *     - Transfer rejects TO this filial (add — returns)
   *  4. If no baseline: take current Product state, apply events in
   *     (target date, now] in REVERSE (un-sell, un-transfer).
   */
  private async filialSnapshotHistorical(
    filialId: string | undefined,
    date: string,
    groupBy: string,
    countryId?: string,
    factoryId?: string,
    collectionId?: string,
    modelId?: string,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    if (!filialId) {
      // Historical reconstruction requires a specific filial
      return this.filialSnapshotCurrent(
        filialId, groupBy, countryId, factoryId, collectionId, modelId,
        search, page, limit,
      );
    }

    // Try to find a pereuchot baseline
    const baselineRows = await this.dataSource.query(`
      SELECT fr.id, fr.date
      FROM filial_report fr
      WHERE fr."filialId" = $1
        AND fr.status = 'Accepted'
        AND fr.date::date <= $2::date
      ORDER BY fr.date DESC
      LIMIT 1
    `, [filialId, date]);

    if (baselineRows.length) {
      return this.forwardReconstruction(
        filialId, baselineRows[0].id, baselineRows[0].date, date,
        groupBy, countryId, factoryId, collectionId, modelId, search,
        page, limit,
      );
    }

    // No baseline — backward from current state
    return this.backwardReconstruction(
      filialId, date, groupBy, countryId, factoryId, collectionId, modelId,
      search, page, limit,
    );
  }

  /**
   * Forward reconstruction: start from ReInventory baseline, apply events
   * up to target date.
   *
   * Uses a single SQL CTE that:
   *  1) Loads ReInventory rows as the starting point
   *  2) Subtracts accepted orders in (baselineDate, targetDate]
   *  3) Subtracts transfers created FROM this filial in the window
   *  4) Adds transfers accepted TO this filial in the window
   *  5) Adds transfers rejected (returned to source = this filial) in the window
   *  6) Groups by the requested dimension
   */
  private async forwardReconstruction(
    filialId: string,
    reportId: string,
    baselineDate: Date,
    targetDate: string,
    groupBy: string,
    countryId?: string,
    factoryId?: string,
    collectionId?: string,
    modelId?: string,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    const { groupCol: rawGroupCol, groupTitle: rawGroupTitle, groupJoin } = this.resolveGrouping(groupBy);

    // In reconstruction queries, the product table alias is 'ri_product' inside CTE
    // but grouping references qrbase. We remap.
    const groupCol = rawGroupCol.replace(/\bg\./g, 'g.');
    const groupTitle = rawGroupTitle.replace(/\bg\./g, 'g.');

    let drillWhere = '';
    const params: any[] = [filialId, reportId, baselineDate, targetDate];
    let idx = 5;

    if (countryId) { drillWhere += ` AND q."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { drillWhere += ` AND q."factoryId" = $${idx++}`; params.push(factoryId); }
    if (collectionId) { drillWhere += ` AND q."collectionId" = $${idx++}`; params.push(collectionId); }
    if (modelId) { drillWhere += ` AND q."modelId" = $${idx++}`; params.push(modelId); }
    if (search) { drillWhere += ` AND ${groupTitle} ILIKE $${idx++}`; params.push(`%${search}%`); }

    const cte = `
    WITH baseline AS (
      -- Starting point: ReInventory snapshot
      SELECT
        ri."barCodeId",
        ri.count AS cnt,
        ri.y,
        ri."comingPrice",
        COALESCE(
          (SELECT cp2."priceMeter"
           FROM collection_price cp2
           WHERE cp2."collectionId" = q."collectionId"
             AND cp2.type = 'filial'
           ORDER BY cp2.date DESC LIMIT 1), 0
        ) AS "priceMeter"
      FROM re_inventory ri
      JOIN qrbase q ON ri."barCodeId" = q.id
      WHERE ri."filialReportId" = $2
    ),
    sold AS (
      -- Orders accepted between baseline and target
      SELECT o."productId", SUM(o.kv) AS sold_kv, SUM(o.x)::int AS sold_x
      FROM "order" o
      JOIN product p ON o."productId" = p.id
      WHERE p."filialId" = $1
        AND o.status = 'accepted'
        AND o.date::date > $3::date
        AND o.date::date <= $4::date
      GROUP BY o."productId"
    ),
    transferred_out AS (
      -- Transfers created FROM this filial in window
      SELECT t."productId", SUM(t.kv) AS out_kv, SUM(t.count)::int AS out_cnt
      FROM transfer t
      WHERE t."fromId" = $1
        AND t.progres IN ('Accepted', 'Processing')
        AND t."dateOne"::date > $3::date
        AND t."dateOne"::date <= $4::date
      GROUP BY t."productId"
    ),
    transferred_in AS (
      -- Transfers accepted TO this filial in window
      SELECT t."productId", SUM(t.kv) AS in_kv, SUM(t.count)::int AS in_cnt
      FROM transfer t
      WHERE t."toId" = $1
        AND t.progres = 'Accepted'
        AND t."dateTwo"::date > $3::date
        AND t."dateTwo"::date <= $4::date
      GROUP BY t."productId"
    ),
    snapshot AS (
      SELECT
        b."barCodeId",
        GREATEST(b.cnt
          - COALESCE(s.sold_x, 0)
          - COALESCE(tout.out_cnt, 0)
          + COALESCE(tin.in_cnt, 0), 0) AS cnt,
        GREATEST(b.y
          - COALESCE(s.sold_kv, 0) / NULLIF(sz.x, 0)
          - COALESCE(tout.out_kv, 0) / NULLIF(sz.x, 0)
          + COALESCE(tin.in_kv, 0) / NULLIF(sz.x, 0), 0) AS y,
        b."comingPrice",
        b."priceMeter"
      FROM baseline b
      JOIN qrbase q ON b."barCodeId" = q.id
      JOIN size sz  ON q."sizeId" = sz.id
      LEFT JOIN sold s ON b."barCodeId" = s."productId"
      LEFT JOIN transferred_out tout ON b."barCodeId" = tout."productId"
      LEFT JOIN transferred_in tin   ON b."barCodeId" = tin."productId"
    )
    `;

    const mainSql = `
    ${cte}
    SELECT
      ${groupCol} AS "id",
      ${groupTitle} AS "title",
      COALESCE(SUM(snap.cnt), 0)::int AS "count",
      COALESCE(SUM(
        CASE WHEN q."isMetric" THEN snap.y * sz.x
             ELSE snap.cnt * sz.x * sz.y END
      ), 0)::numeric(20,2) AS "kv",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * snap."priceMeter"
      ), 0)::numeric(20,2) AS "sum",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * (snap."priceMeter" - snap."comingPrice")
      ), 0)::numeric(20,2) AS "profit"
    FROM snapshot snap
    JOIN qrbase q ON snap."barCodeId" = q.id
    JOIN size sz  ON q."sizeId" = sz.id
    ${groupJoin}
    WHERE 1=1 ${drillWhere}
    GROUP BY ${groupCol}, ${groupTitle}
    ORDER BY "kv" DESC
    LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsSql = `
    ${cte}
    SELECT
      COALESCE(SUM(snap.cnt), 0)::int AS "totalCount",
      COALESCE(SUM(
        CASE WHEN q."isMetric" THEN snap.y * sz.x
             ELSE snap.cnt * sz.x * sz.y END
      ), 0)::numeric(20,2) AS "totalKv",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * snap."priceMeter"
      ), 0)::numeric(20,2) AS "totalSum",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * (snap."priceMeter" - snap."comingPrice")
      ), 0)::numeric(20,2) AS "totalProfit",
      COUNT(DISTINCT ${groupCol})::int AS "totalGroups"
    FROM snapshot snap
    JOIN qrbase q ON snap."barCodeId" = q.id
    JOIN size sz  ON q."sizeId" = sz.id
    ${groupJoin}
    WHERE 1=1 ${drillWhere}
    `;
    const totalsParams = params.slice(0, params.length - 2);

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(mainSql, params),
      this.dataSource.query(totalsSql, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  /**
   * Backward reconstruction: start from current Product state, reverse
   * events that happened AFTER the target date to reconstruct what the
   * stock looked like on that date.
   *
   * Events in (targetDate, now]:
   *   - Accepted orders   → ADD back kv/count (undo the sale)
   *   - Transfer FROM here → ADD back (undo the outgoing)
   *   - Transfer TO here   → SUBTRACT (undo the incoming)
   */
  private async backwardReconstruction(
    filialId: string,
    targetDate: string,
    groupBy: string,
    countryId?: string,
    factoryId?: string,
    collectionId?: string,
    modelId?: string,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    const { groupCol, groupTitle, groupJoin } = this.resolveGrouping(groupBy);

    let drillWhere = '';
    const params: any[] = [filialId, targetDate];
    let idx = 3;

    if (countryId) { drillWhere += ` AND q."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { drillWhere += ` AND q."factoryId" = $${idx++}`; params.push(factoryId); }
    if (collectionId) { drillWhere += ` AND q."collectionId" = $${idx++}`; params.push(collectionId); }
    if (modelId) { drillWhere += ` AND q."modelId" = $${idx++}`; params.push(modelId); }
    if (search) { drillWhere += ` AND ${groupTitle} ILIKE $${idx++}`; params.push(`%${search}%`); }

    const cte = `
    WITH current_stock AS (
      SELECT p.id, p."barCodeId", p.count AS cnt, p.y,
             p."comingPrice", p."priceMeter"
      FROM product p
      JOIN filial f ON p."filialId" = f.id
      WHERE p."filialId" = $1
        AND p.is_deleted = false
        AND p."deletedDate" IS NULL
        AND f.type IN ('filial', 'warehouse', 'market')
    ),
    sold_after AS (
      SELECT o."productId", SUM(o.kv) AS sold_kv, SUM(o.x)::int AS sold_x
      FROM "order" o
      JOIN product p ON o."productId" = p.id
      WHERE p."filialId" = $1
        AND o.status = 'accepted'
        AND o.date::date > $2::date
      GROUP BY o."productId"
    ),
    out_after AS (
      SELECT t."productId", SUM(t.kv) AS out_kv, SUM(t.count)::int AS out_cnt
      FROM transfer t
      WHERE t."fromId" = $1
        AND t.progres IN ('Accepted', 'Processing')
        AND t."dateOne"::date > $2::date
      GROUP BY t."productId"
    ),
    in_after AS (
      SELECT t."productId", SUM(t.kv) AS in_kv, SUM(t.count)::int AS in_cnt
      FROM transfer t
      WHERE t."toId" = $1
        AND t.progres = 'Accepted'
        AND t."dateTwo"::date > $2::date
      GROUP BY t."productId"
    ),
    snapshot AS (
      SELECT
        cs."barCodeId",
        GREATEST(
          cs.cnt
          + COALESCE(sa.sold_x, 0)
          + COALESCE(oa.out_cnt, 0)
          - COALESCE(ia.in_cnt, 0), 0) AS cnt,
        GREATEST(
          cs.y
          + COALESCE(sa.sold_kv, 0) / NULLIF(sz.x, 0)
          + COALESCE(oa.out_kv, 0) / NULLIF(sz.x, 0)
          - COALESCE(ia.in_kv, 0) / NULLIF(sz.x, 0), 0) AS y,
        cs."comingPrice",
        cs."priceMeter"
      FROM current_stock cs
      JOIN qrbase q ON cs."barCodeId" = q.id
      JOIN size sz  ON q."sizeId" = sz.id
      LEFT JOIN sold_after sa  ON cs.id = sa."productId"
      LEFT JOIN out_after oa   ON cs.id = oa."productId"
      LEFT JOIN in_after ia    ON cs.id = ia."productId"
    )
    `;

    const mainSql = `
    ${cte}
    SELECT
      ${groupCol} AS "id",
      ${groupTitle} AS "title",
      COALESCE(SUM(snap.cnt), 0)::int AS "count",
      COALESCE(SUM(
        CASE WHEN q."isMetric" THEN snap.y * sz.x
             ELSE snap.cnt * sz.x * sz.y END
      ), 0)::numeric(20,2) AS "kv",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * snap."priceMeter"
      ), 0)::numeric(20,2) AS "sum",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * (snap."priceMeter" - snap."comingPrice")
      ), 0)::numeric(20,2) AS "profit"
    FROM snapshot snap
    JOIN qrbase q ON snap."barCodeId" = q.id
    JOIN size sz  ON q."sizeId" = sz.id
    ${groupJoin}
    WHERE 1=1 ${drillWhere}
    GROUP BY ${groupCol}, ${groupTitle}
    ORDER BY "kv" DESC
    LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, (page - 1) * limit);

    const totalsSql = `
    ${cte}
    SELECT
      COALESCE(SUM(snap.cnt), 0)::int AS "totalCount",
      COALESCE(SUM(
        CASE WHEN q."isMetric" THEN snap.y * sz.x
             ELSE snap.cnt * sz.x * sz.y END
      ), 0)::numeric(20,2) AS "totalKv",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * snap."priceMeter"
      ), 0)::numeric(20,2) AS "totalSum",
      COALESCE(SUM(
        (CASE WHEN q."isMetric" THEN snap.y * sz.x
              ELSE snap.cnt * sz.x * sz.y END)
        * (snap."priceMeter" - snap."comingPrice")
      ), 0)::numeric(20,2) AS "totalProfit",
      COUNT(DISTINCT ${groupCol})::int AS "totalGroups"
    FROM snapshot snap
    JOIN qrbase q ON snap."barCodeId" = q.id
    JOIN size sz  ON q."sizeId" = sz.id
    ${groupJoin}
    WHERE 1=1 ${drillWhere}
    `;
    const totalsParams = params.slice(0, params.length - 2);

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(mainSql, params),
      this.dataSource.query(totalsSql, totalsParams),
    ]);

    return this.formatResponse(items, totals, page, limit);
  }

  // ===================================================================
  // 2) Partiya snapshot — M_MANAGER / BOSS only
  // ===================================================================

  async getPartiyaSnapshot(dto: PartiyaSnapshotQueryDto) {
    const {
      year = new Date().getFullYear(),
      date,
      countryId,
      factoryId,
      filialId,
      search,
      page = 1,
      limit = 50,
    } = dto;

    let where = `WHERE EXTRACT(YEAR FROM pa.date) = $1`;
    const params: any[] = [year];
    let idx = 2;

    // Partiya must be at least CLOSED
    where += ` AND pa.partiya_status IN ('closed', 'finished')`;

    if (countryId) { where += ` AND pa."countryId" = $${idx++}`; params.push(countryId); }
    if (factoryId) { where += ` AND pa."factoryId" = $${idx++}`; params.push(factoryId); }
    if (search) { where += ` AND pn.title ILIKE $${idx++}`; params.push(`%${search}%`); }

    // filialId — filter products by filial (only stock in that filial)
    let filialFilter = '';
    if (filialId) {
      filialFilter = ` AND p."filialId" = $${idx++}`;
      params.push(filialId);
    }

    // The target date for "remaining" calculation (default today)
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const sql = `
    WITH partiya_products AS (
      SELECT
        p."partiyaId",
        p.id AS product_id,
        p.count,
        p.y,
        p."comingPrice",
        p."priceMeter",
        p.is_deleted,
        q."isMetric",
        s.x AS size_x,
        s.y AS size_y
      FROM product p
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN size s   ON q."sizeId" = s.id
      JOIN filial f ON p."filialId" = f.id
      WHERE p."deletedDate" IS NULL
        AND f.type IN ('filial', 'warehouse', 'market')
        ${filialFilter}
    ),
    sold AS (
      -- Accepted orders for products in these partiyas
      SELECT
        pp."partiyaId",
        SUM(o.x)::int AS sold_count,
        SUM(o.kv) AS sold_kv,
        SUM(o.kv * pp."priceMeter") AS sold_sum,
        SUM(o.kv * (pp."priceMeter" - pp."comingPrice")) AS sold_profit
      FROM "order" o
      JOIN partiya_products pp ON o."productId" = pp.product_id
      WHERE o.status = 'accepted'
        AND o.date::date <= $${idx}::date
      GROUP BY pp."partiyaId"
    ),
    -- Package (dealer) sales
    pkg_sold AS (
      SELECT
        pp."partiyaId",
        SUM(t.kv) AS pkg_kv,
        SUM(t.count)::int AS pkg_count
      FROM transfer t
      JOIN partiya_products pp ON t."productId" = pp.product_id
      JOIN package_transfer pt ON t."packageId" = pt.id
      WHERE t.progres = 'Accepted'
        AND t.for_dealer = true
        AND pt."acceptedAt"::date <= $${idx}::date
      GROUP BY pp."partiyaId"
    ),
    remaining AS (
      SELECT
        pp."partiyaId",
        SUM(pp.count)::int AS rem_count,
        SUM(
          CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
               ELSE pp.count * pp.size_x * pp.size_y END
        ) AS rem_kv,
        SUM(
          (CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
                ELSE pp.count * pp.size_x * pp.size_y END)
          * pp."priceMeter"
        ) AS rem_sum,
        SUM(
          (CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
                ELSE pp.count * pp.size_x * pp.size_y END)
          * (pp."priceMeter" - pp."comingPrice")
        ) AS rem_profit
      FROM partiya_products pp
      WHERE pp.is_deleted = false AND pp.count > 0 AND (pp."isMetric" = false OR pp.y > 0)
      GROUP BY pp."partiyaId"
    )
    SELECT
      pa.id AS "partiyaId",
      pn.title AS "partiyaNo",
      co.title AS "country",
      fa.title AS "factory",
      pa.date::date AS "date",
      COALESCE(r.rem_count, 0) + COALESCE(sd.sold_count, 0) + COALESCE(ps.pkg_count, 0) AS "initialCount",
      COALESCE(r.rem_kv, 0) + COALESCE(sd.sold_kv, 0) + COALESCE(ps.pkg_kv, 0) AS "initialKv",
      COALESCE(sd.sold_count, 0) + COALESCE(ps.pkg_count, 0) AS "soldCount",
      COALESCE(sd.sold_kv, 0) + COALESCE(ps.pkg_kv, 0) AS "soldKv",
      COALESCE(sd.sold_sum, 0) AS "soldSum",
      COALESCE(r.rem_count, 0)::int AS "remainingCount",
      COALESCE(r.rem_kv, 0)::numeric(20,2) AS "remainingKv",
      COALESCE(r.rem_sum, 0)::numeric(20,2) AS "remainingSum",
      COALESCE(r.rem_profit, 0)::numeric(20,2) AS "profit"
    FROM partiya pa
    LEFT JOIN partiya_number pn ON pa."partiyaNoId" = pn.id
    LEFT JOIN country co        ON pa."countryId" = co.id
    LEFT JOIN factory fa        ON pa."factoryId" = fa.id
    LEFT JOIN remaining r       ON pa.id = r."partiyaId"
    LEFT JOIN sold sd           ON pa.id = sd."partiyaId"
    LEFT JOIN pkg_sold ps       ON pa.id = ps."partiyaId"
    ${where}
    ORDER BY pa.date DESC
    LIMIT $${idx + 1} OFFSET $${idx + 2}
    `;
    params.push(targetDate, limit, (page - 1) * limit);

    // Totals
    const totalsIdx = idx; // targetDate param index
    const totalsSql = `
    WITH partiya_products AS (
      SELECT p."partiyaId", p.count, p.y, p."comingPrice", p."priceMeter",
             p.is_deleted, q."isMetric", s.x AS size_x, s.y AS size_y
      FROM product p
      JOIN qrbase q ON p."barCodeId" = q.id
      JOIN size s   ON q."sizeId" = s.id
      JOIN filial f ON p."filialId" = f.id
      WHERE p."deletedDate" IS NULL
        AND f.type IN ('filial', 'warehouse', 'market')
        ${filialFilter}
    ),
    remaining AS (
      SELECT pp."partiyaId",
        SUM(pp.count)::int AS rem_count,
        SUM(CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
                 ELSE pp.count * pp.size_x * pp.size_y END) AS rem_kv,
        SUM((CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
                  ELSE pp.count * pp.size_x * pp.size_y END) * pp."priceMeter") AS rem_sum,
        SUM((CASE WHEN pp."isMetric" THEN pp.y * pp.size_x
                  ELSE pp.count * pp.size_x * pp.size_y END) * (pp."priceMeter" - pp."comingPrice")) AS rem_profit
      FROM partiya_products pp
      WHERE pp.is_deleted = false AND pp.count > 0 AND (pp."isMetric" = false OR pp.y > 0)
      GROUP BY pp."partiyaId"
    )
    SELECT
      COALESCE(SUM(r.rem_count), 0)::int AS "totalRemainingCount",
      COALESCE(SUM(r.rem_kv), 0)::numeric(20,2) AS "totalRemainingKv",
      COALESCE(SUM(r.rem_sum), 0)::numeric(20,2) AS "totalRemainingSum",
      COALESCE(SUM(r.rem_profit), 0)::numeric(20,2) AS "totalProfit",
      COUNT(pa.id)::int AS "totalPartiyas"
    FROM partiya pa
    LEFT JOIN remaining r ON pa.id = r."partiyaId"
    LEFT JOIN partiya_number pn ON pa."partiyaNoId" = pn.id
    ${where}
    `;
    const totalsParams = params.slice(0, params.length - 3); // remove targetDate, limit, offset

    const [items, [totals]] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(totalsSql, totalsParams),
    ]);

    return {
      items: items.map((r) => ({
        partiyaId: r.partiyaId,
        partiyaNo: r.partiyaNo,
        country: r.country,
        factory: r.factory,
        date: r.date,
        initialCount: +r.initialCount,
        initialKv: +r.initialKv,
        soldCount: +r.soldCount,
        soldKv: +r.soldKv,
        soldSum: +r.soldSum,
        remainingCount: +r.remainingCount,
        remainingKv: +r.remainingKv,
        remainingSum: +r.remainingSum,
        profit: +r.profit,
      })),
      meta: {
        totals: {
          totalRemainingCount: +totals.totalRemainingCount,
          totalRemainingKv: +totals.totalRemainingKv,
          totalRemainingSum: +totals.totalRemainingSum,
          totalProfit: +totals.totalProfit,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((+totals.totalPartiyas || 0) / limit),
        },
      },
    };
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
          groupJoin: '', // size already joined
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

  private isToday(date: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return date === today;
  }

  private formatResponse(items: any[], totals: any, page: number, limit: number) {
    return {
      items: items.map((r) => ({
        id: r.id,
        title: r.title,
        count: +r.count,
        kv: +r.kv,
        sum: +r.sum,
        profit: +r.profit,
      })),
      meta: {
        totals: {
          totalCount: +totals.totalCount,
          totalKv: +totals.totalKv,
          totalSum: +totals.totalSum,
          totalProfit: +totals.totalProfit,
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
