import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFactoryDebtAndCashflowFactory1776096005000 implements MigrationInterface {
  name = 'AddFactoryDebtAndCashflowFactory1776096005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Factory: debt tracking columns
    await queryRunner.query(`
      ALTER TABLE factory ADD COLUMN IF NOT EXISTS "isReportEnabled" BOOLEAN DEFAULT FALSE;
      ALTER TABLE factory ADD COLUMN IF NOT EXISTS "owed" NUMERIC(20,2) DEFAULT 0;
      ALTER TABLE factory ADD COLUMN IF NOT EXISTS "given" NUMERIC(20,2) DEFAULT 0;
      ALTER TABLE factory ADD COLUMN IF NOT EXISTS "totalDebt" NUMERIC(20,2) DEFAULT 0;
    `);

    // Cashflow: factory relation
    await queryRunner.query(`
      ALTER TABLE cashflow ADD COLUMN IF NOT EXISTS "factoryId" UUID;
      ALTER TABLE cashflow ADD CONSTRAINT "FK_cashflow_factory"
        FOREIGN KEY ("factoryId") REFERENCES factory(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cashflow DROP CONSTRAINT IF EXISTS "FK_cashflow_factory"`);
    await queryRunner.query(`ALTER TABLE cashflow DROP COLUMN IF EXISTS "factoryId"`);
    await queryRunner.query(`ALTER TABLE factory DROP COLUMN IF EXISTS "totalDebt"`);
    await queryRunner.query(`ALTER TABLE factory DROP COLUMN IF EXISTS "given"`);
    await queryRunner.query(`ALTER TABLE factory DROP COLUMN IF EXISTS "owed"`);
    await queryRunner.query(`ALTER TABLE factory DROP COLUMN IF EXISTS "isReportEnabled"`);
  }
}
