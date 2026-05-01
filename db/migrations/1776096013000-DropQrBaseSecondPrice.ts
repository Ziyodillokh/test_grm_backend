import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropQrBaseSecondPrice1776096013000 implements MigrationInterface {
  name = 'DropQrBaseSecondPrice1776096013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // qrbase.secondPrice ortiqcha edi: internet narx allaqachon collection-price (type='market')
    // ichida saqlanadi va order/transfer logikasi shu joydan o'qiydi.
    await queryRunner.query(`ALTER TABLE qrbase DROP COLUMN IF EXISTS "secondPrice"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE qrbase ADD COLUMN IF NOT EXISTS "secondPrice" numeric(20,2) NOT NULL DEFAULT 0`,
    );
  }
}
