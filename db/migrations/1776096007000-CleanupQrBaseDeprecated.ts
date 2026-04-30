import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupQrBaseDeprecated1776096007000 implements MigrationInterface {
  name = 'CleanupQrBaseDeprecated1776096007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Backfill: ilgari faqat boolean kolonkalar orqali boshqarilgan yozuvlar uchun status'ni
    //    PUBLISHED ga ko'chirish (defensive — agar status NOT_READY bo'lib qolgan bo'lsa).
    await queryRunner.query(`
      UPDATE qrbase
      SET status = 'PUBLISHED'
      WHERE "is_active" = true
        AND "is_accepted" = true
        AND status = 'NOT_READY'
    `);

    // 2) qrbase deprecated boolean kolonkalarini drop
    await queryRunner.query(`ALTER TABLE qrbase DROP COLUMN IF EXISTS "is_active"`);
    await queryRunner.query(`ALTER TABLE qrbase DROP COLUMN IF EXISTS "is_accepted"`);

    // 3) collection deprecated narx kolonkalari (CollectionPrice entity bilan almashtirilgan)
    await queryRunner.query(`ALTER TABLE collection DROP COLUMN IF EXISTS "secondPrice"`);
    await queryRunner.query(`ALTER TABLE collection DROP COLUMN IF EXISTS "priceMeter"`);
    await queryRunner.query(`ALTER TABLE collection DROP COLUMN IF EXISTS "comingPrice"`);

    // 4) shape dead kolonka (ishlatilmaydi)
    await queryRunner.query(`ALTER TABLE shape DROP COLUMN IF EXISTS "meter"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add columns (best-effort, with backfill from status)
    await queryRunner.query(
      `ALTER TABLE qrbase ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE qrbase ADD COLUMN IF NOT EXISTS "is_accepted" boolean DEFAULT false`,
    );
    await queryRunner.query(`
      UPDATE qrbase
      SET "is_active" = (status <> 'NOT_READY'),
          "is_accepted" = (status = 'PUBLISHED')
    `);

    await queryRunner.query(
      `ALTER TABLE collection ADD COLUMN IF NOT EXISTS "secondPrice" numeric(20,2) DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE collection ADD COLUMN IF NOT EXISTS "priceMeter" numeric(20,2) DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE collection ADD COLUMN IF NOT EXISTS "comingPrice" numeric(20,2) DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE shape ADD COLUMN IF NOT EXISTS "meter" varchar`,
    );
  }
}
