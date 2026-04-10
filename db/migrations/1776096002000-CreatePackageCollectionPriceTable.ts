import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePackageCollectionPriceTable1776096002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) New table: package-collection-price (dealer discount prices per package/collection)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "package-collection-price" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "dateOne" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "dateTwo" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "deletedDate" TIMESTAMP,
        "dealerPriceMeter" numeric(20, 2) DEFAULT 0,
        "packageId" uuid,
        "collectionId" uuid,
        CONSTRAINT "fk_pkgcp_package"
          FOREIGN KEY ("packageId") REFERENCES "package_transfer"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pkgcp_collection"
          FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_package_collection"
        ON "package-collection-price" ("packageId", "collectionId");
    `);

    // 2) package_transfer: new totals + acceptedAt columns
    await queryRunner.query(`
      ALTER TABLE "package_transfer"
        ADD COLUMN IF NOT EXISTS "total_profit" numeric(20, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_discount" numeric(20, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "package_transfer"
        DROP COLUMN IF EXISTS "total_profit",
        DROP COLUMN IF EXISTS "total_discount",
        DROP COLUMN IF EXISTS "acceptedAt";
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_package_collection";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "package-collection-price";`);
  }
}
