import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCollectionCountryId1776096011000 implements MigrationInterface {
  name = 'DropCollectionCountryId1776096011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // collection.countryId redundant — country factory orqali olinadi (factory.country).
    // Faqat ChatGPT integration'da bitta joyda ishlatilgan edi, u factory.country ga ko'chirildi.
    await queryRunner.query(`ALTER TABLE collection DROP CONSTRAINT IF EXISTS "FK_fa8da3a6c05098ff0d9671f17af"`);
    await queryRunner.query(`ALTER TABLE collection DROP COLUMN IF EXISTS "countryId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE collection ADD COLUMN IF NOT EXISTS "countryId" uuid`);
    await queryRunner.query(`
      ALTER TABLE collection
        ADD CONSTRAINT "FK_fa8da3a6c05098ff0d9671f17af"
        FOREIGN KEY ("countryId") REFERENCES country(id) ON DELETE SET NULL
    `);
  }
}
