import { MigrationInterface, QueryRunner } from 'typeorm';

export class RuToEnEnumValues1776096018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // cashflow.type
    await queryRunner.query(`UPDATE cashflow SET type = 'income'  WHERE type = 'Приход'`);
    await queryRunner.query(`UPDATE cashflow SET type = 'expense' WHERE type = 'Расход'`);
    await queryRunner.query(`ALTER TABLE cashflow ALTER COLUMN type SET DEFAULT 'income'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE cashflow SET type = 'Приход' WHERE type = 'income'`);
    await queryRunner.query(`UPDATE cashflow SET type = 'Расход' WHERE type = 'expense'`);
    await queryRunner.query(`ALTER TABLE cashflow ALTER COLUMN type SET DEFAULT 'Приход'`);
  }
}
