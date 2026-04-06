import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQrLogoTable1712505600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "qr_logo" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "link" varchar NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "qrDataUrl" text,
        "dateOne" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "dateTwo" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "deletedDate" TIMESTAMP
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "qr_logo";`);
  }
}
