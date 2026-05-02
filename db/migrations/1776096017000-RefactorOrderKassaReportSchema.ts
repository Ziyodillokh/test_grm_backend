import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 3 qatlamli naming refactor: order < kassa < report.
 *
 * Naming konvensiya:
 *  - order  (atomic): NO prefix, NO suffix → additionalProfit, netProfit, discount, plastic
 *  - kassa  (oylik per filial): NO prefix, Sum suffix → additionalProfitSum, netProfitSum, discountSum, plasticSum
 *  - report (cross-filial aggregated): total prefix + Sum suffix → totalAdditionalProfitSum, totalDiscountSum
 *
 * income/expense/cashCollection/saleReturn/sizeReturn semantik jihatdan singular concept emas — Sum qo'shilmaydi.
 */
export class RefactorOrderKassaReportSchema1776096017000
  implements MigrationInterface
{
  name = 'RefactorOrderKassaReportSchema1776096017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============== ORDER ==============
    await queryRunner.query(
      `ALTER TABLE "order" RENAME COLUMN "additionalProfitSum" TO "additionalProfit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" RENAME COLUMN "netProfitSum" TO "netProfit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" RENAME COLUMN "discountSum" TO "discount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" RENAME COLUMN "managerDiscountSum" TO "managerDiscount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" RENAME COLUMN "plasticSum" TO "plastic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "createdById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "qrCodeId"`,
    );

    // ============== KASSA ==============
    // Sotuv aggregatlari rename
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "totalSize" TO "saleSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "totalSellCount" TO "saleCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "additionalProfitTotalSum" TO "additionalProfitSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "netProfitTotalSum" TO "netProfitSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "discount" TO "discountSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "return_sale" TO "saleReturn"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "return_size" TO "sizeReturn"`,
    );
    // income, expense saqlanadi (Sum qo'shilmaydi)

    // Pul oqimi snake_case -> camelCase
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "cash_collection" TO "cashCollection"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "in_hand" TO "inHand"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "opening_balance" TO "openingBalance"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "plan_price" TO "planPrice"`,
    );

    // Debt
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "debt_count" TO "debtCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "debt_kv" TO "debtSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "debt_sum" TO "debtSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "debt_profit_sum" TO "debtProfitSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "dealer_frozen_owed" TO "frozenOwed"`,
    );

    // Boolean rename
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "is_cancelled" TO "isCancelled"`,
    );

    // endDate -> finishedAt
    await queryRunner.query(
      `ALTER TABLE kassa RENAME COLUMN "endDate" TO "finishedAt"`,
    );

    // DROP'lar
    await queryRunner.query(
      `ALTER TABLE kassa DROP COLUMN IF EXISTS "totalSaleReturn"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa DROP COLUMN IF EXISTS "totalSaleSizeReturn"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa DROP COLUMN IF EXISTS "closerMId"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa DROP COLUMN IF EXISTS "old_debt_info"`,
    );
    await queryRunner.query(
      `ALTER TABLE kassa DROP COLUMN IF EXISTS "startDate"`,
    );

    // ============== REPORT ==============
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "totalSize" TO "totalSaleSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "totalSellCount" TO "totalSaleCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "additionalProfitTotalSum" TO "totalAdditionalProfitSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "netProfitTotalSum" TO "totalNetProfitSum"`,
    );
    // totalSaleReturn KEEP (allaqachon to'g'ri)
    // totalSizeReturn ADD (avval bu nomda Report'da yo'q edi — Kassa'dan farqli)
    await queryRunner.query(
      `ALTER TABLE report ADD COLUMN IF NOT EXISTS "totalSizeReturn" numeric(20,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "totalDiscount" TO "totalDiscountSum"`,
    );
    // totalIncome, totalExpense, totalCashCollection, totalPlasticSum, totalInternetShopSum KEEP

    // Debt
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "debt_count" TO "totalDebtCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "debt_kv" TO "totalDebtSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "debt_sum" TO "totalDebtSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "debt_profit_sum" TO "totalDebtProfitSum"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "dealer_frozen_owed" TO "totalFrozenOwed"`,
    );
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "dealer_plan" TO "dealerPlan"`,
    );

    // Boolean rename
    await queryRunner.query(
      `ALTER TABLE report RENAME COLUMN "is_cancelled" TO "isCancelled"`,
    );

    // DROP
    await queryRunner.query(`ALTER TABLE report DROP COLUMN IF EXISTS "in_hand"`);
    // filialId KEEP — code (kassa.service, package-transfer.service) reportni filial+year+month bo'yicha topadi

    // accauntantSum legacy DB column nomi entity'da @Column({ name: 'accauntantSum' }) bilan saqlanadi
    // (TypeScript field nomi accountantSum, DB column accauntantSum) — DB column nomi o'zgartirilmaydi.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse — har RENAME ni teskariga, har DROP'ni ADD COLUMN
    // ============== REPORT ==============
    await queryRunner.query(`ALTER TABLE report ADD COLUMN IF NOT EXISTS "in_hand" numeric(20,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "isCancelled" TO "is_cancelled"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "dealerPlan" TO "dealer_plan"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalFrozenOwed" TO "dealer_frozen_owed"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalDebtProfitSum" TO "debt_profit_sum"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalDebtSum" TO "debt_sum"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalDebtSize" TO "debt_kv"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalDebtCount" TO "debt_count"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalDiscountSum" TO "totalDiscount"`);
    await queryRunner.query(`ALTER TABLE report DROP COLUMN IF EXISTS "totalSizeReturn"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalNetProfitSum" TO "netProfitTotalSum"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalAdditionalProfitSum" TO "additionalProfitTotalSum"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalSaleCount" TO "totalSellCount"`);
    await queryRunner.query(`ALTER TABLE report RENAME COLUMN "totalSaleSize" TO "totalSize"`);

    // ============== KASSA ==============
    await queryRunner.query(`ALTER TABLE kassa ADD COLUMN IF NOT EXISTS "startDate" timestamp`);
    await queryRunner.query(`ALTER TABLE kassa ADD COLUMN IF NOT EXISTS "old_debt_info" jsonb`);
    await queryRunner.query(`ALTER TABLE kassa ADD COLUMN IF NOT EXISTS "closerMId" uuid`);
    await queryRunner.query(`ALTER TABLE kassa ADD COLUMN IF NOT EXISTS "totalSaleSizeReturn" numeric(20,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE kassa ADD COLUMN IF NOT EXISTS "totalSaleReturn" numeric(20,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "finishedAt" TO "endDate"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "isCancelled" TO "is_cancelled"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "frozenOwed" TO "dealer_frozen_owed"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "debtProfitSum" TO "debt_profit_sum"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "debtSum" TO "debt_sum"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "debtSize" TO "debt_kv"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "debtCount" TO "debt_count"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "planPrice" TO "plan_price"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "openingBalance" TO "opening_balance"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "inHand" TO "in_hand"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "cashCollection" TO "cash_collection"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "sizeReturn" TO "return_size"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "saleReturn" TO "return_sale"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "discountSum" TO "discount"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "netProfitSum" TO "netProfitTotalSum"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "additionalProfitSum" TO "additionalProfitTotalSum"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "saleCount" TO "totalSellCount"`);
    await queryRunner.query(`ALTER TABLE kassa RENAME COLUMN "saleSize" TO "totalSize"`);

    // ============== ORDER ==============
    await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "qrCodeId" uuid`);
    await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "createdById" uuid`);
    await queryRunner.query(`ALTER TABLE "order" RENAME COLUMN "plastic" TO "plasticSum"`);
    await queryRunner.query(`ALTER TABLE "order" RENAME COLUMN "managerDiscount" TO "managerDiscountSum"`);
    await queryRunner.query(`ALTER TABLE "order" RENAME COLUMN "discount" TO "discountSum"`);
    await queryRunner.query(`ALTER TABLE "order" RENAME COLUMN "netProfit" TO "netProfitSum"`);
    await queryRunner.query(`ALTER TABLE "order" RENAME COLUMN "additionalProfit" TO "additionalProfitSum"`);
  }
}
