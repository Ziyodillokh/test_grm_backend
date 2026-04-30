import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrBaseSearchIndexes1776096008000 implements MigrationInterface {
  name = 'AddQrBaseSearchIndexes1776096008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pg_trgm — ILIKE qidiruv uchun trigram indexlar
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // qrbase.status partial index (active yozuvlar uchun)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS qrbase_status_idx
      ON qrbase (status)
      WHERE "deletedDate" IS NULL
    `);

    // qrbase.code trigram (find-by-code partial match uchun)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS qrbase_code_trgm_idx
      ON qrbase USING gin (code gin_trgm_ops)
    `);

    // 8 ta lookup table title trigram indexlar (search 9 ustunda ILIKE)
    const lookupTables = [
      'collection',
      'model',
      'color',
      'size',
      'shape',
      'style',
      'country',
      'factory',
    ];
    for (const t of lookupTables) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${t}_title_trgm_idx ON ${t} USING gin (title gin_trgm_ops)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const lookupTables = [
      'collection',
      'model',
      'color',
      'size',
      'shape',
      'style',
      'country',
      'factory',
    ];
    for (const t of lookupTables) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${t}_title_trgm_idx`);
    }
    await queryRunner.query(`DROP INDEX IF EXISTS qrbase_code_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS qrbase_status_idx`);
    // pg_trgm extension'ni o'chirmaymiz — boshqa indexlar ishlatishi mumkin
  }
}
