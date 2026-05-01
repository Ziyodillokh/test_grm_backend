import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPartiyaExpensePerKv1776096014000 implements MigrationInterface {
  name = 'DropPartiyaExpensePerKv1776096014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // partiya.expensePerKv legacy edi: har partiya uchun BIR aggregate qiymat (= expense/volume).
    // Yangi mantiqda har (partiya, collection) jufti uchun zavod narxi va ustama
    // alohida saqlanadi: "partiya-collection-price"."factoryPricePerKv" + "overheadPerKv".
    // Hisobotlar (excel.service) shu yangi jadvaldan o'qiydi, expensePerKv endi kerak emas.
    await queryRunner.query(`ALTER TABLE partiya DROP COLUMN IF EXISTS "expensePerKv"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE partiya ADD COLUMN IF NOT EXISTS "expensePerKv" numeric(20,2) NOT NULL DEFAULT 0`,
    );
  }
}
