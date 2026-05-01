import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenKvPrecision1776096010000 implements MigrationInterface {
  name = 'WidenKvPrecision1776096010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eski schema'da kv numeric(20,3) edi — 50x125, 50x175 kabi razmerlarda
    // 3-razryad ahamiyatli (0.625, 0.875). Yangi schema'da numeric(20,2) qoldirgan
    // edik — bu sotuv narxini hisoblashda kichik precision yo'qotishlarga olib keladi.
    // ETL uchun ham kerak: gilam-market backup'da kv numeric(20,3) bor, mos kelishi kerak.
    await queryRunner.query(`ALTER TABLE size ALTER COLUMN kv TYPE numeric(20,3)`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN kv TYPE numeric(20,3)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Toraytirsa precision yo'qoladi (round). Defensive uchun aniq bermaymiz.
    await queryRunner.query(`ALTER TABLE size ALTER COLUMN kv TYPE numeric(20,2)`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN kv TYPE numeric(20,2)`);
  }
}
