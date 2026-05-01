import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropProductBookCount1776096015000 implements MigrationInterface {
  name = 'DropProductBookCount1776096015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // book_count: entity'dan allaqachon olib tashlangan, kodda hech qaerda
    // ishlatilmaydi. Dead column. Active basket-bookings counter sifatida
    // booking_count ishlatiladi (order-basket.service da).
    await queryRunner.query(`ALTER TABLE product DROP COLUMN IF EXISTS book_count`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE product ADD COLUMN IF NOT EXISTS book_count numeric(20,2) NOT NULL DEFAULT 0`,
    );
  }
}
