import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropFilialDeadColumns1776096012000 implements MigrationInterface {
  name = 'DropFilialDeadColumns1776096012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // hickCompleted: faqat entity'da yozilgan, kodda hech qayerda ishlatilmaydi (dead).
    // test: faqat entity'da yozilgan, kodda hech qayerda ishlatilmaydi (dead sandbox flag).
    await queryRunner.query(`ALTER TABLE filial DROP COLUMN IF EXISTS "hickCompleted"`);
    await queryRunner.query(`ALTER TABLE filial DROP COLUMN IF EXISTS test`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE filial ADD COLUMN IF NOT EXISTS "hickCompleted" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE filial ADD COLUMN IF NOT EXISTS test boolean NOT NULL DEFAULT false`,
    );
  }
}
