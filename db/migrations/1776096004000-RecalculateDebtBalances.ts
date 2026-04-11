import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecalculateDebtBalances1776096004000 implements MigrationInterface {
  name = 'RecalculateDebtBalances1776096004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Recalculate owed, given, totalDebt from actual cashflows
    // owed = SUM of Приход (money taken from kent)
    // given = SUM of Расход (money returned to kent)
    // totalDebt = owed - given
    await queryRunner.query(`
      UPDATE debts d SET
        owed = COALESCE(sub.calc_owed, 0),
        given = COALESCE(sub.calc_given, 0),
        "totalDebt" = COALESCE(sub.calc_owed, 0) - COALESCE(sub.calc_given, 0)
      FROM (
        SELECT
          c."debtId",
          SUM(CASE WHEN c.type = 'Приход' THEN c.price ELSE 0 END) AS calc_owed,
          SUM(CASE WHEN c.type = 'Расход' THEN c.price ELSE 0 END) AS calc_given
        FROM cashflow c
        WHERE c.is_cancelled = false
          AND c."debtId" IS NOT NULL
        GROUP BY c."debtId"
      ) sub
      WHERE d.id = sub."debtId"
        AND d."deletedDate" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot reliably revert — previous values are lost
  }
}
