import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePartiyaCollectionPriceTable1776096000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partiya-collection-price" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "dateOne" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "dateTwo" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "deletedDate" TIMESTAMP,
        "factoryPricePerKv" numeric(20, 2) DEFAULT 0,
        "overheadPerKv" numeric(20, 2) DEFAULT 0,
        "partiyaId" uuid,
        "collectionId" uuid,
        CONSTRAINT "fk_pcp_partiya"
          FOREIGN KEY ("partiyaId") REFERENCES "partiya"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pcp_collection"
          FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partiya_collection"
        ON "partiya-collection-price" ("partiyaId", "collectionId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_partiya_collection";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "partiya-collection-price";`);
  }
}
