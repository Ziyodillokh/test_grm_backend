import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentDeliveryInfoToCollection1712419200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "paymentDeliveryInfo" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection" DROP COLUMN IF EXISTS "paymentDeliveryInfo"`,
    );
  }
}
