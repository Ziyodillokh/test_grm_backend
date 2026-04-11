import { MigrationInterface, QueryRunner } from 'typeorm';

export class SwapDebtGivenOwed1776096003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL evaluates SET expressions in parallel, so this swap works correctly
    await queryRunner.query(`
      UPDATE debts SET given = owed, owed = given;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse is the same operation (swap again)
    await queryRunner.query(`
      UPDATE debts SET given = owed, owed = given;
    `);
  }
}
