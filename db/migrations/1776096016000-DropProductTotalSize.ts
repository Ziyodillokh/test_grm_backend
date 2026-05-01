import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropProductTotalSize1776096016000 implements MigrationInterface {
  name = 'DropProductTotalSize1776096016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // product.totalSize denormalized snapshot edi: yaratish paytida hisoblanardi,
    // lekin sotuv/transfer paytida yangilanmasdi. Buning natijasida collection
    // qoldiq hisoboti (collection.service.ts:523) sotilgan tovarlarni ham qoldiq
    // sifatida ko'rsatardi. Source of truth = count, y, qrbase.size — totalSize
    // har joyda real-time formula bilan hisoblanadi:
    //   count * size.x * (CASE WHEN qrbase.isMetric THEN p.y ELSE size.y END)
    await queryRunner.query(`ALTER TABLE product DROP COLUMN IF EXISTS "totalSize"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE product ADD COLUMN IF NOT EXISTS "totalSize" numeric(20,2)`,
    );
  }
}
