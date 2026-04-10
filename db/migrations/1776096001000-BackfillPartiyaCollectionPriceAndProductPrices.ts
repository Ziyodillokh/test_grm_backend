import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data migration to backfill data after introducing per-partiya per-collection pricing
 * and enforcing non-null product.priceMeter / product.collection_price.
 *
 * Two passes:
 *
 * 1) Backfill "partiya-collection-price" from existing partiyas.
 *    For every (partiya, collection) pair present in `product` rows (by product.bar_code.collection),
 *    insert a row with:
 *      factoryPricePerKv = partiya.expensePerKv   (legacy aggregated per-partiya cost is copied as factory cost)
 *      overheadPerKv     = 0                       (legacy data did not separate overhead)
 *
 * 2) Backfill product.priceMeter and product.collection_price for products where these
 *    are missing, using the latest collection-price row matching the product's filial type:
 *      filial.type IN (FILIAL, WAREHOUSE)  -> cp.type = 'filial'
 *      filial.type = DEALER                -> cp.type = 'dealer'
 *      filial.type = MARKET                -> cp.type = 'market'
 */
export class BackfillPartiyaCollectionPriceAndProductPrices1776096001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. Backfill "partiya-collection-price" ----
    // Build unique (partiya, collection) pairs from existing products.
    await queryRunner.query(`
      INSERT INTO "partiya-collection-price"
        ("factoryPricePerKv", "overheadPerKv", "partiyaId", "collectionId")
      SELECT DISTINCT
        COALESCE(pt."expensePerKv", 0) AS "factoryPricePerKv",
        0                              AS "overheadPerKv",
        p."partiyaId",
        qb."collectionId"
      FROM "product" p
      INNER JOIN "partiya" pt ON pt."id" = p."partiyaId"
      INNER JOIN "qrbase"  qb ON qb."id" = p."barCodeId"
      WHERE p."partiyaId"    IS NOT NULL
        AND qb."collectionId" IS NOT NULL
      ON CONFLICT ("partiyaId", "collectionId") DO NOTHING;
    `);

    // ---- 2. Backfill product.priceMeter and product.collection_price ----
    // For each product with missing price, pick the latest matching "collection-price" row.
    await queryRunner.query(`
      WITH latest_cp AS (
        SELECT DISTINCT ON (cp."collectionId", cp."type")
          cp."id"           AS cp_id,
          cp."collectionId" AS collection_id,
          cp."type"         AS cp_type,
          cp."priceMeter"   AS price_meter
        FROM "collection-price" cp
        WHERE cp."deletedDate" IS NULL
        ORDER BY cp."collectionId", cp."type", cp."date" DESC
      ),
      target AS (
        SELECT
          p."id" AS product_id,
          qb."collectionId" AS collection_id,
          CASE
            WHEN f."type" IN ('filial', 'warehouse') THEN 'filial'
            WHEN f."type" = 'dealer'                 THEN 'dealer'
            WHEN f."type" = 'market'                 THEN 'market'
            ELSE 'filial'
          END AS cp_type
        FROM "product" p
        INNER JOIN "qrbase"  qb ON qb."id" = p."barCodeId"
        INNER JOIN "filial"  f  ON f."id"  = p."filialId"
        WHERE p."is_deleted" = false
          AND qb."collectionId" IS NOT NULL
          AND (p."collectionPriceId" IS NULL OR p."priceMeter" = 0)
      )
      UPDATE "product" pr
      SET
        "priceMeter"        = lc.price_meter,
        "collectionPriceId" = lc.cp_id
      FROM target t
      INNER JOIN latest_cp lc
        ON lc.collection_id = t.collection_id
       AND lc.cp_type       = t.cp_type
      WHERE pr."id" = t.product_id;
    `);

    // ---- 3. Backfill product.comingPrice from PartiyaCollectionPrice where still zero ----
    // Uses the freshly inserted pcp rows: comingPrice = factoryPricePerKv + overheadPerKv.
    await queryRunner.query(`
      UPDATE "product" pr
      SET "comingPrice" = pcp."factoryPricePerKv" + pcp."overheadPerKv"
      FROM "partiya-collection-price" pcp
      INNER JOIN "qrbase" qb ON qb."collectionId" = pcp."collectionId"
      WHERE pr."barCodeId" = qb."id"
        AND pr."partiyaId" = pcp."partiyaId"
        AND pr."is_deleted" = false
        AND (pr."comingPrice" IS NULL OR pr."comingPrice" = 0);
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data backfill; nothing to roll back safely.
  }
}
