import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReInventoryAuditColumns1776096006000 implements MigrationInterface {
  name = 'AddReInventoryAuditColumns1776096006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Re-inventory: audit columns (who scanned, when)
    await queryRunner.query(`
      ALTER TABLE re_inventory ADD COLUMN IF NOT EXISTS "lastCheckedById" UUID;
      ALTER TABLE re_inventory ADD COLUMN IF NOT EXISTS "last_checked_at" TIMESTAMP;
    `);

    // Optional FK to users (soft — ON DELETE SET NULL)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_re_inventory_last_checked_by'
        ) THEN
          ALTER TABLE re_inventory
            ADD CONSTRAINT "FK_re_inventory_last_checked_by"
            FOREIGN KEY ("lastCheckedById") REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE re_inventory DROP CONSTRAINT IF EXISTS "FK_re_inventory_last_checked_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE re_inventory DROP COLUMN IF EXISTS "last_checked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE re_inventory DROP COLUMN IF EXISTS "lastCheckedById"`,
    );
  }
}
